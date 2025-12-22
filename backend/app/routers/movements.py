from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_sort
from app.core.audit import add_audit_log, model_to_dict
from app.models.movements import EquipmentMovement, MovementType
from app.models.operations import WarehouseItem, CabinetItem
from app.models.core import EquipmentType, Warehouse, Cabinet
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.movements import MovementOut, MovementCreate

router = APIRouter()


def get_or_create_warehouse_item(db, warehouse_id: int, equipment_type_id: int, for_update: bool):
    query = select(WarehouseItem).where(
        WarehouseItem.warehouse_id == warehouse_id,
        WarehouseItem.equipment_type_id == equipment_type_id,
        WarehouseItem.is_deleted == False,
    )
    if for_update:
        query = query.with_for_update()
    item = db.scalar(query)
    if not item:
        item = WarehouseItem(
            warehouse_id=warehouse_id,
            equipment_type_id=equipment_type_id,
            quantity=0,
        )
        db.add(item)
        db.flush()
    return item


def get_or_create_cabinet_item(db, cabinet_id: int, equipment_type_id: int, for_update: bool):
    query = select(CabinetItem).where(
        CabinetItem.cabinet_id == cabinet_id,
        CabinetItem.equipment_type_id == equipment_type_id,
        CabinetItem.is_deleted == False,
    )
    if for_update:
        query = query.with_for_update()
    item = db.scalar(query)
    if not item:
        item = CabinetItem(
            cabinet_id=cabinet_id,
            equipment_type_id=equipment_type_id,
            quantity=0,
        )
        db.add(item)
        db.flush()
    return item


def change_quantity(item, delta: int):
    new_value = (item.quantity or 0) + delta
    if new_value < 0:
        raise HTTPException(status_code=409, detail="Insufficient quantity")
    item.quantity = new_value
    if hasattr(item, "last_updated"):
        item.last_updated = datetime.utcnow()


