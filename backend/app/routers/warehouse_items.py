from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user
from app.core.pagination import paginate
from app.models.operations import WarehouseItem
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.warehouse_items import WarehouseItemOut

router = APIRouter()


@router.get("/", response_model=Pagination[WarehouseItemOut])
def list_warehouse_items(
    page: int = 1,
    page_size: int = 50,
    warehouse_id: int | None = None,
    equipment_type_id: int | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(WarehouseItem)
    if not include_deleted:
        query = query.where(WarehouseItem.is_deleted == False)
    if warehouse_id:
        query = query.where(WarehouseItem.warehouse_id == warehouse_id)
    if equipment_type_id:
        query = query.where(WarehouseItem.equipment_type_id == equipment_type_id)

    total, items = paginate(query.order_by(WarehouseItem.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)
