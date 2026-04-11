from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.access import require_space_access
from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db
from app.core.pagination import paginate
from app.core.query import apply_date_filters, apply_search, apply_sort
from app.models.core import Location, MainEquipment, TechnologicalEquipment
from app.models.security import SpaceKey, User
from app.schemas.common import Pagination
from app.schemas.technological_equipment import (
    TechnologicalEquipmentCreate,
    TechnologicalEquipmentOut,
    TechnologicalEquipmentUpdate,
)

router = APIRouter()


def _base_query():
    return select(TechnologicalEquipment).options(
        selectinload(TechnologicalEquipment.main_equipment),
        selectinload(TechnologicalEquipment.location),
    )


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _resolve_main_equipment(db, main_equipment_id: int) -> MainEquipment:
    item = db.scalar(
        select(MainEquipment).where(
            MainEquipment.id == main_equipment_id,
            MainEquipment.is_deleted == False,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Main equipment type not found")
    return item


def _resolve_location(db, location_id: int | None) -> Location | None:
    if location_id is None:
        return None
    location = db.scalar(
        select(Location).where(
            Location.id == location_id,
            Location.is_deleted == False,
        )
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.get("/", response_model=Pagination[TechnologicalEquipmentOut])
def list_technological_equipment(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    main_equipment_id: int | None = None,
    location_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.equipment, "read")),
):
    query = _base_query()
    if is_deleted is None:
        if not include_deleted:
            query = query.where(TechnologicalEquipment.is_deleted == False)
    else:
        query = query.where(TechnologicalEquipment.is_deleted == is_deleted)
    if main_equipment_id is not None:
        query = query.where(TechnologicalEquipment.main_equipment_id == main_equipment_id)
    if location_id is not None:
        query = query.where(TechnologicalEquipment.location_id == location_id)

    query = apply_search(
        query,
        q,
        [
            TechnologicalEquipment.name,
            TechnologicalEquipment.tag,
            TechnologicalEquipment.description,
        ],
    )
    query = apply_date_filters(
        query,
        TechnologicalEquipment,
        created_at_from,
        created_at_to,
        updated_at_from,
        updated_at_to,
    )
    query = apply_sort(query, TechnologicalEquipment, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{item_id}", response_model=TechnologicalEquipmentOut)
def get_technological_equipment(
    item_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.equipment, "read")),
):
    query = _base_query().where(TechnologicalEquipment.id == item_id)
    if not include_deleted:
        query = query.where(TechnologicalEquipment.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="Technological equipment not found")
    return item


@router.post("/", response_model=TechnologicalEquipmentOut)
def create_technological_equipment(
    payload: TechnologicalEquipmentCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    _resolve_main_equipment(db, payload.main_equipment_id)
    _resolve_location(db, payload.location_id)

    item = TechnologicalEquipment(
        name=payload.name.strip(),
        main_equipment_id=payload.main_equipment_id,
        tag=_normalize_text(payload.tag),
        location_id=payload.location_id,
        description=_normalize_text(payload.description),
    )
    db.add(item)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="technological_equipment",
        entity_id=item.id,
        before=None,
        after=model_to_dict(item),
    )

    db.commit()
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item.id))
    return item


@router.patch("/{item_id}", response_model=TechnologicalEquipmentOut)
def update_technological_equipment(
    item_id: int,
    payload: TechnologicalEquipmentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Technological equipment not found")

    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        item.name = payload.name.strip()
    if payload.main_equipment_id is not None:
        _resolve_main_equipment(db, payload.main_equipment_id)
        item.main_equipment_id = payload.main_equipment_id
    if "tag" in data:
        item.tag = _normalize_text(data.get("tag"))
    if "location_id" in data:
        _resolve_location(db, data.get("location_id"))
        item.location_id = data.get("location_id")
    if "description" in data:
        item.description = _normalize_text(data.get("description"))

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="technological_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item.id))
    return item


@router.put("/{item_id}", response_model=TechnologicalEquipmentOut)
def update_technological_equipment_legacy(
    item_id: int,
    payload: TechnologicalEquipmentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    return update_technological_equipment(item_id, payload, db, current_user)


@router.delete("/{item_id}")
def delete_technological_equipment(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    item = db.scalar(select(TechnologicalEquipment).where(TechnologicalEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Technological equipment not found")

    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="technological_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{item_id}/restore", response_model=TechnologicalEquipmentOut)
def restore_technological_equipment(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Technological equipment not found")

    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="technological_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item.id))
    return item
