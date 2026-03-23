from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Pagination


DiagnosticsStatus = Literal["healthy", "warning", "critical", "unknown"]
DiagnosticsSeverity = Literal["info", "warning", "error", "critical"]
DiagnosticsSource = Literal["server", "postgres", "backend", "frontend"]
DiagnosticsCommandEnvironment = Literal["local", "nginx", "docker"]


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
    warning_count: int = 0
    error_count: int = 0
    issues: list[str] = Field(default_factory=list)
    checked_at: datetime


class DiagnosticsSummaryOut(BaseModel):
    checked_at: datetime
    host: str
    refresh_seconds: int = 3600
    services: list[DiagnosticsServiceOut] = Field(default_factory=list)
    ports: list[DiagnosticsPortOut] = Field(default_factory=list)
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
