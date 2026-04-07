from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.access import SpaceKey, require_space_access
from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort
from app.models.core import Cabinet
from app.models.maintenance import MntWorkOrder, MntWorkOrderItem, MntActivityType
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.maintenance import (
    WorkOrderCreate,
    WorkOrderItemCreate,
    WorkOrderItemOut,
    WorkOrderOut,
    WorkOrderUpdate,
)

router = APIRouter()

_read = require_space_access(SpaceKey.maintenance, "read")
_write = require_space_access(SpaceKey.maintenance, "write")


def _next_order_number(db) -> str:
    year = datetime.utcnow().year
    prefix = f"WO-{year}-"
    last = db.scalar(
        select(MntWorkOrder.order_number)
        .where(MntWorkOrder.order_number.like(f"{prefix}%"))
        .order_by(MntWorkOrder.order_number.desc())
        .limit(1)
    )
    seq = 1
    if last:
        try:
            seq = int(last.replace(prefix, "")) + 1
        except ValueError:
            pass
    return f"{prefix}{seq:04d}"


def _enrich(wo: MntWorkOrder):
    wo.cabinet_name = wo.cabinet.name if wo.cabinet else None
    if wo.activity_type_id:
        at = getattr(wo, "_activity_type", None)
        wo.activity_type_name = at.name if at else None
    else:
        wo.activity_type_name = None
    return wo


@router.get("/", response_model=Pagination[WorkOrderOut])
def list_work_orders(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    cabinet_id: int | None = None,
    status: str | None = None,
    order_type: str | None = None,
    priority: str | None = None,
    db=Depends(get_db),
    user: User = Depends(_read),
):
    query = select(MntWorkOrder).options(joinedload(MntWorkOrder.cabinet))
    if not include_deleted:
        query = query.where(MntWorkOrder.is_deleted == False)
    if cabinet_id is not None:
        query = query.where(MntWorkOrder.cabinet_id == cabinet_id)
    if status:
        query = query.where(MntWorkOrder.status == status)
    if order_type:
        query = query.where(MntWorkOrder.order_type == order_type)
    if priority:
        query = query.where(MntWorkOrder.priority == priority)
    query = apply_search(query, q, [MntWorkOrder.title])
    query = apply_sort(query, MntWorkOrder, sort) if sort else query.order_by(MntWorkOrder.id.desc())

    total, items = paginate(query, db, page, page_size)

    at_ids = [i.activity_type_id for i in items if i.activity_type_id]
    at_map = {}
    if at_ids:
        at_map = {a.id: a for a in db.scalars(select(MntActivityType).where(MntActivityType.id.in_(at_ids))).all()}

    for item in items:
        item.cabinet_name = item.cabinet.name if item.cabinet else None
        at = at_map.get(item.activity_type_id)
        item.activity_type_name = at.name if at else None

    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{wo_id}", response_model=WorkOrderOut)
def get_work_order(wo_id: int, db=Depends(get_db), user: User = Depends(_read)):
    wo = db.scalar(
        select(MntWorkOrder).options(joinedload(MntWorkOrder.cabinet)).where(MntWorkOrder.id == wo_id)
    )
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.activity_type_id:
        at = db.scalar(select(MntActivityType).where(MntActivityType.id == wo.activity_type_id))
        wo.activity_type_name = at.name if at else None
    else:
        wo.activity_type_name = None
    wo.cabinet_name = wo.cabinet.name if wo.cabinet else None
    return wo


@router.post("/", response_model=WorkOrderOut)
def create_work_order(payload: WorkOrderCreate, db=Depends(get_db), user: User = Depends(_write)):
    if payload.cabinet_id:
        cab = db.scalar(select(Cabinet).where(Cabinet.id == payload.cabinet_id, Cabinet.is_deleted == False))
        if not cab:
            raise HTTPException(status_code=404, detail="Cabinet not found")

    wo = MntWorkOrder(
        order_number=_next_order_number(db),
        order_type=payload.order_type,
        activity_type_id=payload.activity_type_id,
        priority=payload.priority,
        status="planned",
        cabinet_id=payload.cabinet_id,
        incident_id=payload.incident_id,
        plan_id=payload.plan_id,
        planned_start_date=payload.planned_start_date,
        planned_end_date=payload.planned_end_date,
        estimated_man_hours=payload.estimated_man_hours,
        assigned_to_id=payload.assigned_to_id,
        performed_by_id=user.id,
        title=payload.title,
        description=payload.description,
    )
    db.add(wo)
    db.flush()

    if payload.items:
        for item in payload.items:
            db.add(MntWorkOrderItem(
                work_order_id=wo.id,
                cabinet_item_id=item.cabinet_item_id,
                equipment_type_id=item.equipment_type_id,
                action=item.action,
                quantity=item.quantity,
                notes=item.notes,
            ))
        db.flush()

    add_audit_log(db, actor_id=user.id, action="CREATE", entity="mnt_work_orders", entity_id=wo.id, after=model_to_dict(wo))
    db.commit()
    db.refresh(wo)
    wo.cabinet_name = wo.cabinet.name if wo.cabinet else None
    wo.activity_type_name = None
    if wo.activity_type_id:
        at = db.scalar(select(MntActivityType).where(MntActivityType.id == wo.activity_type_id))
        wo.activity_type_name = at.name if at else None
    return wo