@router.get("/", response_model=Pagination[MovementOut])
def list_movements(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    movement_type: MovementType | None = None,
    equipment_type_id: int | None = None,
    warehouse_id: int | None = None,
    cabinet_id: int | None = None,
    performed_by_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(EquipmentMovement)
    if movement_type:
        query = query.where(EquipmentMovement.movement_type == movement_type)
    if equipment_type_id:
        query = query.where(EquipmentMovement.equipment_type_id == equipment_type_id)
    if warehouse_id:
        query = query.where(
            (EquipmentMovement.from_warehouse_id == warehouse_id)
            | (EquipmentMovement.to_warehouse_id == warehouse_id)
        )
    if cabinet_id:
        query = query.where(
            (EquipmentMovement.from_cabinet_id == cabinet_id)
            | (EquipmentMovement.to_cabinet_id == cabinet_id)
        )
    if performed_by_id:
        query = query.where(EquipmentMovement.performed_by_id == performed_by_id)
    if created_at_from:
        query = query.where(EquipmentMovement.created_at >= created_at_from)
    if created_at_to:
        query = query.where(EquipmentMovement.created_at <= created_at_to)
    if q:
        query = query.where(
            (EquipmentMovement.reference.ilike(f"%{q}%"))
            | (EquipmentMovement.comment.ilike(f"%{q}%"))
        )

    query = apply_sort(query, EquipmentMovement, sort) if sort else query.order_by(EquipmentMovement.id.desc())

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=MovementOut)
def create_movement(
    payload: MovementCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    equipment_type = db.scalar(
        select(EquipmentType).where(EquipmentType.id == payload.equipment_type_id, EquipmentType.is_deleted == False)
    )
    if not equipment_type:
        raise HTTPException(status_code=404, detail="Equipment type not found")

    if payload.from_warehouse_id:
        from_wh = db.scalar(
            select(Warehouse).where(Warehouse.id == payload.from_warehouse_id, Warehouse.is_deleted == False)
        )
        if not from_wh:
            raise HTTPException(status_code=404, detail="Source warehouse not found")
    if payload.to_warehouse_id:
        to_wh = db.scalar(
            select(Warehouse).where(Warehouse.id == payload.to_warehouse_id, Warehouse.is_deleted == False)
        )
        if not to_wh:
            raise HTTPException(status_code=404, detail="Destination warehouse not found")
    if payload.from_cabinet_id:
        from_cb = db.scalar(
            select(Cabinet).where(Cabinet.id == payload.from_cabinet_id, Cabinet.is_deleted == False)
        )
        if not from_cb:
            raise HTTPException(status_code=404, detail="Source cabinet not found")
    if payload.to_cabinet_id:
        to_cb = db.scalar(
            select(Cabinet).where(Cabinet.id == payload.to_cabinet_id, Cabinet.is_deleted == False)
        )
        if not to_cb:
            raise HTTPException(status_code=404, detail="Destination cabinet not found")

    movement = EquipmentMovement(
        movement_type=MovementType(payload.movement_type),
        equipment_type_id=payload.equipment_type_id,
        quantity=payload.quantity,
        from_warehouse_id=payload.from_warehouse_id,
        to_warehouse_id=payload.to_warehouse_id,
        from_cabinet_id=payload.from_cabinet_id,
        to_cabinet_id=payload.to_cabinet_id,
        reference=payload.reference,
        comment=payload.comment,
        performed_by_id=current_user.id,
    )

    if movement.movement_type == MovementType.inbound:
        to_item = get_or_create_warehouse_item(db, payload.to_warehouse_id, payload.equipment_type_id, True)
        change_quantity(to_item, payload.quantity)
    elif movement.movement_type == MovementType.to_warehouse:
        to_item = get_or_create_warehouse_item(db, payload.to_warehouse_id, payload.equipment_type_id, True)
        change_quantity(to_item, payload.quantity)
    elif movement.movement_type == MovementType.transfer:
        from_item = get_or_create_warehouse_item(db, payload.from_warehouse_id, payload.equipment_type_id, True)
        to_item = get_or_create_warehouse_item(db, payload.to_warehouse_id, payload.equipment_type_id, True)
        change_quantity(from_item, -payload.quantity)
        change_quantity(to_item, payload.quantity)
    elif movement.movement_type == MovementType.to_cabinet:
        from_item = get_or_create_warehouse_item(db, payload.from_warehouse_id, payload.equipment_type_id, True)
        to_item = get_or_create_cabinet_item(db, payload.to_cabinet_id, payload.equipment_type_id, True)
        change_quantity(from_item, -payload.quantity)
        change_quantity(to_item, payload.quantity)
    elif movement.movement_type == MovementType.from_cabinet:
        from_item = get_or_create_cabinet_item(db, payload.from_cabinet_id, payload.equipment_type_id, True)
        to_item = get_or_create_warehouse_item(db, payload.to_warehouse_id, payload.equipment_type_id, True)
        change_quantity(from_item, -payload.quantity)
        change_quantity(to_item, payload.quantity)
    elif movement.movement_type == MovementType.direct_to_cabinet:
        to_item = get_or_create_cabinet_item(db, payload.to_cabinet_id, payload.equipment_type_id, True)
        change_quantity(to_item, payload.quantity)
    elif movement.movement_type == MovementType.writeoff:
        if payload.from_warehouse_id and payload.from_cabinet_id:
            raise HTTPException(status_code=400, detail="Choose warehouse or cabinet for writeoff")
        if payload.from_warehouse_id:
            from_item = get_or_create_warehouse_item(db, payload.from_warehouse_id, payload.equipment_type_id, True)
            change_quantity(from_item, -payload.quantity)
        if payload.from_cabinet_id:
            from_item = get_or_create_cabinet_item(db, payload.from_cabinet_id, payload.equipment_type_id, True)
            change_quantity(from_item, -payload.quantity)
    elif movement.movement_type == MovementType.adjustment:
        ids = [
            payload.from_warehouse_id,
            payload.from_cabinet_id,
            payload.to_warehouse_id,
            payload.to_cabinet_id,
        ]
        if len([val for val in ids if val is not None]) != 1:
            raise HTTPException(status_code=400, detail="Adjustment requires exactly one target")
        if payload.from_warehouse_id:
            from_item = get_or_create_warehouse_item(db, payload.from_warehouse_id, payload.equipment_type_id, True)
            change_quantity(from_item, -payload.quantity)
        if payload.from_cabinet_id:
            from_item = get_or_create_cabinet_item(db, payload.from_cabinet_id, payload.equipment_type_id, True)
            change_quantity(from_item, -payload.quantity)
        if payload.to_warehouse_id:
            to_item = get_or_create_warehouse_item(db, payload.to_warehouse_id, payload.equipment_type_id, True)
            change_quantity(to_item, payload.quantity)
        if payload.to_cabinet_id:
            to_item = get_or_create_cabinet_item(db, payload.to_cabinet_id, payload.equipment_type_id, True)
            change_quantity(to_item, payload.quantity)

    db.add(movement)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="MOVEMENT",
        entity="equipment_movements",
        entity_id=movement.id,
        before=None,
        after=model_to_dict(movement),
    )

    db.commit()
    db.refresh(movement)
    return movement
