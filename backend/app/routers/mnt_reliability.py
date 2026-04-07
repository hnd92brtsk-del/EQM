from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, extract

from app.core.access import SpaceKey, require_space_access
from app.core.dependencies import get_db
from app.models.core import Cabinet, EquipmentType
from app.models.maintenance import MntIncident, MntIncidentComponent, MntOperatingTime
from app.models.security import User
from app.schemas.maintenance import FailureTrendPoint, ReliabilitySummary, TopFailure

router = APIRouter()

_read = require_space_access(SpaceKey.maintenance, "read")


@router.get("/summary", response_model=list[ReliabilitySummary])
def reliability_summary(
    cabinet_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db=Depends(get_db),
    user: User = Depends(_read),
):
    # Build incident counts
    inc_q = (
        select(
            MntIncident.cabinet_id,
            func.count(MntIncident.id).label("total_incidents"),
            func.avg(
                extract("epoch", MntIncident.resolved_at) - extract("epoch", MntIncident.repair_started_at)
            ).label("avg_repair_seconds"),
            func.sum(MntIncident.downtime_hours).label("total_downtime"),
        )
        .where(MntIncident.is_deleted == False)
        .group_by(MntIncident.cabinet_id)
    )
    if cabinet_id:
        inc_q = inc_q.where(MntIncident.cabinet_id == cabinet_id)
    if date_from:
        inc_q = inc_q.where(MntIncident.occurred_at >= date_from)
    if date_to:
        inc_q = inc_q.where(MntIncident.occurred_at <= date_to)

    inc_rows = {row[0]: row for row in db.execute(inc_q).all()}

    # Build operating hours
    op_q = (
        select(
            MntOperatingTime.cabinet_id,
            func.sum(MntOperatingTime.operating_hours).label("total_op_hours"),
        )
        .group_by(MntOperatingTime.cabinet_id)
    )
    if cabinet_id:
        op_q = op_q.where(MntOperatingTime.cabinet_id == cabinet_id)
    if date_from:
        op_q = op_q.where(MntOperatingTime.recorded_date >= date_from)
    if date_to:
        op_q = op_q.where(MntOperatingTime.recorded_date <= date_to)

    op_rows = {row[0]: float(row[1] or 0) for row in db.execute(op_q).all()}

    # Merge
    cab_ids = set(inc_rows.keys()) | set(op_rows.keys())
    if not cab_ids:
        return []

    cabs = {c.id: c.name for c in db.scalars(select(Cabinet).where(Cabinet.id.in_(cab_ids))).all()}

    results = []
    for cid in sorted(cab_ids):
        inc_data = inc_rows.get(cid)
        total_incidents = int(inc_data[1]) if inc_data else 0
        avg_repair_sec = float(inc_data[2]) if inc_data and inc_data[2] else None
        total_downtime = float(inc_data[3]) if inc_data and inc_data[3] else 0.0
        total_op = op_rows.get(cid, 0.0)

        mtbf = (total_op / total_incidents) if total_incidents > 0 and total_op > 0 else None
        mttr = (avg_repair_sec / 3600.0) if avg_repair_sec else None
        availability = None
        if mtbf is not None and mttr is not None and (mtbf + mttr) > 0:
            availability = round(mtbf / (mtbf + mttr) * 100, 2)

        results.append(ReliabilitySummary(
            cabinet_id=cid,
            cabinet_name=cabs.get(cid),
            total_incidents=total_incidents,
            total_operating_hours=round(total_op, 2),
            total_downtime_hours=round(total_downtime, 2),
            mtbf_hours=round(mtbf, 2) if mtbf else None,
            mttr_hours=round(mttr, 2) if mttr else None,
            availability_pct=availability,
        ))
    return results


@router.get("/failure-trend", response_model=list[FailureTrendPoint])
def failure_trend(
    cabinet_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db=Depends(get_db),
    user: User = Depends(_read),
):
    q = (
        select(
            func.to_char(MntIncident.occurred_at, "YYYY-MM").label("period"),
            func.count(MntIncident.id).label("cnt"),
        )
        .where(MntIncident.is_deleted == False)
        .group_by(func.to_char(MntIncident.occurred_at, "YYYY-MM"))
        .order_by(func.to_char(MntIncident.occurred_at, "YYYY-MM"))
    )
    if cabinet_id:
        q = q.where(MntIncident.cabinet_id == cabinet_id)
    if date_from:
        q = q.where(MntIncident.occurred_at >= date_from)
    if date_to:
        q = q.where(MntIncident.occurred_at <= date_to)

    return [FailureTrendPoint(period=row[0], incident_count=int(row[1])) for row in db.execute(q).all()]


@router.get("/top-failures", response_model=list[TopFailure])
def top_failures(
    limit: int = 10,
    cabinet_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db=Depends(get_db),
    user: User = Depends(_read),
):
    q = (
        select(
            MntIncidentComponent.equipment_type_id,
            func.count(MntIncidentComponent.id).label("cnt"),
        )
        .join(MntIncident, MntIncidentComponent.incident_id == MntIncident.id)
        .where(MntIncident.is_deleted == False)
        .where(MntIncidentComponent.equipment_type_id.isnot(None))
        .group_by(MntIncidentComponent.equipment_type_id)
        .order_by(func.count(MntIncidentComponent.id).desc())
        .limit(limit)
    )
    if cabinet_id:
        q = q.where(MntIncident.cabinet_id == cabinet_id)
    if date_from:
        q = q.where(MntIncident.occurred_at >= date_from)
    if date_to:
        q = q.where(MntIncident.occurred_at <= date_to)

    rows = db.execute(q).all()
    et_ids = [r[0] for r in rows]
    et_map = {}
    if et_ids:
        et_map = {e.id: e.name for e in db.scalars(select(EquipmentType).where(EquipmentType.id.in_(et_ids))).all()}

    return [
        TopFailure(equipment_type_id=r[0], equipment_type_name=et_map.get(r[0]), incident_count=int(r[1]))
        for r in rows
    ]
