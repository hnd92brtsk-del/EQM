from __future__ import annotations

import hashlib
import re
import socket
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterable
from urllib.error import URLError
from urllib.parse import quote, unquote
from urllib.request import urlopen

import psutil
from fastapi import HTTPException, status

from app.core.config import BASE_DIR
from app.schemas.diagnostics import (
    DiagnosticsCommandGroupOut,
    DiagnosticsDeleteLogsOut,
    DiagnosticsLogEntryOut,
    DiagnosticsLogsPageOut,
    DiagnosticsPortOut,
    DiagnosticsProcessKillOut,
    DiagnosticsProcessOut,
    DiagnosticsServiceOut,
    DiagnosticsSummaryOut,
)

PROJECT_ROOT = BASE_DIR.parent
RUNTIME_LOGS_DIR = PROJECT_ROOT / "runtime-logs"
SERVER_LOG_DIR = RUNTIME_LOGS_DIR / "server"
RETENTION_HOURS = 24
REFRESH_SECONDS = 3600
MAX_STORED_LOG_LINES = 300
MAX_LINES_PER_FILE = 1200

SERVICE_DEFINITIONS = {
    "postgres": {
        "display_name": "PostgreSQL",
        "port": 5432,
        "host": "localhost",
        "http_url": None,
        "log_dir": RUNTIME_LOGS_DIR / "postgres",
        "legacy_files": (PROJECT_ROOT / ".postgres" / "postgres.log",),
    },
    "backend": {
        "display_name": "Backend",
        "port": 8000,
        "host": "localhost",
        "http_url": "http://localhost:8000/docs",
        "log_dir": RUNTIME_LOGS_DIR / "backend",
        "legacy_files": (PROJECT_ROOT / "backend.log", PROJECT_ROOT / "backend.err.log"),
    },
    "frontend": {
        "display_name": "Frontend",
        "port": 5173,
        "host": "localhost",
        "http_url": "http://localhost:5173",
        "log_dir": RUNTIME_LOGS_DIR / "frontend",
        "legacy_files": (PROJECT_ROOT / "frontend.log", PROJECT_ROOT / "frontend.err.log"),
    },
}

TIMESTAMP_PATTERNS = (
    re.compile(r"^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)"),
    re.compile(r"^(?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)"),
)

LOW_SIGNAL_RULES = (
    {
        "source": "postgres",
        "signature": "postgres_checkpoint_start",
        "pattern": re.compile(r"checkpoint starting: time", re.IGNORECASE),
        "summary": "PostgreSQL начал плановый checkpoint.",
        "normalized_message": "Служебное событие PostgreSQL: старт планового checkpoint.",
    },
    {
        "source": "postgres",
        "signature": "postgres_checkpoint_complete",
        "pattern": re.compile(r"checkpoint complete:", re.IGNORECASE),
        "summary": "PostgreSQL завершил плановый checkpoint.",
        "normalized_message": "Служебное событие PostgreSQL: checkpoint завершен штатно.",
    },
)

