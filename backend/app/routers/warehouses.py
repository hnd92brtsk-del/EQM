from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.pagination import paginate
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Warehouse, Location
from app.models.security import User, UserRole
from app.schemas.common import Pagination
from app.schemas.warehouses import WarehouseOut, WarehouseCreate, WarehouseUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[WarehouseOut])
def list_warehouses(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Warehouse)
    if not include_deleted:
        query = query.where(Warehouse.is_deleted == False)
    if q:
        query = query.where(Warehouse.name.ilike(f"%{q}%"))

    total, items = paginate(query.order_by(Warehouse.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=WarehouseOut)
def create_warehouse(
    payload: WarehouseCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
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


@router.put("/{warehouse_id}", response_model=WarehouseOut)
def update_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
):
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    before = model_to_dict(warehouse)

    if payload.name is not None:
        warehouse.name = payload.name
    if payload.location_id is not None:
        if payload.location_id:
            location = db.scalar(
                select(Location).where(Location.id == payload.location_id, Location.is_deleted == False)
            )
            if not location:
                raise HTTPException(status_code=404, detail="Location not found")
        warehouse.location_id = payload.location_id
    if payload.meta_data is not None:
        warehouse.meta_data = payload.meta_data
    if payload.is_deleted is not None:
        warehouse.is_deleted = payload.is_deleted
        warehouse.deleted_at = datetime.utcnow() if payload.is_deleted else None
        warehouse.deleted_by_id = current_user.id if payload.is_deleted else None

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
