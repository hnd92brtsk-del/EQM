from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_sort, apply_date_filters, apply_search
from app.core.audit import add_audit_log, model_to_dict
from app.models.operations import AssemblyItem
from app.models.assemblies import Assembly
from app.models.core import EquipmentType, Manufacturer, Location
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.assembly_items import AssemblyItemOut, AssemblyItemCreate, AssemblyItemUpdate

router = APIRouter()

def should_force_quantity_one(equipment: EquipmentType) -> bool:
    return bool(
        equipment.is_network or equipment.is_channel_forming or equipment.has_serial_interfaces
    )


def build_location_full_path(location_id: int | None, locations_map: dict[int, Location]) -> str | None:
    if not location_id or location_id not in locations_map:
        return None
    parts: list[str] = []
    current_id: int | None = location_id
    seen: set[int] = set()
    while current_id and current_id in locations_map and current_id not in seen:
        location = locations_map[current_id]
        parts.append(location.name)
        seen.add(current_id)
        current_id = location.parent_id
    return " / ".join(reversed(parts))


def attach_location_full_path(items: list[AssemblyItem], db) -> None:
    locations = db.scalars(select(Location)).all()
    locations_map = {loc.id: loc for loc in locations}
    for item in items:
        location_id = item.assembly.location_id if item.assembly else None
        item.location_full_path = build_location_full_path(location_id, locations_map)


@router.get("/", response_model=Pagination[AssemblyItemOut])
def list_assembly_items(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    assembly_id: int | None = None,
    equipment_type_id: int | None = None,
    manufacturer_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = (
        select(AssemblyItem)
        .join(Assembly, AssemblyItem.assembly_id == Assembly.id)
        .join(EquipmentType, AssemblyItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .options(
            selectinload(AssemblyItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(AssemblyItem.assembly),
        )
    )
    if is_deleted is None:
        if not include_deleted:
            query = query.where(AssemblyItem.is_deleted == False)
    else:
        query = query.where(AssemblyItem.is_deleted == is_deleted)
    if assembly_id:
        query = query.where(AssemblyItem.assembly_id == assembly_id)
    if equipment_type_id:
        query = query.where(AssemblyItem.equipment_type_id == equipment_type_id)
    if manufacturer_id:
        query = query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if q:
        if q.isdigit():
            query = query.where(
                (AssemblyItem.assembly_id == int(q)) | (AssemblyItem.equipment_type_id == int(q))
            )
        else:
            query = apply_search(query, q, [EquipmentType.name, Manufacturer.name, Assembly.name])

    query = apply_date_filters(query, AssemblyItem, created_at_from, created_at_to, updated_at_from, updated_at_to)
    if sort:
        sort_field = sort.lstrip("-")
        sort_map = {
            "equipment_type_name": EquipmentType.name,
            "manufacturer_name": Manufacturer.name,
            "assembly_name": Assembly.name,
        }
        if sort_field in sort_map:
            column = sort_map[sort_field]
            query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
        else:
            query = apply_sort(query, AssemblyItem, sort)

    total, items = paginate(query, db, page, page_size)
    attach_location_full_path(items, db)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{item_id}", response_model=AssemblyItemOut)
def get_assembly_item(
    item_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(AssemblyItem).where(AssemblyItem.id == item_id)
    if not include_deleted:
        query = query.where(AssemblyItem.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="Assembly item not found")
    attach_location_full_path([item], db)
    return item


@router.post("/", response_model=AssemblyItemOut)
def create_assembly_item(
    payload: AssemblyItemCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    assembly = db.scalar(select(Assembly).where(Assembly.id == payload.assembly_id, Assembly.is_deleted == False))
    if not assembly:
        raise HTTPException(status_code=404, detail="Assembly not found")
    equipment = db.scalar(
        select(EquipmentType).where(EquipmentType.id == payload.equipment_type_id, EquipmentType.is_deleted == False)
    )
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment type not found")

    quantity = 1 if should_force_quantity_one(equipment) else payload.quantity
    item = db.scalar(
        select(AssemblyItem).where(
            AssemblyItem.assembly_id == payload.assembly_id,
            AssemblyItem.equipment_type_id == payload.equipment_type_id,
        )
    )
    action = "CREATE"
    before = None
    if item:
        before = model_to_dict(item)
        item.quantity = quantity
        item.is_deleted = False
        item.deleted_at = None
        item.deleted_by_id = None
        action = "UPDATE"
    else:
        item = AssemblyItem(
            assembly_id=payload.assembly_id,
            equipment_type_id=payload.equipment_type_id,
            quantity=quantity,
        )
        db.add(item)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action=action,
        entity="assembly_items",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    attach_location_full_path([item], db)
    return item


@router.patch("/{item_id}", response_model=AssemblyItemOut)
def update_assembly_item(
    item_id: int,
    payload: AssemblyItemUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(AssemblyItem).where(AssemblyItem.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Assembly item not found")

    equipment = db.scalar(select(EquipmentType).where(EquipmentType.id == item.equipment_type_id))
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment type not found")

    before = model_to_dict(item)
    if payload.quantity is not None:
        item.quantity = 1 if should_force_quantity_one(equipment) else payload.quantity

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="assembly_items",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    attach_location_full_path([item], db)
    return item


@router.put("/{item_id}", response_model=AssemblyItemOut)
def update_assembly_item_legacy(
    item_id: int,
    payload: AssemblyItemUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_assembly_item(item_id, payload, db, current_user)


@router.delete("/{item_id}")
def delete_assembly_item(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(AssemblyItem).where(AssemblyItem.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Assembly item not found")

    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="assembly_items",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{item_id}/restore", response_model=AssemblyItemOut)
def restore_assembly_item(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(AssemblyItem).where(AssemblyItem.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Assembly item not found")

    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="assembly_items",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    attach_location_full_path([item], db)
    return item