KNOWN_ERROR_RULES = (
    {
        "signature": "port_in_use",
        "pattern": re.compile(r"address already in use|port \d+ is already in use|eaddrinuse", re.IGNORECASE),
        "severity": "critical",
        "category": "port",
        "summary": "Порт уже занят другим процессом.",
        "causes": ["На ожидаемом порту уже запущен другой процесс.", "Предыдущий экземпляр сервиса завершился некорректно."],
        "actions": ["Найдите владельца порта и освободите его.", "После освобождения порта перезапустите сервис EQM."],
    },
    {
        "signature": "connection_refused",
        "pattern": re.compile(r"connection refused|could not connect|actively refused", re.IGNORECASE),
        "severity": "critical",
        "category": "availability",
        "summary": "Сервис не принимает соединения.",
        "causes": ["Целевой сервис не запущен.", "Сервис слушает другой порт или аварийно завершился."],
        "actions": ["Проверьте статус процесса и привязку порта.", "Откройте журнал сервиса и найдите первую ошибку старта."],
    },
    {
        "signature": "postgres_auth_failed",
        "pattern": re.compile(r"password authentication failed|authentication failed", re.IGNORECASE),
        "severity": "error",
        "category": "database",
        "summary": "Ошибка аутентификации в PostgreSQL.",
        "causes": ["Неверные учетные данные пользователя базы.", "Конфигурация backend не совпадает с настройками базы."],
        "actions": ["Проверьте db_user/db_password и протестируйте вход вручную.", "Сверьте переменные окружения backend и базы."],
    },
    {
        "signature": "database_missing",
        "pattern": re.compile(r"database .* does not exist", re.IGNORECASE),
        "severity": "critical",
        "category": "database",
        "summary": "Указанная база данных отсутствует.",
        "causes": ["Локальная база еще не создана.", "Backend настроен на неверное имя базы."],
        "actions": ["Проверьте db_name и наличие базы в кластере.", "Создайте базу или восстановите локальный дамп."],
    },
    {
        "signature": "traceback",
        "pattern": re.compile(r"traceback|exception|fatal|runtimeerror|valueerror|typeerror", re.IGNORECASE),
        "severity": "error",
        "category": "application",
        "summary": "Приложение зафиксировало исключение.",
        "causes": ["В коде возникло необработанное исключение.", "Состояние данных или конфигурации не соответствует ожиданиям приложения."],
        "actions": ["Откройте полный traceback и проверьте первую прикладную строку стека.", "Сопоставьте ошибку с последними изменениями кода и конфигурации."],
    },
    {
        "signature": "frontend_dependency_error",
        "pattern": re.compile(r"cannot find module|module not found|failed to resolve import|is not exported by", re.IGNORECASE),
        "severity": "error",
        "category": "frontend_build",
        "summary": "Ошибка зависимостей или импорта фронтенда.",
        "causes": ["Не установлена зависимость.", "Импорт указывает на неверный путь или отсутствующий export."],
        "actions": ["Проверьте package.json и состояние node_modules.", "Сверьте import/export в файле, который указан в ошибке."],
    },
)

CRITICAL_SERVICE_ISSUES = {"listener_missing", "http_probe_failed", "foreign_listener"}


def utc_now() -> datetime:
    return datetime.now(UTC)


def trim_log_file(path: Path, max_lines: int = MAX_STORED_LOG_LINES) -> None:
    if max_lines <= 0 or not path.exists() or not path.is_file():
        return
    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
    except OSError:
        return
    if len(lines) <= max_lines:
        return
    path.write_text("".join(lines[-max_lines:]), encoding="utf-8")


def ensure_runtime_log_retention(base_dir: Path = RUNTIME_LOGS_DIR, retention_hours: int = RETENTION_HOURS, now: datetime | None = None) -> None:
    if not base_dir.exists():
        return
    threshold = (now or utc_now()) - timedelta(hours=retention_hours)
    for path in base_dir.rglob("*"):
        if not path.is_file():
            continue
        if datetime.fromtimestamp(path.stat().st_mtime, UTC) < threshold:
            path.unlink(missing_ok=True)
            continue
        trim_log_file(path)


def safe_http_ok(url: str | None) -> bool | None:
    if not url:
        return None
    try:
        with urlopen(url, timeout=2) as response:  # noqa: S310
            return 200 <= response.status < 500
    except Exception:
        return False


def classify_service(command_line: str, name: str, executable: str | None = None) -> str | None:
    normalized = " ".join(filter(None, [name, command_line, executable or ""])).lower()
    if "uvicorn app.main:app" in normalized:
        return "backend"
    if "vite" in normalized or "npm run dev" in normalized:
        return "frontend"
    if "postgres" in normalized:
        return "postgres"
    return None


def parse_observed_at(message: str, fallback: datetime | None) -> datetime | None:
    for pattern in TIMESTAMP_PATTERNS:
        match = pattern.search(message)
        if match:
            try:
                return datetime.fromisoformat(match.group("ts")).replace(tzinfo=UTC)
            except ValueError:
                continue
    return fallback


def build_entry_id(source: str, path: Path, line_number: int, raw_message: str) -> str:
    digest = hashlib.sha1(raw_message.encode("utf-8", errors="ignore")).hexdigest()[:12]
    return f"{source}|{quote(str(path), safe='')}|{line_number}|{digest}"


