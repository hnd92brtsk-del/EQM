from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Cabinet, Location
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.cabinets import CabinetOut, CabinetCreate, CabinetUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[CabinetOut])
def list_cabinets(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    location_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Cabinet)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(Cabinet.is_deleted == False)
    else:
        query = query.where(Cabinet.is_deleted == is_deleted)
    if location_id is not None:
        query = query.where(Cabinet.location_id == location_id)

    query = apply_search(query, q, [Cabinet.name])
    query = apply_date_filters(query, Cabinet, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, Cabinet, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{cabinet_id}", response_model=CabinetOut)
def get_cabinet(
    cabinet_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Cabinet).where(Cabinet.id == cabinet_id)
    if not include_deleted:
        query = query.where(Cabinet.is_deleted == False)
    cabinet = db.scalar(query)
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")
    return cabinet


@router.post("/", response_model=CabinetOut)
def create_cabinet(
    payload: CabinetCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
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


@router.patch("/{cabinet_id}", response_model=CabinetOut)
def update_cabinet(
    cabinet_id: int,
    payload: CabinetUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
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


@router.put("/{cabinet_id}", response_model=CabinetOut)
def update_cabinet_legacy(
    cabinet_id: int,
    payload: CabinetUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_cabinet(cabinet_id, payload, db, current_user)


@router.delete("/{cabinet_id}")
def delete_cabinet(
    cabinet_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    cabinet = db.scalar(select(Cabinet).where(Cabinet.id == cabinet_id))
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")

    before = model_to_dict(cabinet)
    cabinet.is_deleted = True
    cabinet.deleted_at = datetime.utcnow()
    cabinet.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="cabinets",
        entity_id=cabinet.id,
        before=before,
        after=model_to_dict(cabinet),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{cabinet_id}/restore", response_model=CabinetOut)
def restore_cabinet(
    cabinet_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    cabinet = db.scalar(select(Cabinet).where(Cabinet.id == cabinet_id))
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")

    before = model_to_dict(cabinet)
    cabinet.is_deleted = False
    cabinet.deleted_at = None
    cabinet.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="cabinets",
        entity_id=cabinet.id,
        before=before,
        after=model_to_dict(cabinet),
    )

    db.commit()
    db.refresh(cabinet)
    return cabinet
