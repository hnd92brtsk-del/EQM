from datetime import UTC, date, datetime, time

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_admin
from app.schemas.diagnostics import (
    DiagnosticsDeleteLogsIn,
    DiagnosticsDeleteLogsOut,
    DiagnosticsLogsPageOut,
    DiagnosticsPortOut,
    DiagnosticsProcessKillOut,
    DiagnosticsProcessOut,
    DiagnosticsSummaryOut,
)
from app.services.diagnostics import (
    delete_diagnostics_logs,
    get_diagnostics_logs,
    get_diagnostics_ports,
    get_diagnostics_processes,
    get_diagnostics_summary,
    kill_diagnostics_process,
)

router = APIRouter()


@router.get("/summary", response_model=DiagnosticsSummaryOut)
def diagnostics_summary(_user=Depends(require_admin())):
    return get_diagnostics_summary()


@router.get("/ports", response_model=list[DiagnosticsPortOut])
def diagnostics_ports(_user=Depends(require_admin())):
    return get_diagnostics_ports()


@router.get("/processes", response_model=list[DiagnosticsProcessOut])
def diagnostics_processes(_user=Depends(require_admin())):
    return get_diagnostics_processes()


@router.get("/logs", response_model=DiagnosticsLogsPageOut)
def diagnostics_logs(
    source: str | None = None,
    severity: str | None = None,
    q: str | None = None,
    include_low_signal: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    _user=Depends(require_admin()),
):
    return get_diagnostics_logs(
        source=source,
        severity=severity,
        q=q,
        include_low_signal=include_low_signal,
        date_from=datetime.combine(date_from, time.min, UTC) if date_from else None,
        date_to=datetime.combine(date_to, time.max, UTC) if date_to else None,
        page=page,
        page_size=page_size,
    )


@router.post("/logs/delete", response_model=DiagnosticsDeleteLogsOut)
def diagnostics_delete_logs(payload: DiagnosticsDeleteLogsIn, _user=Depends(require_admin())):
    return delete_diagnostics_logs(payload.entry_ids)


@router.post("/processes/{pid}/kill", response_model=DiagnosticsProcessKillOut)
def diagnostics_kill_process(pid: int, _user=Depends(require_admin())):
    return kill_diagnostics_process(pid)
