from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.core.versioning import read_version
from app.models.security import UserRole
from app.routers import diagnostics as diagnostics_router
from app.schemas.diagnostics import (
    DiagnosticsPortOut,
    DiagnosticsDatabaseOverviewOut,
    DiagnosticsProcessOut,
    DiagnosticsRuntimeTopologyOut,
    DiagnosticsServiceOut,
    DiagnosticsSummaryOut,
)
from app.services import diagnostics as diagnostics_service


def make_app(user_role: str | UserRole) -> FastAPI:
    app = FastAPI()
    app.include_router(diagnostics_router.router, prefix="/api/v1/admin/diagnostics")
    normalized_role = user_role.value if isinstance(user_role, UserRole) else user_role
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role=normalized_role)
    return app


def test_diagnostics_summary_requires_admin(monkeypatch):
    sample = DiagnosticsSummaryOut(
        app_version="v1.0.1",
        checked_at=datetime(2026, 3, 21, 10, 0, tzinfo=UTC),
        host="eqm-dev",
        refresh_seconds=3600,
        environment_mode="local",
        public_entrypoint="http://localhost:5173",
        services=[
            DiagnosticsServiceOut(
                service="backend",
                display_name="Backend",
                status="healthy",
                port=8000,
                host="localhost",
                listener_pid=1234,
                http_ok=True,
                process_count=1,
                process_count_total=1,
                process_count_primary=1,
                process_count_auxiliary=0,
                warning_count=0,
                error_count=0,
                issues=[],
                checked_at=datetime(2026, 3, 21, 10, 0, tzinfo=UTC),
            )
        ],
        ports=[],
        database_overview=DiagnosticsDatabaseOverviewOut(
            database_name="equipment_crm",
            host="localhost",
            port=5432,
            user="equipment_user",
            database_bytes=1024,
            table_count=1,
            total_rows=10,
            tables=[],
            issues=[],
        ),
        runtime_topology=DiagnosticsRuntimeTopologyOut(
            environment_mode="local",
            public_entrypoint="http://localhost:5173",
            frontend_url="http://localhost:5173",
            frontend_api_base="http://localhost:8000/api/v1",
            backend_base_url="http://localhost:8000",
            backend_http_url="http://localhost:8000/docs",
            backend_listener_pid=1234,
            backend_listener_port=8000,
            backend_http_ok=True,
            database_dsn="postgresql://equipment_user@localhost:5432/equipment_crm",
            database_host="localhost",
            database_port=5432,
            database_name="equipment_crm",
            database_user="equipment_user",
            is_frontend_backend_match=True,
            is_backend_database_local=True,
            status="healthy",
            nodes=[],
            issues=[],
        ),
        process_count=1,
        warning_count=0,
        error_count=0,
    )
    monkeypatch.setattr(diagnostics_router, "get_diagnostics_summary", lambda: sample)

    assert TestClient(make_app(UserRole.viewer)).get("/api/v1/admin/diagnostics/summary").status_code == 403
    payload = TestClient(make_app(UserRole.admin)).get("/api/v1/admin/diagnostics/summary").json()
    assert payload["refresh_seconds"] == 3600
    assert payload["app_version"] == "v1.0.1"


def test_main_app_uses_shared_project_version():
    from app.main import app

    assert app.version == read_version()


def test_delete_and_kill_endpoints_require_admin(monkeypatch):
    monkeypatch.setattr(diagnostics_router, "delete_diagnostics_logs", lambda entry_ids: {"deleted_count": len(entry_ids), "missing_entry_ids": []})
    monkeypatch.setattr(diagnostics_router, "kill_diagnostics_process", lambda pid: {"pid": pid, "killed": True, "message": "ok"})

    viewer_client = TestClient(make_app(UserRole.viewer))
    assert viewer_client.post("/api/v1/admin/diagnostics/logs/delete", json={"entry_ids": ["a"]}).status_code == 403
    assert viewer_client.post("/api/v1/admin/diagnostics/processes/123/kill").status_code == 403


def test_postgres_checkpoint_is_low_signal():
    analysis = diagnostics_service.analyze_log_message("postgres", "2026-03-21 16:55:30 MSK checkpoint starting: time")
    assert analysis["is_low_signal"] is True
    assert analysis["summary"] == "PostgreSQL начал плановый checkpoint."


def test_runtime_log_retention_deletes_files_older_than_24_hours(tmp_path: Path):
    old_file = tmp_path / "backend" / "backend-old.log"
    fresh_file = tmp_path / "backend" / "backend-fresh.log"
    old_file.parent.mkdir(parents=True, exist_ok=True)
    old_file.write_text("old", encoding="utf-8")
    fresh_file.write_text("fresh", encoding="utf-8")

    now = datetime(2026, 3, 21, 12, 0, tzinfo=UTC)
    import os

    old_timestamp = (now - timedelta(hours=25)).timestamp()
    fresh_timestamp = (now - timedelta(hours=3)).timestamp()
    os.utime(old_file, (old_timestamp, old_timestamp))
    os.utime(fresh_file, (fresh_timestamp, fresh_timestamp))

    diagnostics_service.ensure_runtime_log_retention(tmp_path, retention_hours=24, now=now)
    assert not old_file.exists()
    assert fresh_file.exists()


