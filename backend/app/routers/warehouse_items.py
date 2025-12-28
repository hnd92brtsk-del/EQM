from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, cast, Numeric
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_sort, apply_date_filters, apply_search
from app.core.audit import add_audit_log, model_to_dict
from app.models.operations import WarehouseItem
from app.models.core import Warehouse, EquipmentType, Manufacturer, EquipmentCategory
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.warehouse_items import WarehouseItemOut, WarehouseItemCreate, WarehouseItemUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[WarehouseItemOut])
def list_warehouse_items(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    warehouse_id: int | None = None,
    equipment_type_id: int | None = None,
    manufacturer_id: int | None = None,
    equipment_category_id: int | None = None,
    unit_price_rub_min: float | None = None,
    unit_price_rub_max: float | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = (
        select(WarehouseItem)
        .join(EquipmentType, WarehouseItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .outerjoin(EquipmentCategory, EquipmentType.equipment_category_id == EquipmentCategory.id)
        .options(
            selectinload(WarehouseItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(WarehouseItem.equipment_type).selectinload(EquipmentType.equipment_category),
        )
    )
    if is_deleted is None:
        if not include_deleted:
            query = query.where(WarehouseItem.is_deleted == False)
    else:
        query = query.where(WarehouseItem.is_deleted == is_deleted)
    if warehouse_id:
        query = query.where(WarehouseItem.warehouse_id == warehouse_id)
    if equipment_type_id:
        query = query.where(WarehouseItem.equipment_type_id == equipment_type_id)
    if manufacturer_id:
        query = query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if equipment_category_id:
        query = query.where(EquipmentType.equipment_category_id == equipment_category_id)

    unit_price_expr = cast(EquipmentType.meta_data["unit_price_rub"].astext, Numeric)
    if unit_price_rub_min is not None:
        query = query.where(unit_price_expr >= unit_price_rub_min)
    if unit_price_rub_max is not None:
        query = query.where(unit_price_expr <= unit_price_rub_max)

    if q:
        if q.isdigit():
            query = query.where(
                (WarehouseItem.warehouse_id == int(q)) | (WarehouseItem.equipment_type_id == int(q))
            )
        else:
            query = apply_search(
                query,
                q,
                [EquipmentType.name, Manufacturer.name, EquipmentCategory.name],
            )

    query = apply_date_filters(query, WarehouseItem, created_at_from, created_at_to, updated_at_from, updated_at_to)
    if sort:
        sort_field = sort.lstrip("-")
        sort_map = {
            "equipment_type_name": EquipmentType.name,
            "equipment_category_name": EquipmentCategory.name,
            "manufacturer_name": Manufacturer.name,
            "unit_price_rub": unit_price_expr,
        }
        if sort_field in sort_map:
            column = sort_map[sort_field]
            query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
        else:
            query = apply_sort(query, WarehouseItem, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{item_id}", response_model=WarehouseItemOut)
def get_warehouse_item(
    item_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(WarehouseItem).where(WarehouseItem.id == item_id)
    if not include_deleted:
        query = query.where(WarehouseItem.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="Warehouse item not found")
    return item


@router.post("/", response_model=WarehouseItemOut)
def create_warehouse_item(
    payload: WarehouseItemCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == payload.warehouse_id, Warehouse.is_deleted == False))
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    equipment = db.scalar(
        select(EquipmentType).where(EquipmentType.id == payload.equipment_type_id, EquipmentType.is_deleted == False)
    )
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment type not found")

    item = db.scalar(
        select(WarehouseItem).where(
            WarehouseItem.warehouse_id == payload.warehouse_id,
            WarehouseItem.equipment_type_id == payload.equipment_type_id,
        )
    )
    action = "CREATE"
    before = None
    if item:
        before = model_to_dict(item)
        item.quantity = payload.quantity
        item.is_deleted = False
        item.deleted_at = None
        item.deleted_by_id = None
        action = "UPDATE"
    else:
        item = WarehouseItem(
            warehouse_id=payload.warehouse_id,
            equipment_type_id=payload.equipment_type_id,
            quantity=payload.quantity,
        )
        db.add(item)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action=action,
        entity="warehouse_items",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=WarehouseItemOut)
def update_warehouse_item(
    item_id: int,
    payload: WarehouseItemUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(WarehouseItem).where(WarehouseItem.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Warehouse item not found")

    before = model_to_dict(item)
    if payload.quantity is not None:
        item.quantity = payload.quantity

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="warehouse_items",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=WarehouseItemOut)
def update_warehouse_item_legacy(
    item_id: int,
    payload: WarehouseItemUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_warehouse_item(item_id, payload, db, current_user)


@router.delete("/{item_id}")
def delete_warehouse_item(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(WarehouseItem).where(WarehouseItem.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Warehouse item not found")

    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="warehouse_items",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{item_id}/restore", response_model=WarehouseItemOut)
def restore_warehouse_item(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(WarehouseItem).where(WarehouseItem.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Warehouse item not found")

    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="warehouse_items",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item
