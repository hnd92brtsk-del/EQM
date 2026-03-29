from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Pagination


DiagnosticsStatus = Literal["healthy", "warning", "critical", "unknown"]
DiagnosticsSeverity = Literal["warning", "critical"]
DiagnosticsSource = Literal["server", "postgres", "backend", "frontend"]
DiagnosticsCommandEnvironment = Literal["local", "nginx", "docker"]
DiagnosticsEnvironmentMode = Literal["local", "docker", "nginx", "mixed", "unknown"]
DiagnosticsSourceKind = Literal["local_process", "docker_container", "proxy", "config", "unknown"]


class DiagnosticsCommandGroupOut(BaseModel):
    environment: DiagnosticsCommandEnvironment
    title: str
    commands: list[str] = Field(default_factory=list)
    warning: str | None = None


class DiagnosticsPortOut(BaseModel):
    port: int
    host: str
    state: str
    pid: int | None = None
    process_name: str | None = None
    command_line: str | None = None
    service: str | None = None
    detected_service: str | None = None
    port_role: str | None = None
    owner_role: str | None = None
    source_kind: DiagnosticsSourceKind = "local_process"
    is_primary_listener: bool = False
    explanation: str | None = None
    issues: list[str] = Field(default_factory=list)


class DiagnosticsProcessOut(BaseModel):
    pid: int
    parent_pid: int | None = None
    name: str
    service: str | None = None
    status: str | None = None
    command_line: str | None = None
    executable: str | None = None
    started_at: datetime | None = None
    uptime_seconds: int | None = None
    ports: list[int] = Field(default_factory=list)
    role: str | None = None
    source_kind: DiagnosticsSourceKind = "local_process"
    runtime_root_pid: int | None = None
    is_primary_runtime: bool = False
    is_auxiliary_runtime: bool = False
    explanation: str | None = None
    suspicious_reasons: list[str] = Field(default_factory=list)
    can_kill: bool = False


class DiagnosticsServiceOut(BaseModel):
    service: str
    display_name: str
    status: DiagnosticsStatus
    port: int | None = None
    host: str | None = None
    listener_pid: int | None = None
    http_ok: bool | None = None
    process_count: int = 0
    process_count_total: int = 0
    process_count_primary: int = 0
    process_count_auxiliary: int = 0
    warning_count: int = 0
    error_count: int = 0
    issues: list[str] = Field(default_factory=list)
    checked_at: datetime


class DiagnosticsDatabaseTableOut(BaseModel):
    table_name: str
    row_count: int = 0
    table_bytes: int = 0
    index_bytes: int = 0
    total_bytes: int = 0


class DiagnosticsDatabaseOverviewOut(BaseModel):
    database_name: str
    host: str
    port: int
    user: str
    database_bytes: int = 0
    table_count: int = 0
    total_rows: int = 0
    tables: list[DiagnosticsDatabaseTableOut] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


class DiagnosticsRuntimeNodeOut(BaseModel):
    key: str
    label: str
    source_kind: DiagnosticsSourceKind = "unknown"
    endpoint: str | None = None
    target: str | None = None
    status: DiagnosticsStatus = "unknown"
    details: list[str] = Field(default_factory=list)


class DiagnosticsRuntimeTopologyOut(BaseModel):
    environment_mode: DiagnosticsEnvironmentMode = "unknown"
    public_entrypoint: str | None = None
    frontend_url: str
    frontend_api_base: str
    backend_base_url: str
    backend_http_url: str | None = None
    backend_listener_pid: int | None = None
    backend_listener_port: int | None = None
    backend_http_ok: bool | None = None
    database_dsn: str
    database_host: str
    database_port: int
    database_name: str
    database_user: str
    is_frontend_backend_match: bool = True
    is_backend_database_local: bool = True
    status: DiagnosticsStatus = "unknown"
    nodes: list[DiagnosticsRuntimeNodeOut] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


class DiagnosticsSummaryOut(BaseModel):
    app_version: str
    checked_at: datetime
    host: str
    refresh_seconds: int = 3600
    environment_mode: DiagnosticsEnvironmentMode = "unknown"
    public_entrypoint: str | None = None
    services: list[DiagnosticsServiceOut] = Field(default_factory=list)
    ports: list[DiagnosticsPortOut] = Field(default_factory=list)
    database_overview: DiagnosticsDatabaseOverviewOut
    runtime_topology: DiagnosticsRuntimeTopologyOut
    process_count: int = 0
    warning_count: int = 0
    error_count: int = 0


class DiagnosticsLogEntryOut(BaseModel):
    id: str
    entry_id: str
    source: DiagnosticsSource
    severity: DiagnosticsSeverity
    signature: str
    category: str
    summary: str
    normalized_message: str | None = None
    raw_message: str
    observed_at: datetime | None = None
    file_path: str | None = None
    line_number: int | None = None
    is_low_signal: bool = False
    can_delete: bool = True
    possible_causes: list[str] = Field(default_factory=list)
    suggested_actions: list[str] = Field(default_factory=list)
    suggested_commands: list[DiagnosticsCommandGroupOut] = Field(default_factory=list)


class DiagnosticsLogsPageOut(Pagination[DiagnosticsLogEntryOut]):
    pass


class DiagnosticsDeleteLogsIn(BaseModel):
    entry_ids: list[str] = Field(default_factory=list, min_length=1)


class DiagnosticsDeleteLogsOut(BaseModel):
    deleted_count: int = 0
    missing_entry_ids: list[str] = Field(default_factory=list)


class DiagnosticsProcessKillOut(BaseModel):
    pid: int
    killed: bool
    message: str
