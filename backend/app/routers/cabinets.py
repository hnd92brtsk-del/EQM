from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.pagination import paginate
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Cabinet, Location
from app.models.security import User, UserRole
from app.schemas.common import Pagination
from app.schemas.cabinets import CabinetOut, CabinetCreate, CabinetUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[CabinetOut])
def list_cabinets(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Cabinet)
    if not include_deleted:
        query = query.where(Cabinet.is_deleted == False)
    if q:
        query = query.where(Cabinet.name.ilike(f"%{q}%"))

    total, items = paginate(query.order_by(Cabinet.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=CabinetOut)
def create_cabinet(
    payload: CabinetCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
):
    if payload.location_id:
        location = db.scalar(
            select(Location).where(Location.id == payload.location_id, Location.is_deleted == False)
        )
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")

    cabinet = Cabinet(
        name=payload.name,
        location_id=payload.location_id,
        meta_data=payload.meta_data,
    )
    db.add(cabinet)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="cabinets",
        entity_id=cabinet.id,
        before=None,
        after=model_to_dict(cabinet),
    )

    db.commit()
    db.refresh(cabinet)
    return cabinet


@router.put("/{cabinet_id}", response_model=CabinetOut)
def update_cabinet(
    cabinet_id: int,
    payload: CabinetUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
):
    cabinet = db.scalar(select(Cabinet).where(Cabinet.id == cabinet_id))
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")

    before = model_to_dict(cabinet)

    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        cabinet.name = payload.name
    if "location_id" in data:
        if data["location_id"]:
            location = db.scalar(
                select(Location).where(Location.id == data["location_id"], Location.is_deleted == False)
            )
            if not location:
                raise HTTPException(status_code=404, detail="Location not found")
        cabinet.location_id = data["location_id"]
    if payload.meta_data is not None:
        cabinet.meta_data = payload.meta_data
    if payload.is_deleted is not None:
        cabinet.is_deleted = payload.is_deleted
        cabinet.deleted_at = datetime.utcnow() if payload.is_deleted else None
        cabinet.deleted_by_id = current_user.id if payload.is_deleted else None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="cabinets",
        entity_id=cabinet.id,
        before=before,
        after=model_to_dict(cabinet),
    )

    db.commit()
    db.refresh(cabinet)
    return cabinet
