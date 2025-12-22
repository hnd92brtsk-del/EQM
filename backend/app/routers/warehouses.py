from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Warehouse, Location
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.warehouses import WarehouseOut, WarehouseCreate, WarehouseUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[WarehouseOut])
def list_warehouses(
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
    query = select(Warehouse)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(Warehouse.is_deleted == False)
    else:
        query = query.where(Warehouse.is_deleted == is_deleted)
    if location_id is not None:
        query = query.where(Warehouse.location_id == location_id)

    query = apply_search(query, q, [Warehouse.name])
    query = apply_date_filters(query, Warehouse, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, Warehouse, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{warehouse_id}", response_model=WarehouseOut)
def get_warehouse(
    warehouse_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Warehouse).where(Warehouse.id == warehouse_id)
    if not include_deleted:
        query = query.where(Warehouse.is_deleted == False)
    warehouse = db.scalar(query)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return warehouse


@router.post("/", response_model=WarehouseOut)
def create_warehouse(
    payload: WarehouseCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    if payload.location_id:
        location = db.scalar(
            select(Location).where(Location.id == payload.location_id, Location.is_deleted == False)
        )
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")

    warehouse = Warehouse(
        name=payload.name,
        location_id=payload.location_id,
        meta_data=payload.meta_data,
    )
    db.add(warehouse)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="warehouses",
        entity_id=warehouse.id,
        before=None,
        after=model_to_dict(warehouse),
    )

    db.commit()
    db.refresh(warehouse)
    return warehouse


@router.patch("/{warehouse_id}", response_model=WarehouseOut)
def update_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    before = model_to_dict(warehouse)
    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        warehouse.name = payload.name
    if "location_id" in data:
        if data["location_id"]:
            location = db.scalar(
                select(Location).where(Location.id == data["location_id"], Location.is_deleted == False)
            )
            if not location:
                raise HTTPException(status_code=404, detail="Location not found")
        warehouse.location_id = data["location_id"]
    if payload.meta_data is not None:
        warehouse.meta_data = payload.meta_data

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="warehouses",
        entity_id=warehouse.id,
        before=before,
        after=model_to_dict(warehouse),
    )

    db.commit()
    db.refresh(warehouse)
    return warehouse


@router.put("/{warehouse_id}", response_model=WarehouseOut)
def update_warehouse_legacy(
    warehouse_id: int,
    payload: WarehouseUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_warehouse(warehouse_id, payload, db, current_user)


@router.delete("/{warehouse_id}")
def delete_warehouse(
    warehouse_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    before = model_to_dict(warehouse)
    warehouse.is_deleted = True
    warehouse.deleted_at = datetime.utcnow()
    warehouse.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="warehouses",
        entity_id=warehouse.id,
        before=before,
        after=model_to_dict(warehouse),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{warehouse_id}/restore", response_model=WarehouseOut)
def restore_warehouse(
    warehouse_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    before = model_to_dict(warehouse)
    warehouse.is_deleted = False
    warehouse.deleted_at = None
    warehouse.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="warehouses",
        entity_id=warehouse.id,
        before=before,
        after=model_to_dict(warehouse),
    )

    db.commit()
    db.refresh(warehouse)
    return warehouse