def parse_entry_id(entry_id: str) -> tuple[str, Path, int, str] | None:
    parts = entry_id.split("|", 3)
    if len(parts) != 4:
        return None
    source, encoded_path, line_number_text, digest = parts
    try:
        return source, Path(unquote(encoded_path)), int(line_number_text), digest
    except ValueError:
        return None


def get_server_log_file(now: datetime | None = None) -> Path:
    moment = now or utc_now()
    SERVER_LOG_DIR.mkdir(parents=True, exist_ok=True)
    return SERVER_LOG_DIR / f"server-{moment.strftime('%Y-%m-%d')}.log"


def append_server_event(signature: str, severity: str, message: str) -> None:
    log_file = get_server_log_file()
    with log_file.open("a", encoding="utf-8") as handle:
        handle.write(f"{utc_now().isoformat()} | {severity.upper()} | {signature} | {message}\n")
    trim_log_file(log_file)


def build_command_groups(signature: str, source: str) -> list[DiagnosticsCommandGroupOut]:
    service_unit = {"backend": "eqm-backend", "frontend": "eqm-frontend", "postgres": "postgresql", "server": "eqm-runtime"}.get(source, "eqm-service")
    compose_service = {"backend": "backend", "frontend": "frontend", "postgres": "postgres", "server": "backend"}.get(source, "backend")
    port_hint = {"backend": "8000", "frontend": "5173", "postgres": "5432"}.get(source, "<PORT>")
    if signature in {"port_in_use", "foreign_listener"}:
        local_commands = [f"Get-NetTCPConnection -LocalPort {port_hint} | Format-List", "Get-Process -Id <PID>", "taskkill /PID <PID> /F"]
        nginx_commands = [f"sudo ss -ltnp | grep ':{port_hint}'", f"sudo systemctl status {service_unit}", "sudo kill -TERM <PID>"]
        docker_commands = ["docker ps", f"docker compose logs {compose_service} --tail=200", f"docker compose restart {compose_service}"]
    elif signature in {"connection_refused", "listener_missing", "http_probe_failed", "listener_without_healthy_http"}:
        local_commands = [f"Invoke-WebRequest http://localhost:{port_hint} -UseBasicParsing", f"Get-NetTCPConnection -LocalPort {port_hint}", ".\\start-local.ps1"]
        nginx_commands = [f"curl -I http://127.0.0.1:{port_hint}", f"sudo systemctl status {service_unit}", f"sudo journalctl -u {service_unit} -n 100 --no-pager"]
        docker_commands = ["docker compose ps", f"docker compose logs {compose_service} --tail=200", f"docker compose restart {compose_service}"]
    elif signature in {"postgres_auth_failed", "database_missing"}:
        local_commands = ["psql -h localhost -p 5432 -U <USER> -d <DB>", "Get-Content .env | Select-String 'db_'"]
        nginx_commands = ["sudo -u postgres psql -lqt", f"sudo journalctl -u {service_unit} -n 100 --no-pager"]
        docker_commands = ["docker compose ps", "docker compose exec postgres psql -U <USER> -d <DB>", "docker compose logs backend --tail=200"]
    else:
        local_commands = ["npm run build", "Get-Content backend.err.log -Tail 200", "Get-Content frontend.err.log -Tail 200"]
        nginx_commands = [f"sudo journalctl -u {service_unit} -n 200 --no-pager", "sudo nginx -t"]
        docker_commands = [f"docker compose logs {compose_service} --tail=200", "docker compose build"]
    warning = "Последняя команда может быть восстановительной и прервать процесс."
    return [
        DiagnosticsCommandGroupOut(environment="local", title="Local", commands=local_commands, warning=warning),
        DiagnosticsCommandGroupOut(environment="nginx", title="Nginx / Systemd", commands=nginx_commands, warning=warning),
        DiagnosticsCommandGroupOut(environment="docker", title="Docker / Docker Compose", commands=docker_commands, warning=warning),
    ]


