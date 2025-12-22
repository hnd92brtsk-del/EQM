from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import EquipmentType, Manufacturer
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.equipment_types import EquipmentTypeOut, EquipmentTypeCreate, EquipmentTypeUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[EquipmentTypeOut])
def list_equipment_types(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    manufacturer_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(EquipmentType)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(EquipmentType.is_deleted == False)
    else:
        query = query.where(EquipmentType.is_deleted == is_deleted)
    if manufacturer_id is not None:
        query = query.where(EquipmentType.manufacturer_id == manufacturer_id)

    query = apply_search(query, q, [EquipmentType.name, EquipmentType.nomenclature_number])
    query = apply_date_filters(query, EquipmentType, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, EquipmentType, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{equipment_type_id}", response_model=EquipmentTypeOut)
def get_equipment_type(
    equipment_type_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(EquipmentType).where(EquipmentType.id == equipment_type_id)
    if not include_deleted:
        query = query.where(EquipmentType.is_deleted == False)
    equipment = db.scalar(query)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment type not found")
    return equipment


@router.post("/", response_model=EquipmentTypeOut)
def create_equipment_type(
    payload: EquipmentTypeCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    manufacturer = db.scalar(
        select(Manufacturer).where(Manufacturer.id == payload.manufacturer_id, Manufacturer.is_deleted == False)
    )
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    existing = db.scalar(
        select(EquipmentType).where(
            EquipmentType.nomenclature_number == payload.nomenclature_number,
            EquipmentType.is_deleted == False,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Equipment type already exists")

    equipment = EquipmentType(
        name=payload.name,
        nomenclature_number=payload.nomenclature_number,
        manufacturer_id=payload.manufacturer_id,
        is_channel_forming=payload.is_channel_forming,
        channel_count=payload.channel_count,
        meta_data=payload.meta_data,
    )
    db.add(equipment)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="equipment_types",
        entity_id=equipment.id,
        before=None,
        after=model_to_dict(equipment),
    )

    db.commit()
    db.refresh(equipment)
    return equipment


@router.patch("/{equipment_type_id}", response_model=EquipmentTypeOut)
def update_equipment_type(
    equipment_type_id: int,
    payload: EquipmentTypeUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    equipment = db.scalar(select(EquipmentType).where(EquipmentType.id == equipment_type_id))
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment type not found")

    before = model_to_dict(equipment)

    if payload.name is not None:
        equipment.name = payload.name
    if payload.manufacturer_id is not None:
        manufacturer = db.scalar(
            select(Manufacturer).where(Manufacturer.id == payload.manufacturer_id, Manufacturer.is_deleted == False)
        )
        if not manufacturer:
            raise HTTPException(status_code=404, detail="Manufacturer not found")
        equipment.manufacturer_id = payload.manufacturer_id
    if payload.is_channel_forming is not None:
        equipment.is_channel_forming = payload.is_channel_forming
    if payload.channel_count is not None:
        equipment.channel_count = payload.channel_count
    if payload.meta_data is not None:
        equipment.meta_data = payload.meta_data

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="equipment_types",
        entity_id=equipment.id,
        before=before,
        after=model_to_dict(equipment),
    )

    db.commit()
    db.refresh(equipment)
    return equipment


@router.put("/{equipment_type_id}", response_model=EquipmentTypeOut)
def update_equipment_type_legacy(
    equipment_type_id: int,
    payload: EquipmentTypeUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_equipment_type(equipment_type_id, payload, db, current_user)


@router.delete("/{equipment_type_id}")
def delete_equipment_type(
    equipment_type_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    equipment = db.scalar(select(EquipmentType).where(EquipmentType.id == equipment_type_id))
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment type not found")

    before = model_to_dict(equipment)
    equipment.is_deleted = True
    equipment.deleted_at = datetime.utcnow()
    equipment.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="equipment_types",
        entity_id=equipment.id,
        before=before,
        after=model_to_dict(equipment),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{equipment_type_id}/restore", response_model=EquipmentTypeOut)
def restore_equipment_type(
    equipment_type_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    equipment = db.scalar(select(EquipmentType).where(EquipmentType.id == equipment_type_id))
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment type not found")

    before = model_to_dict(equipment)
    equipment.is_deleted = False
    equipment.deleted_at = None
    equipment.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="equipment_types",
        entity_id=equipment.id,
        before=before,
        after=model_to_dict(equipment),
    )

    db.commit()
    db.refresh(equipment)
    return equipment
