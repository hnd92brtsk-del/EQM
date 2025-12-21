from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.pagination import paginate
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import EquipmentType, Manufacturer
from app.models.security import User, UserRole
from app.schemas.common import Pagination
from app.schemas.equipment_types import EquipmentTypeOut, EquipmentTypeCreate, EquipmentTypeUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[EquipmentTypeOut])
def list_equipment_types(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(EquipmentType)
    if not include_deleted:
        query = query.where(EquipmentType.is_deleted == False)
    if q:
        query = query.where(EquipmentType.name.ilike(f"%{q}%"))

    total, items = paginate(query.order_by(EquipmentType.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=EquipmentTypeOut)
def create_equipment_type(
    payload: EquipmentTypeCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
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


@router.put("/{equipment_type_id}", response_model=EquipmentTypeOut)
def update_equipment_type(
    equipment_type_id: int,
    payload: EquipmentTypeUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
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
    if payload.is_deleted is not None:
        equipment.is_deleted = payload.is_deleted
        equipment.deleted_at = datetime.utcnow() if payload.is_deleted else None
        equipment.deleted_by_id = current_user.id if payload.is_deleted else None

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