def analyze_log_message(source: str, message: str) -> dict[str, object]:
    normalized_raw = message.strip()
    for rule in LOW_SIGNAL_RULES:
        if rule["source"] == source and rule["pattern"].search(normalized_raw):
            return {
                "signature": rule["signature"],
                "severity": "info",
                "category": "housekeeping",
                "summary": rule["summary"],
                "normalized_message": rule["normalized_message"],
                "possible_causes": [],
                "suggested_actions": [],
                "suggested_commands": [],
                "is_low_signal": True,
            }
    for rule in KNOWN_ERROR_RULES:
        if rule["pattern"].search(normalized_raw):
            return {
                "signature": rule["signature"],
                "severity": rule["severity"],
                "category": rule["category"],
                "summary": rule["summary"],
                "normalized_message": rule["summary"],
                "possible_causes": list(rule["causes"]),
                "suggested_actions": list(rule["actions"]),
                "suggested_commands": build_command_groups(str(rule["signature"]), source),
                "is_low_signal": False,
            }
    return {
        "signature": "info",
        "severity": "info",
        "category": "runtime",
        "summary": "Информационная запись.",
        "normalized_message": normalized_raw,
        "possible_causes": [],
        "suggested_actions": [],
        "suggested_commands": [],
        "is_low_signal": False,
    }


def classify_log_message(message: str) -> tuple[str, str, str, list[str], list[str]]:
    analysis = analyze_log_message("server", message)
    return (
        str(analysis["signature"]),
        str(analysis["severity"]),
        str(analysis["summary"]),
        list(analysis["possible_causes"]),
        list(analysis["suggested_actions"]),
    )


def normalize_process(proc: psutil.Process, ports_by_pid: dict[int, list[int]]) -> DiagnosticsProcessOut | None:
    try:
        command_line = " ".join(proc.cmdline())
        executable = proc.exe() if proc.exe() else None
        service = classify_service(command_line, proc.name(), executable)
        if not service:
            return None
        created_at = proc.create_time()
        return DiagnosticsProcessOut(
            pid=proc.pid,
            parent_pid=proc.ppid() or None,
            name=proc.name(),
            service=service,
            status=proc.status(),
            command_line=command_line or None,
            executable=executable,
            started_at=datetime.fromtimestamp(created_at, UTC) if created_at else None,
            uptime_seconds=max(0, int(utc_now().timestamp() - created_at)) if created_at else None,
            ports=sorted(ports_by_pid.get(proc.pid, [])),
            suspicious_reasons=[],
            can_kill=False,
        )
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return None


def collect_listening_ports() -> list[DiagnosticsPortOut]:
    expected_by_port = {config["port"]: service for service, config in SERVICE_DEFINITIONS.items()}
    results: list[DiagnosticsPortOut] = []
    try:
        connections = psutil.net_connections(kind="inet")
    except (psutil.Error, OSError):
        return results

    for connection in connections:
        if connection.status != psutil.CONN_LISTEN or not connection.laddr:
            continue
        expected_service = expected_by_port.get(connection.laddr.port)
        if not expected_service:
            continue
        pid = connection.pid
        process_name = None
        command_line = None
        detected_service = None
        issues: list[str] = []
        if pid:
            try:
                process = psutil.Process(pid)
                process_name = process.name()
                command_line = " ".join(process.cmdline()) or None
                detected_service = classify_service(command_line or "", process_name, process.exe() if process.exe() else None)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                issues.append("stale_pid")
        if pid and detected_service != expected_service:
            issues.append("foreign_listener")
        results.append(
            DiagnosticsPortOut(
                port=connection.laddr.port,
                host=connection.laddr.ip,
                state=connection.status,
                pid=pid,
                process_name=process_name,
                command_line=command_line,
                service=expected_service,
                detected_service=detected_service,
                issues=issues,
            )
        )
    return sorted(results, key=lambda item: item.port)


