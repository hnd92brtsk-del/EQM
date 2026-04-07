from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.core.access import SpaceKey, require_space_access
from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_text_filter
from app.models.core import Cabinet
from app.models.maintenance import MntIncident, MntIncidentComponent
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.maintenance import (
    IncidentComponentCreate,
    IncidentComponentOut,
    IncidentCreate,
    IncidentOut,
    IncidentUpdate,
)

router = APIRouter()

_read = require_space_access(SpaceKey.maintenance, "read")
_write = require_space_access(SpaceKey.maintenance, "write")


def _next_incident_number(db) -> str:
    year = datetime.utcnow().year
    prefix = f"INC-{year}-"
    last = db.scalar(
        select(MntIncident.incident_number)
        .where(MntIncident.incident_number.like(f"{prefix}%"))
        .order_by(MntIncident.incident_number.desc())
        .limit(1)
    )
    seq = 1
    if last:
        try:
            seq = int(last.replace(prefix, "")) + 1
        except ValueError:
            pass
    return f"{prefix}{seq:04d}"


def _enrich_incident(inc: MntIncident):
    inc.cabinet_name = inc.cabinet.name if inc.cabinet else None
    inc.reported_by_username = inc.reported_by.username if inc.reported_by else None
    inc.failure_mode_name = inc.failure_mode.name if inc.failure_mode else None
    inc.failure_mechanism_name = inc.failure_mechanism.name if inc.failure_mechanism else None
    inc.failure_cause_name = inc.failure_cause.name if inc.failure_cause else None
    inc.detection_method_name = inc.detection_method.name if inc.detection_method else None
    return inc