@router.patch("/{wo_id}", response_model=WorkOrderOut)
def update_work_order(wo_id: int, payload: WorkOrderUpdate, db=Depends(get_db), user: User = Depends(_write)):
    wo = db.scalar(select(MntWorkOrder).options(joinedload(MntWorkOrder.cabinet)).where(MntWorkOrder.id == wo_id))
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    before = model_to_dict(wo)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(wo, k, v)
    add_audit_log(db, actor_id=user.id, action="UPDATE", entity="mnt_work_orders", entity_id=wo.id, before=before, after=model_to_dict(wo))
    db.commit()
    db.refresh(wo)
    wo.cabinet_name = wo.cabinet.name if wo.cabinet else None
    wo.activity_type_name = None
    if wo.activity_type_id:
        at = db.scalar(select(MntActivityType).where(MntActivityType.id == wo.activity_type_id))
        wo.activity_type_name = at.name if at else None
    return wo


@router.delete("/{wo_id}")
def delete_work_order(wo_id: int, db=Depends(get_db), user: User = Depends(_write)):
    wo = db.scalar(select(MntWorkOrder).where(MntWorkOrder.id == wo_id))
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    before = model_to_dict(wo)
    wo.is_deleted = True
    wo.deleted_at = datetime.utcnow()
    wo.deleted_by_id = user.id
    add_audit_log(db, actor_id=user.id, action="DELETE", entity="mnt_work_orders", entity_id=wo.id, before=before, after=model_to_dict(wo))
    db.commit()
    return {"status": "ok"}


@router.post("/{wo_id}/restore", response_model=WorkOrderOut)
def restore_work_order(wo_id: int, db=Depends(get_db), user: User = Depends(_write)):
    wo = db.scalar(select(MntWorkOrder).options(joinedload(MntWorkOrder.cabinet)).where(MntWorkOrder.id == wo_id))
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    before = model_to_dict(wo)
    wo.is_deleted = False
    wo.deleted_at = None
    wo.deleted_by_id = None
    add_audit_log(db, actor_id=user.id, action="RESTORE", entity="mnt_work_orders", entity_id=wo.id, before=before, after=model_to_dict(wo))
    db.commit()
    db.refresh(wo)
    wo.cabinet_name = wo.cabinet.name if wo.cabinet else None
    wo.activity_type_name = None
    return wo


# ---- Work Order Items -------------------------------------------------------

@router.get("/{wo_id}/items", response_model=list[WorkOrderItemOut])
def list_work_order_items(wo_id: int, db=Depends(get_db), user: User = Depends(_read)):
    wo = db.scalar(select(MntWorkOrder).where(MntWorkOrder.id == wo_id))
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    items = db.scalars(
        select(MntWorkOrderItem).where(MntWorkOrderItem.work_order_id == wo_id).order_by(MntWorkOrderItem.id)
    ).all()
    results = []
    for it in items:
        et_name = None
        if it.equipment_type_id:
            from app.models.core import EquipmentType
            et = db.scalar(select(EquipmentType).where(EquipmentType.id == it.equipment_type_id))
            et_name = et.name if et else None
        elif it.cabinet_item_id:
            ci = it.cabinet_item if hasattr(it, 'cabinet_item') else None
            if ci and ci.equipment_type:
                et_name = ci.equipment_type.name
        results.append(WorkOrderItemOut(
            id=it.id,
            work_order_id=it.work_order_id,
            cabinet_item_id=it.cabinet_item_id,
            equipment_type_id=it.equipment_type_id,
            action=it.action,
            quantity=it.quantity,
            notes=it.notes,
            equipment_type_name=et_name,
            created_at=it.created_at,
        ))
    return results


@router.post("/{wo_id}/items", response_model=WorkOrderItemOut)
def add_work_order_item(wo_id: int, payload: WorkOrderItemCreate, db=Depends(get_db), user: User = Depends(_write)):
    wo = db.scalar(select(MntWorkOrder).where(MntWorkOrder.id == wo_id))
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    item = MntWorkOrderItem(
        work_order_id=wo_id,
        cabinet_item_id=payload.cabinet_item_id,
        equipment_type_id=payload.equipment_type_id,
        action=payload.action,
        quantity=payload.quantity,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return WorkOrderItemOut(
        id=item.id, work_order_id=item.work_order_id, cabinet_item_id=item.cabinet_item_id,
        equipment_type_id=item.equipment_type_id, action=item.action, quantity=item.quantity,
        notes=item.notes, equipment_type_name=None, created_at=item.created_at,
    )


@router.delete("/{wo_id}/items/{item_id}")
def delete_work_order_item(wo_id: int, item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    item = db.scalar(
        select(MntWorkOrderItem).where(MntWorkOrderItem.id == item_id, MntWorkOrderItem.work_order_id == wo_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "ok"}