def collect_processes() -> list[DiagnosticsProcessOut]:
    try:
        connections = psutil.net_connections(kind="inet")
    except (psutil.Error, OSError):
        connections = []
    ports_by_pid: dict[int, list[int]] = defaultdict(list)
    for connection in connections:
        if connection.status == psutil.CONN_LISTEN and connection.pid and connection.laddr:
            ports_by_pid[connection.pid].append(connection.laddr.port)
    try:
        raw_processes = list(psutil.process_iter())
    except (psutil.Error, OSError):
        raw_processes = []

    processes = [item for item in (normalize_process(proc, ports_by_pid) for proc in raw_processes) if item]
    pid_to_process = {process.pid: process for process in processes}
    root_counts: dict[str, int] = defaultdict(int)
    http_states = {service: safe_http_ok(config["http_url"]) if config["http_url"] else None for service, config in SERVICE_DEFINITIONS.items()}

    for process in processes:
        parent = pid_to_process.get(process.parent_pid or -1)
        if process.parent_pid and parent is None:
            process.suspicious_reasons.append("process_without_parent")
        if not parent or parent.service != process.service:
            root_counts[process.service or "unknown"] += 1

    for process in processes:
        if process.service and root_counts.get(process.service, 0) > 1:
            process.suspicious_reasons.append("duplicate_runtime")
        if process.service in {"backend", "frontend"} and process.ports and http_states.get(process.service) is False:
            process.suspicious_reasons.append("listener_without_healthy_http")
        process.can_kill = "process_without_parent" in process.suspicious_reasons

    return sorted(processes, key=lambda item: (item.service or "", item.pid))


def collect_services(ports: list[DiagnosticsPortOut], processes: list[DiagnosticsProcessOut]) -> list[DiagnosticsServiceOut]:
    checked_at = utc_now()
    listener_by_service = {item.service: item for item in ports if item.service}
    processes_by_service: dict[str, list[DiagnosticsProcessOut]] = defaultdict(list)
    for process in processes:
        if process.service:
            processes_by_service[process.service].append(process)

    services: list[DiagnosticsServiceOut] = []
    for service, config in SERVICE_DEFINITIONS.items():
        listener = listener_by_service.get(service)
        service_processes = processes_by_service.get(service, [])
        http_ok = safe_http_ok(config["http_url"]) if config["http_url"] else None
        issues: list[str] = []
        if not listener:
            issues.append("listener_missing")
        else:
            for issue in listener.issues:
                if issue not in issues:
                    issues.append(issue)
        if config["http_url"] and http_ok is False:
            issues.append("http_probe_failed")
        if any("duplicate_runtime" in item.suspicious_reasons for item in service_processes):
            issues.append("duplicate_runtime")
        if any("process_without_parent" in item.suspicious_reasons for item in service_processes):
            issues.append("orphan_process_detected")
        status_value = "healthy"
        if any(issue in CRITICAL_SERVICE_ISSUES for issue in issues):
            status_value = "critical"
        elif issues:
            status_value = "warning"
        services.append(
            DiagnosticsServiceOut(
                service=service,
                display_name=str(config["display_name"]),
                status=status_value,
                port=int(config["port"]),
                host=str(config["host"]),
                listener_pid=listener.pid if listener else None,
                http_ok=http_ok,
                process_count=len(service_processes),
                warning_count=sum(1 for item in service_processes if item.suspicious_reasons),
                error_count=sum(1 for issue in issues if issue in CRITICAL_SERVICE_ISSUES),
                issues=issues,
                checked_at=checked_at,
            )
        )
    return services


def get_log_candidates(source: str) -> list[Path]:
    if source == "server":
        return sorted(SERVER_LOG_DIR.glob("*.log"), key=lambda item: item.stat().st_mtime, reverse=True) if SERVER_LOG_DIR.exists() else []
    config = SERVICE_DEFINITIONS.get(source)
    if not config:
        return []
    candidates: list[Path] = []
    log_dir = Path(config["log_dir"])
    if log_dir.exists():
        candidates.extend(sorted(log_dir.glob("*.log"), key=lambda item: item.stat().st_mtime, reverse=True))
    candidates.extend(path for path in config["legacy_files"] if path.exists())
    unique: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        if candidate not in seen:
            seen.add(candidate)
            unique.append(candidate)
    return unique


def build_log_entry(source: str, path: Path, line_number: int, text: str, observed_at: datetime | None, can_delete: bool) -> DiagnosticsLogEntryOut:
    analysis = analyze_log_message(source, text)
    entry_id = build_entry_id(source, path, line_number, text)
    return DiagnosticsLogEntryOut(
        id=entry_id,
        entry_id=entry_id,
        source=source,
        severity=str(analysis["severity"]),
        signature=str(analysis["signature"]),
        category=str(analysis["category"]),
        summary=str(analysis["summary"]),
        normalized_message=str(analysis["normalized_message"]) if analysis["normalized_message"] else None,
        raw_message=text,
        observed_at=observed_at,
        file_path=str(path),
        line_number=line_number,
        is_low_signal=bool(analysis["is_low_signal"]),
        can_delete=can_delete,
        possible_causes=list(analysis["possible_causes"]),
        suggested_actions=list(analysis["suggested_actions"]),
        suggested_commands=list(analysis["suggested_commands"]),
    )


