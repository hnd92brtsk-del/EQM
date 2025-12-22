from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Manufacturer
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.manufacturers import ManufacturerOut, ManufacturerCreate, ManufacturerUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[ManufacturerOut])
def list_manufacturers(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Manufacturer)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(Manufacturer.is_deleted == False)
    else:
        query = query.where(Manufacturer.is_deleted == is_deleted)

    query = apply_search(query, q, [Manufacturer.name, Manufacturer.country])
    query = apply_date_filters(query, Manufacturer, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, Manufacturer, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{manufacturer_id}", response_model=ManufacturerOut)
def get_manufacturer(
    manufacturer_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Manufacturer).where(Manufacturer.id == manufacturer_id)
    if not include_deleted:
        query = query.where(Manufacturer.is_deleted == False)
    manufacturer = db.scalar(query)
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    return manufacturer


@router.post("/", response_model=ManufacturerOut)
def create_manufacturer(
    payload: ManufacturerCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    existing = db.scalar(
        select(Manufacturer).where(
            Manufacturer.name == payload.name, Manufacturer.is_deleted == False
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Manufacturer already exists")

    manufacturer = Manufacturer(name=payload.name, country=payload.country)
    db.add(manufacturer)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="manufacturers",
        entity_id=manufacturer.id,
        before=None,
        after=model_to_dict(manufacturer),
    )

    db.commit()
    db.refresh(manufacturer)
    return manufacturer


@router.patch("/{manufacturer_id}", response_model=ManufacturerOut)
def update_manufacturer(
    manufacturer_id: int,
    payload: ManufacturerUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    manufacturer = db.scalar(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    before = model_to_dict(manufacturer)

    if payload.name is not None:
        manufacturer.name = payload.name
    if payload.country is not None:
        manufacturer.country = payload.country

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="manufacturers",
        entity_id=manufacturer.id,
        before=before,
        after=model_to_dict(manufacturer),
    )

    db.commit()
    db.refresh(manufacturer)
    return manufacturer


@router.put("/{manufacturer_id}", response_model=ManufacturerOut)
def update_manufacturer_legacy(
    manufacturer_id: int,
    payload: ManufacturerUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_manufacturer(manufacturer_id, payload, db, current_user)


@router.delete("/{manufacturer_id}")
def delete_manufacturer(
    manufacturer_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    manufacturer = db.scalar(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    before = model_to_dict(manufacturer)
    manufacturer.is_deleted = True
    manufacturer.deleted_at = datetime.utcnow()
    manufacturer.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="manufacturers",
        entity_id=manufacturer.id,
        before=before,
        after=model_to_dict(manufacturer),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{manufacturer_id}/restore", response_model=ManufacturerOut)
def restore_manufacturer(
    manufacturer_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    manufacturer = db.scalar(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    before = model_to_dict(manufacturer)
    manufacturer.is_deleted = False
    manufacturer.deleted_at = None
    manufacturer.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="manufacturers",
        entity_id=manufacturer.id,
        before=before,
        after=model_to_dict(manufacturer),
    )

    db.commit()
    db.refresh(manufacturer)
    return manufacturer