def test_runtime_log_retention_trims_to_300_lines(tmp_path: Path):
    log_file = tmp_path / "backend" / "backend.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)
    log_file.write_text("".join(f"line {index}\n" for index in range(1, 351)), encoding="utf-8")

    diagnostics_service.ensure_runtime_log_retention(tmp_path, retention_hours=24, now=datetime(2026, 3, 21, 12, 0, tzinfo=UTC))

    lines = log_file.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 300
    assert lines[0] == "line 51"
    assert lines[-1] == "line 350"


def test_delete_diagnostics_logs_removes_only_selected_entries(tmp_path: Path):
    log_file = tmp_path / "backend.log"
    log_file.write_text("line one\nline two\nline three\n", encoding="utf-8")
    entry_id = diagnostics_service.build_entry_id("backend", log_file, 2, "line two")

    result = diagnostics_service.delete_diagnostics_logs([entry_id])
    remaining = log_file.read_text(encoding="utf-8")

    assert result.deleted_count == 1
    assert result.missing_entry_ids == []
    assert "line one" in remaining
    assert "line three" in remaining
    assert "line two" not in remaining


def test_kill_diagnostics_process_rejects_non_orphan(monkeypatch):
    monkeypatch.setattr(
        diagnostics_service,
        "collect_processes",
        lambda: [
            DiagnosticsProcessOut(
                pid=555,
                parent_pid=10,
                name="python.exe",
                service="backend",
                status="running",
                command_line="python app.py",
                executable=None,
                started_at=datetime(2026, 3, 21, 11, 0, tzinfo=UTC),
                uptime_seconds=60,
                ports=[8000],
                role="uvicorn_worker",
                source_kind="local_process",
                runtime_root_pid=555,
                is_primary_runtime=True,
                is_auxiliary_runtime=False,
                explanation="Backend worker",
                suspicious_reasons=[],
                can_kill=False,
            )
        ],
    )

    try:
        diagnostics_service.kill_diagnostics_process(555)
        assert False, "Expected HTTPException"
    except Exception as exc:  # noqa: BLE001
        assert getattr(exc, "status_code", None) == 409


def test_frontend_relative_api_matches_public_backend():
    assert diagnostics_service.frontend_api_matches_backend("/api/v1", "http://10.60.84.173/api/v1") is True


def test_collect_services_accepts_container_peer_runtime(monkeypatch):
    monkeypatch.setattr(diagnostics_service.settings, "frontend_runtime_host", "frontend")
    monkeypatch.setattr(diagnostics_service.settings, "frontend_runtime_port", 80)
    monkeypatch.setattr(diagnostics_service.settings, "frontend_runtime_url", "http://frontend")
    monkeypatch.setattr(diagnostics_service.settings, "backend_runtime_host", "0.0.0.0")
    monkeypatch.setattr(diagnostics_service.settings, "backend_runtime_port", 8000)
    monkeypatch.setattr(diagnostics_service.settings, "backend_runtime_url", "http://127.0.0.1:8000")
    monkeypatch.setattr(diagnostics_service.settings, "db_host", "postgres")
    monkeypatch.setattr(diagnostics_service.settings, "db_port", 5432)
    monkeypatch.setattr(diagnostics_service, "detect_docker_runtime", lambda: (True, ["docker"], {"frontend": True, "backend": True, "postgres": True}))
    monkeypatch.setattr(
        diagnostics_service,
        "safe_http_ok",
        lambda url: True if url in {"http://frontend", "http://127.0.0.1:8000/health"} else None,
    )

    ports = [
        DiagnosticsPortOut(
            port=8000,
            host="0.0.0.0",
            state="listen",
            pid=10,
            process_name="python",
            command_line="python -m app",
            service="backend",
            detected_service="backend",
            port_role="backend_primary",
            owner_role="uvicorn_worker",
            source_kind="local_process",
            is_primary_listener=True,
            issues=[],
        )
    ]
    processes = [
        DiagnosticsProcessOut(
            pid=10,
            parent_pid=1,
            name="python",
            service="backend",
            status="running",
            command_line="python -m app",
            executable=None,
            started_at=datetime(2026, 4, 4, 8, 0, tzinfo=UTC),
            uptime_seconds=30,
            ports=[8000],
            role="uvicorn_worker",
            source_kind="local_process",
            runtime_root_pid=10,
            is_primary_runtime=True,
            is_auxiliary_runtime=False,
            explanation="Backend worker",
            suspicious_reasons=[],
            can_kill=False,
        )
    ]

    services = diagnostics_service.collect_services(ports, processes)
    service_map = {item.service: item for item in services}

    assert service_map["frontend"].status == "healthy"
    assert "listener_missing" not in service_map["frontend"].issues
    assert service_map["postgres"].status == "healthy"
    assert "listener_missing" not in service_map["postgres"].issues