@router.get("/", response_model=Pagination[IncidentOut])
def list_incidents(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    cabinet_id: int | None = None,
    status: str | None = None,
    severity: str | None = None,
    occurred_at_from: datetime | None = None,
    occurred_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(_read),
):
    query = (
        select(MntIncident)
        .options(
            joinedload(MntIncident.cabinet),
            joinedload(MntIncident.reported_by),
            joinedload(MntIncident.failure_mode),
            joinedload(MntIncident.failure_mechanism),
            joinedload(MntIncident.failure_cause),
            joinedload(MntIncident.detection_method),
        )
    )
    if not include_deleted:
        query = query.where(MntIncident.is_deleted == False)
    if cabinet_id is not None:
        query = query.where(MntIncident.cabinet_id == cabinet_id)
    if status:
        query = query.where(MntIncident.status == status)
    if severity:
        query = query.where(MntIncident.severity == severity)
    if occurred_at_from:
        query = query.where(MntIncident.occurred_at >= occurred_at_from)
    if occurred_at_to:
        query = query.where(MntIncident.occurred_at <= occurred_at_to)
    query = apply_search(query, q, [MntIncident.title])
    query = apply_sort(query, MntIncident, sort) if sort else query.order_by(MntIncident.id.desc())

    total, items = paginate(query, db, page, page_size)
    for item in items:
        _enrich_incident(item)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: int, db=Depends(get_db), user: User = Depends(_read)):
    inc = db.scalar(
        select(MntIncident)
        .options(
            joinedload(MntIncident.cabinet),
            joinedload(MntIncident.reported_by),
            joinedload(MntIncident.failure_mode),
            joinedload(MntIncident.failure_mechanism),
            joinedload(MntIncident.failure_cause),
            joinedload(MntIncident.detection_method),
        )
        .where(MntIncident.id == incident_id)
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _enrich_incident(inc)


@router.post("/", response_model=IncidentOut)
def create_incident(
    payload: IncidentCreate,
    db=Depends(get_db),
    user: User = Depends(_write),
):
    cabinet = db.scalar(select(Cabinet).where(Cabinet.id == payload.cabinet_id, Cabinet.is_deleted == False))
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")

    inc = MntIncident(
        incident_number=_next_incident_number(db),
        cabinet_id=payload.cabinet_id,
        location_id=payload.location_id or cabinet.location_id,
        severity=payload.severity,
        detection_method_id=payload.detection_method_id,
        failure_mode_id=payload.failure_mode_id,
        failure_mechanism_id=payload.failure_mechanism_id,
        failure_cause_id=payload.failure_cause_id,
        occurred_at=payload.occurred_at,
        detected_at=payload.detected_at,
        title=payload.title,
        description=payload.description,
        operational_impact=payload.operational_impact,
        assigned_to_id=payload.assigned_to_id,
        reported_by_id=user.id,
        status="open",
    )
    db.add(inc)
    db.flush()

    if payload.components:
        for comp in payload.components:
            db.add(MntIncidentComponent(
                incident_id=inc.id,
                cabinet_item_id=comp.cabinet_item_id,
                equipment_type_id=comp.equipment_type_id,
                failure_mode_id=comp.failure_mode_id,
                damage_description=comp.damage_description,
                action_taken=comp.action_taken,
            ))
        db.flush()

    add_audit_log(db, actor_id=user.id, action="CREATE", entity="mnt_incidents", entity_id=inc.id, after=model_to_dict(inc))
    db.commit()
    db.refresh(inc)
    return _enrich_incident(inc)


@router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db=Depends(get_db),
    user: User = Depends(_write),
):
    inc = db.scalar(
        select(MntIncident)
        .options(
            joinedload(MntIncident.cabinet),
            joinedload(MntIncident.reported_by),
            joinedload(MntIncident.failure_mode),
            joinedload(MntIncident.failure_mechanism),
            joinedload(MntIncident.failure_cause),
            joinedload(MntIncident.detection_method),
        )
        .where(MntIncident.id == incident_id)
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    before = model_to_dict(inc)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(inc, k, v)

    add_audit_log(db, actor_id=user.id, action="UPDATE", entity="mnt_incidents", entity_id=inc.id, before=before, after=model_to_dict(inc))
    db.commit()
    db.refresh(inc)
    return _enrich_incident(inc)


@router.delete("/{incident_id}")
def delete_incident(incident_id: int, db=Depends(get_db), user: User = Depends(_write)):
    inc = db.scalar(select(MntIncident).where(MntIncident.id == incident_id))
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    before = model_to_dict(inc)
    inc.is_deleted = True
    inc.deleted_at = datetime.utcnow()
    inc.deleted_by_id = user.id
    add_audit_log(db, actor_id=user.id, action="DELETE", entity="mnt_incidents", entity_id=inc.id, before=before, after=model_to_dict(inc))
    db.commit()
    return {"status": "ok"}


@router.post("/{incident_id}/restore", response_model=IncidentOut)
def restore_incident(incident_id: int, db=Depends(get_db), user: User = Depends(_write)):
    inc = db.scalar(
        select(MntIncident)
        .options(
            joinedload(MntIncident.cabinet),
            joinedload(MntIncident.reported_by),
            joinedload(MntIncident.failure_mode),
            joinedload(MntIncident.failure_mechanism),
            joinedload(MntIncident.failure_cause),
            joinedload(MntIncident.detection_method),
        )
        .where(MntIncident.id == incident_id)
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    before = model_to_dict(inc)
    inc.is_deleted = False
    inc.deleted_at = None
    inc.deleted_by_id = None
    add_audit_log(db, actor_id=user.id, action="RESTORE", entity="mnt_incidents", entity_id=inc.id, before=before, after=model_to_dict(inc))
    db.commit()
    db.refresh(inc)
    return _enrich_incident(inc)


# ---- Components sub-resource ------------------------------------------------

@router.get("/{incident_id}/components", response_model=list[IncidentComponentOut])
def list_incident_components(incident_id: int, db=Depends(get_db), user: User = Depends(_read)):
    inc = db.scalar(select(MntIncident).where(MntIncident.id == incident_id))
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    items = db.scalars(
        select(MntIncidentComponent)
        .where(MntIncidentComponent.incident_id == incident_id)
        .order_by(MntIncidentComponent.id)
    ).all()
    results = []
    for c in items:
        ci = c.cabinet_item
        results.append(IncidentComponentOut(
            id=c.id,
            incident_id=c.incident_id,
            cabinet_item_id=c.cabinet_item_id,
            equipment_type_id=c.equipment_type_id,
            failure_mode_id=c.failure_mode_id,
            damage_description=c.damage_description,
            action_taken=c.action_taken,
            equipment_type_name=ci.equipment_type.name if ci and ci.equipment_type else None,
            failure_mode_name=c.failure_mode.name if hasattr(c, 'failure_mode') and c.failure_mode_id else None,
            created_at=c.created_at,
        ))
    return results


@router.post("/{incident_id}/components", response_model=IncidentComponentOut)
def add_incident_component(incident_id: int, payload: IncidentComponentCreate, db=Depends(get_db), user: User = Depends(_write)):
    inc = db.scalar(select(MntIncident).where(MntIncident.id == incident_id))
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    comp = MntIncidentComponent(
        incident_id=incident_id,
        cabinet_item_id=payload.cabinet_item_id,
        equipment_type_id=payload.equipment_type_id,
        failure_mode_id=payload.failure_mode_id,
        damage_description=payload.damage_description,
        action_taken=payload.action_taken,
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    ci = comp.cabinet_item
    return IncidentComponentOut(
        id=comp.id,
        incident_id=comp.incident_id,
        cabinet_item_id=comp.cabinet_item_id,
        equipment_type_id=comp.equipment_type_id,
        failure_mode_id=comp.failure_mode_id,
        damage_description=comp.damage_description,
        action_taken=comp.action_taken,
        equipment_type_name=ci.equipment_type.name if ci and ci.equipment_type else None,
        failure_mode_name=None,
        created_at=comp.created_at,
    )


@router.delete("/{incident_id}/components/{component_id}")
def delete_incident_component(incident_id: int, component_id: int, db=Depends(get_db), user: User = Depends(_write)):
    comp = db.scalar(
        select(MntIncidentComponent).where(
            MntIncidentComponent.id == component_id,
            MntIncidentComponent.incident_id == incident_id,
        )
    )
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
    db.delete(comp)
    db.commit()
    return {"status": "ok"}
