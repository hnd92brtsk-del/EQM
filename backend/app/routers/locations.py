from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Location
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.locations import LocationOut, LocationCreate, LocationUpdate, LocationTreeNode

router = APIRouter()


def build_tree(locations):
    nodes = {loc.id: LocationTreeNode(id=loc.id, name=loc.name, children=[]) for loc in locations}
    roots = []
    for loc in locations:
        if loc.parent_id and loc.parent_id in nodes:
            nodes[loc.parent_id].children.append(nodes[loc.id])
        else:
            roots.append(nodes[loc.id])
    return roots


@router.get("/tree", response_model=list[LocationTreeNode])
def get_location_tree(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Location)
    if not include_deleted:
        query = query.where(Location.is_deleted == False)
    locations = db.scalars(query.order_by(Location.id)).all()
    return build_tree(locations)


@router.get("/", response_model=Pagination[LocationOut])
def list_locations(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    parent_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Location)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(Location.is_deleted == False)
    else:
        query = query.where(Location.is_deleted == is_deleted)
    if parent_id is not None:
        query = query.where(Location.parent_id == parent_id)

    query = apply_search(query, q, [Location.name])
    query = apply_date_filters(query, Location, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, Location, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{location_id}", response_model=LocationOut)
def get_location(
    location_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Location).where(Location.id == location_id)
    if not include_deleted:
        query = query.where(Location.is_deleted == False)
    location = db.scalar(query)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("/", response_model=LocationOut)
def create_location(
    payload: LocationCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
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


@router.patch("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    location = db.scalar(select(Location).where(Location.id == location_id))
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    before = model_to_dict(location)
    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        location.name = payload.name
    if "parent_id" in data:
        location.parent_id = data["parent_id"]

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


@router.put("/{location_id}", response_model=LocationOut)
def update_location_legacy(
    location_id: int,
    payload: LocationUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_location(location_id, payload, db, current_user)


@router.delete("/{location_id}")
def delete_location(
    location_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    location = db.scalar(select(Location).where(Location.id == location_id))
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    before = model_to_dict(location)
    location.is_deleted = True
    location.deleted_at = datetime.utcnow()
    location.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="locations",
        entity_id=location.id,
        before=before,
        after=model_to_dict(location),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{location_id}/restore", response_model=LocationOut)
def restore_location(
    location_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    location = db.scalar(select(Location).where(Location.id == location_id))
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    before = model_to_dict(location)
    location.is_deleted = False
    location.deleted_at = None
    location.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="locations",
        entity_id=location.id,
        before=before,
        after=model_to_dict(location),
    )

    db.commit()
    db.refresh(location)
    return location