def load_log_entries_from_file(source: str, path: Path) -> list[DiagnosticsLogEntryOut]:
    file_mtime = datetime.fromtimestamp(path.stat().st_mtime, UTC)
    trim_log_file(path)
    try:
        file_lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError as exc:
        entry_id = build_entry_id(source, path, 0, str(exc))
        return [
            DiagnosticsLogEntryOut(
                id=entry_id,
                entry_id=entry_id,
                source=source,
                severity="warning",
                signature="log_file_unreadable",
                category="filesystem",
                summary="Не удалось прочитать лог-файл.",
                normalized_message="Лог-файл недоступен для чтения.",
                raw_message=str(exc),
                observed_at=file_mtime,
                file_path=str(path),
                line_number=0,
                is_low_signal=False,
                can_delete=False,
                possible_causes=["Файл занят другим процессом или недоступен по правам."],
                suggested_actions=["Проверьте существование файла и права доступа к нему."],
                suggested_commands=build_command_groups("generic_error", source),
            )
        ]

    trimmed_lines = file_lines[-MAX_LINES_PER_FILE:]
    line_offset = len(file_lines) - len(trimmed_lines)
    entries: list[DiagnosticsLogEntryOut] = []
    for index, line in enumerate(trimmed_lines):
        text = line.strip()
        if not text:
            continue
        line_number = line_offset + index + 1
        entries.append(build_log_entry(source, path, line_number, text, parse_observed_at(text, file_mtime), True))
    return entries


