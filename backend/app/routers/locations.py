from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.pagination import paginate
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Location
from app.models.security import User, UserRole
from app.schemas.common import Pagination
from app.schemas.locations import LocationOut, LocationCreate, LocationUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[LocationOut])
def list_locations(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Location)
    if not include_deleted:
        query = query.where(Location.is_deleted == False)
    if q:
        query = query.where(Location.name.ilike(f"%{q}%"))

    total, items = paginate(query.order_by(Location.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=LocationOut)
def create_location(
    payload: LocationCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
):
    location = Location(name=payload.name, parent_id=payload.parent_id)
    db.add(location)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="locations",
        entity_id=location.id,
        before=None,
        after=model_to_dict(location),
    )

    db.commit()
    db.refresh(location)
    return location


@router.put("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
):
    location = db.scalar(select(Location).where(Location.id == location_id))
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    before = model_to_dict(location)

    if payload.name is not None:
        location.name = payload.name
    if payload.parent_id is not None:
        location.parent_id = payload.parent_id
    if payload.is_deleted is not None:
        location.is_deleted = payload.is_deleted
        location.deleted_at = datetime.utcnow() if payload.is_deleted else None
        location.deleted_by_id = current_user.id if payload.is_deleted else None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="locations",
        entity_id=location.id,
        before=before,
        after=model_to_dict(location),
    )

    db.commit()
    db.refresh(location)
    return location
