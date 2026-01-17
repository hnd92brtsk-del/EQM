from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import EquipmentType, Manufacturer, EquipmentCategory
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.equipment_types import (
    EquipmentTypeOut,
    EquipmentTypeCreate,
    EquipmentTypeUpdate,
    NETWORK_PORT_TYPES,
    NETWORK_PORT_TYPES_WITH_LEGACY,
)

router = APIRouter()

def derive_channel_total(payload: EquipmentTypeCreate | EquipmentTypeUpdate) -> int:
    return (
        (payload.ai_count or 0)
        + (payload.di_count or 0)
        + (payload.ao_count or 0)
        + (payload.do_count or 0)
    )

def derive_channel_total_update(payload: EquipmentTypeUpdate, equipment: EquipmentType) -> int:
    return (
        (payload.ai_count if payload.ai_count is not None else equipment.ai_count)
        + (payload.di_count if payload.di_count is not None else equipment.di_count)
        + (payload.ao_count if payload.ao_count is not None else equipment.ao_count)
        + (payload.do_count if payload.do_count is not None else equipment.do_count)
    )

def normalize_network_ports(payload: EquipmentTypeCreate | EquipmentTypeUpdate):
    if not payload.network_ports:
        return None
    return [item.model_dump() if hasattr(item, "model_dump") else item for item in payload.network_ports]

def normalize_serial_ports(payload: EquipmentTypeCreate | EquipmentTypeUpdate):
    if not payload.serial_ports:
        return []
    return [item.model_dump() if hasattr(item, "model_dump") else item for item in payload.serial_ports]

def validate_network_ports(payload: EquipmentTypeCreate | EquipmentTypeUpdate):
    if not payload.network_ports:
        return
    invalid = {
        item.type
        for item in payload.network_ports
        if item.type not in NETWORK_PORT_TYPES_WITH_LEGACY
    }
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported network port type: {', '.join(sorted(invalid))}",
        )
    disallowed = {item.type for item in payload.network_ports if item.type not in NETWORK_PORT_TYPES}
    if disallowed:
        raise HTTPException(
            status_code=400,
            detail="RS-485 и RS-232 нельзя добавлять как сетевые порты. Используйте \"Последовательные интерфейсы\".",
        )

def merge_unit_price(meta_data: dict | None, unit_price_rub: float | None, fields_set: set[str] | None) -> dict | None:
    result = dict(meta_data or {})
    if fields_set is None or "unit_price_rub" in fields_set:
        if unit_price_rub is None:
            result.pop("unit_price_rub", None)
        else:
            result["unit_price_rub"] = unit_price_rub
    return result or None


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
    validate_network_ports(payload)
    manufacturer = db.scalar(
        select(Manufacturer).where(Manufacturer.id == payload.manufacturer_id, Manufacturer.is_deleted == False)
    )
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    if payload.equipment_category_id is not None:
        category = db.scalar(
            select(EquipmentCategory).where(
                EquipmentCategory.id == payload.equipment_category_id,
                EquipmentCategory.is_deleted == False,
            )
        )
        if not category:
            raise HTTPException(status_code=404, detail="Equipment category not found")

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
        article=payload.article,
        nomenclature_number=payload.nomenclature_number,
        manufacturer_id=payload.manufacturer_id,
        equipment_category_id=payload.equipment_category_id,
        is_channel_forming=payload.is_channel_forming,
        channel_count=payload.channel_count or derive_channel_total(payload),
        ai_count=payload.ai_count,
        di_count=payload.di_count,
        ao_count=payload.ao_count,
        do_count=payload.do_count,
        is_network=payload.is_network,
        network_ports=normalize_network_ports(payload) if payload.is_network else None,
        has_serial_interfaces=payload.has_serial_interfaces,
        serial_ports=normalize_serial_ports(payload) if payload.has_serial_interfaces else [],
        meta_data=merge_unit_price(payload.meta_data, payload.unit_price_rub, None),
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
    validate_network_ports(payload)
    equipment = db.scalar(select(EquipmentType).where(EquipmentType.id == equipment_type_id))
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment type not found")

    before = model_to_dict(equipment)

    if payload.name is not None:
        equipment.name = payload.name
    if "article" in payload.__fields_set__:
        equipment.article = payload.article
    if payload.manufacturer_id is not None:
        manufacturer = db.scalar(
            select(Manufacturer).where(Manufacturer.id == payload.manufacturer_id, Manufacturer.is_deleted == False)
        )
        if not manufacturer:
            raise HTTPException(status_code=404, detail="Manufacturer not found")
        equipment.manufacturer_id = payload.manufacturer_id
    if "equipment_category_id" in payload.__fields_set__:
        if payload.equipment_category_id is None:
            equipment.equipment_category_id = None
        else:
            category = db.scalar(
                select(EquipmentCategory).where(
                    EquipmentCategory.id == payload.equipment_category_id,
                    EquipmentCategory.is_deleted == False,
                )
            )
            if not category:
                raise HTTPException(status_code=404, detail="Equipment category not found")
            equipment.equipment_category_id = payload.equipment_category_id
    if payload.is_channel_forming is not None:
        equipment.is_channel_forming = payload.is_channel_forming
    if payload.channel_count is not None:
        equipment.channel_count = payload.channel_count
        if payload.ai_count is None and payload.di_count is None and payload.ao_count is None and payload.do_count is None:
            equipment.ai_count = payload.channel_count
    if payload.ai_count is not None:
        equipment.ai_count = payload.ai_count
    if payload.di_count is not None:
        equipment.di_count = payload.di_count
    if payload.ao_count is not None:
        equipment.ao_count = payload.ao_count
    if payload.do_count is not None:
        equipment.do_count = payload.do_count
    if payload.is_network is not None:
        equipment.is_network = payload.is_network
        if not payload.is_network:
            equipment.network_ports = None
    if payload.network_ports is not None and payload.is_network is not False:
        equipment.network_ports = normalize_network_ports(payload)
    if payload.has_serial_interfaces is not None:
        equipment.has_serial_interfaces = payload.has_serial_interfaces
        if not payload.has_serial_interfaces:
            equipment.serial_ports = []
    if payload.serial_ports is not None and payload.has_serial_interfaces is not False:
        equipment.serial_ports = normalize_serial_ports(payload)
    if any(
        value is not None
        for value in (payload.ai_count, payload.di_count, payload.ao_count, payload.do_count)
    ):
        equipment.channel_count = derive_channel_total_update(payload, equipment)
    meta_data_provided = "meta_data" in payload.__fields_set__
    unit_price_provided = "unit_price_rub" in payload.__fields_set__
    if meta_data_provided or unit_price_provided:
        base_meta = payload.meta_data if meta_data_provided else equipment.meta_data
        equipment.meta_data = merge_unit_price(base_meta, payload.unit_price_rub, payload.__fields_set__)

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
