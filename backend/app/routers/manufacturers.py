from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.pagination import paginate
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Manufacturer
from app.models.security import User, UserRole
from app.schemas.common import Pagination
from app.schemas.manufacturers import ManufacturerOut, ManufacturerCreate, ManufacturerUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[ManufacturerOut])
def list_manufacturers(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Manufacturer)
    if not include_deleted:
        query = query.where(Manufacturer.is_deleted == False)
    if q:
        query = query.where(Manufacturer.name.ilike(f"%{q}%"))

    total, items = paginate(query.order_by(Manufacturer.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=ManufacturerOut)
def create_manufacturer(
    payload: ManufacturerCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
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


@router.put("/{manufacturer_id}", response_model=ManufacturerOut)
def update_manufacturer(
    manufacturer_id: int,
    payload: ManufacturerUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
):
    manufacturer = db.scalar(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    before = model_to_dict(manufacturer)

    if payload.name is not None:
        manufacturer.name = payload.name
    if payload.country is not None:
        manufacturer.country = payload.country
    if payload.is_deleted is not None:
        manufacturer.is_deleted = payload.is_deleted
        manufacturer.deleted_at = datetime.utcnow() if payload.is_deleted else None
        manufacturer.deleted_by_id = current_user.id if payload.is_deleted else None

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