def build_host_log_entries(services: Iterable[DiagnosticsServiceOut], ports: Iterable[DiagnosticsPortOut], processes: Iterable[DiagnosticsProcessOut]) -> list[DiagnosticsLogEntryOut]:
    entries: list[DiagnosticsLogEntryOut] = []
    now = utc_now()
    synthetic_path = get_server_log_file(now)
    ports_by_service = {item.service: item for item in ports if item.service}

    def add_entry(signature: str, severity: str, summary: str, raw_message: str, causes: list[str], actions: list[str]) -> None:
        entry_id = build_entry_id("server", synthetic_path, len(entries) + 1, raw_message)
        entries.append(
            DiagnosticsLogEntryOut(
                id=entry_id,
                entry_id=entry_id,
                source="server",
                severity=severity,
                signature=signature,
                category="host",
                summary=summary,
                normalized_message=summary,
                raw_message=raw_message,
                observed_at=now,
                file_path=str(synthetic_path),
                line_number=None,
                is_low_signal=False,
                can_delete=False,
                possible_causes=causes,
                suggested_actions=actions,
                suggested_commands=build_command_groups(signature, "server"),
            )
        )

    for service in services:
        listener = ports_by_service.get(service.service)
        if "listener_missing" in service.issues:
            add_entry("listener_missing", "critical", f"{service.display_name}: не найден слушатель на ожидаемом порту.", f"Service {service.service} is expected on port {service.port}, but no listener was found.", ["Процесс сервиса не запущен.", "Сервис завершился сразу после старта."], ["Проверьте список процессов сервиса.", "Проверьте журнал сервиса и команду запуска."])
        if "http_probe_failed" in service.issues:
            add_entry("http_probe_failed", "error", f"{service.display_name}: порт открыт, но HTTP-проверка не проходит.", f"Service {service.service} listens on port {service.port}, but the HTTP probe failed.", ["Сервис завис в частично рабочем состоянии.", "Приложение слушает порт, но не готово отвечать."], ["Откройте stdout/stderr сервиса.", "Сверьте ответ curl/Invoke-WebRequest с ожиданиями."])
        if "foreign_listener" in service.issues:
            add_entry("foreign_listener", "critical", f"{service.display_name}: ожидаемый порт занят посторонним процессом.", f"Expected {service.service} on port {service.port}, but PID {listener.pid if listener else 'unknown'} owns the listener.", ["Порт занял другой процесс.", "После прошлого запуска остался конфликтующий хвост."], ["Откройте таблицу портов и найдите PID владельца.", "После освобождения порта перезапустите сервис."])
        if "stale_pid" in service.issues:
            add_entry("stale_pid", "warning", f"{service.display_name}: PID владельца порта исчез во время диагностики.", f"Port owner PID for service {service.service} disappeared during diagnostics collection.", ["Процесс завершился прямо во время проверки.", "ОС уже освобождает сокет."], ["Повторите диагностику через несколько секунд.", "Проверьте стабильность запуска сервиса."])

    for process in processes:
        if "process_without_parent" in process.suspicious_reasons:
            add_entry("process_without_parent", "warning", f"Процесс {process.pid} выглядит сиротливым.", f"Process {process.pid} ({process.name}) has no living parent process.", ["После перезапуска остался дочерний процесс.", "Родительский процесс завершился аварийно."], ["Проверьте дерево процессов.", "При необходимости используйте Kill process."])
        if "duplicate_runtime" in process.suspicious_reasons:
            add_entry("duplicate_runtime", "warning", f"Для сервиса {process.service} найден дополнительный корневой процесс.", f"Duplicate runtime root process detected for service {process.service}: PID {process.pid}.", ["Сервис был запущен повторно без корректной остановки.", "Предыдущий экземпляр не завершился полностью."], ["Проверьте процессы и занятые порты.", "Перезапустите runtime штатным способом."])
        if "listener_without_healthy_http" in process.suspicious_reasons:
            add_entry("listener_without_healthy_http", "warning", f"Процесс {process.pid} слушает порт, но HTTP-проверка не проходит.", f"Process {process.pid} listens on {process.ports}, but the service is not healthy over HTTP.", ["Сервис завис до полной инициализации.", "Порт открыт, но приложение не отвечает корректно."], ["Проверьте stderr/stdout логи процесса.", "Сверьте проблему с последними исключениями."])

    for source in ("postgres", "backend", "frontend"):
        if not get_log_candidates(source):
            add_entry("missing_log_file", "warning", f"Не найден лог для источника {source}.", f"No log files found for source {source}.", ["Сервис еще не писал в лог.", "Логи лежат в другом пути.", "Файл был удален политикой хранения."], ["Проверьте runtime-logs и legacy-пути логов.", "Убедитесь, что сервис запускался после обновления схемы логирования."])
    return entries


def collect_all_log_entries(include_low_signal: bool = False) -> list[DiagnosticsLogEntryOut]:
    ports = collect_listening_ports()
    processes = collect_processes()
    services = collect_services(ports, processes)
    entries = build_host_log_entries(services, ports, processes)
    for source in ("server", "postgres", "backend", "frontend"):
        for path in get_log_candidates(source):
            entries.extend(load_log_entries_from_file(source, path))
    if not include_low_signal:
        entries = [entry for entry in entries if not entry.is_low_signal]
    entries.sort(key=lambda item: item.observed_at or datetime.fromtimestamp(0, UTC), reverse=True)
    return entries


def get_diagnostics_summary() -> DiagnosticsSummaryOut:
    ensure_runtime_log_retention()
    ports = collect_listening_ports()
    processes = collect_processes()
    services = collect_services(ports, processes)
    return DiagnosticsSummaryOut(
        checked_at=utc_now(),
        host=socket.gethostname(),
        refresh_seconds=REFRESH_SECONDS,
        services=services,
        ports=ports,
        process_count=len(processes),
        warning_count=sum(1 for service in services if service.status == "warning"),
        error_count=sum(1 for service in services if service.status == "critical"),
    )


def get_diagnostics_ports() -> list[DiagnosticsPortOut]:
    ensure_runtime_log_retention()
    return collect_listening_ports()


def get_diagnostics_processes() -> list[DiagnosticsProcessOut]:
    ensure_runtime_log_retention()
    return collect_processes()


def get_diagnostics_logs(source: str | None = None, severity: str | None = None, q: str | None = None, include_low_signal: bool = False, date_from: datetime | None = None, date_to: datetime | None = None, page: int = 1, page_size: int = 50) -> DiagnosticsLogsPageOut:
    ensure_runtime_log_retention()
    entries = collect_all_log_entries(include_low_signal=include_low_signal)
    if source:
        entries = [entry for entry in entries if entry.source == source]
    if severity:
        entries = [entry for entry in entries if entry.severity == severity]
    if q:
        query = q.lower()
        entries = [
            entry for entry in entries
            if query in entry.raw_message.lower()
            or query in entry.summary.lower()
            or (entry.normalized_message and query in entry.normalized_message.lower())
            or any(query in item.lower() for item in entry.possible_causes)
            or any(query in item.lower() for item in entry.suggested_actions)
            or any(query in command.lower() for group in entry.suggested_commands for command in group.commands)
        ]
    if date_from:
        entries = [entry for entry in entries if entry.observed_at and entry.observed_at >= date_from]
    if date_to:
        entries = [entry for entry in entries if entry.observed_at and entry.observed_at <= date_to]
    total = len(entries)
    start = max(0, (page - 1) * page_size)
    end = start + page_size
    return DiagnosticsLogsPageOut(items=entries[start:end], page=page, page_size=page_size, total=total)


def delete_diagnostics_logs(entry_ids: list[str]) -> DiagnosticsDeleteLogsOut:
    ensure_runtime_log_retention()
    targets_by_path: dict[Path, list[tuple[str, int, str]]] = defaultdict(list)
    missing_entry_ids: list[str] = []
    for entry_id in entry_ids:
        parsed = parse_entry_id(entry_id)
        if not parsed:
            missing_entry_ids.append(entry_id)
            continue
        source, path, line_number, digest = parsed
        targets_by_path[path].append((source, line_number, digest))

    deleted_count = 0
    for path, targets in targets_by_path.items():
        if not path.exists():
            missing_entry_ids.extend(f"{source}|{quote(str(path), safe='')}|{line_number}|{digest}" for source, line_number, digest in targets)
            continue
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
        delete_indexes: set[int] = set()
        for source, line_number, digest in targets:
            matched_index = None
            if 1 <= line_number <= len(lines):
                candidate = lines[line_number - 1].rstrip("\r\n")
                if hashlib.sha1(candidate.encode("utf-8", errors="ignore")).hexdigest()[:12] == digest:
                    matched_index = line_number - 1
            if matched_index is None:
                for index, line in enumerate(lines):
                    candidate = line.rstrip("\r\n")
                    if hashlib.sha1(candidate.encode("utf-8", errors="ignore")).hexdigest()[:12] == digest:
                        matched_index = index
                        break
            if matched_index is None:
                missing_entry_ids.append(f"{source}|{quote(str(path), safe='')}|{line_number}|{digest}")
                continue
            delete_indexes.add(matched_index)
        if delete_indexes:
            path.write_text("".join(line for index, line in enumerate(lines) if index not in delete_indexes), encoding="utf-8")
            trim_log_file(path)
            deleted_count += len(delete_indexes)

    if deleted_count:
        append_server_event("logs_delete", "info", f"Manual hard delete removed {deleted_count} log entries.")
    return DiagnosticsDeleteLogsOut(deleted_count=deleted_count, missing_entry_ids=missing_entry_ids)


def kill_diagnostics_process(pid: int) -> DiagnosticsProcessKillOut:
    ensure_runtime_log_retention()
    process_snapshot = next((item for item in collect_processes() if item.pid == pid), None)
    if not process_snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Process not found")
    if not process_snapshot.can_kill:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only orphan processes can be killed")
    try:
        process = psutil.Process(pid)
    except psutil.NoSuchProcess:
        append_server_event("orphan_kill_skipped", "warning", f"PID {pid} disappeared before kill.")
        return DiagnosticsProcessKillOut(pid=pid, killed=True, message="Process already exited")
    try:
        process.terminate()
        process.wait(timeout=3)
    except psutil.TimeoutExpired:
        process.kill()
        process.wait(timeout=2)
    except psutil.NoSuchProcess:
        pass
    except psutil.AccessDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    append_server_event("orphan_killed", "warning", f"Manual kill executed for orphan PID {pid}.")
    return DiagnosticsProcessKillOut(pid=pid, killed=True, message="Orphan process terminated")
