from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user
from app.core.pagination import paginate
from app.models.operations import CabinetItem
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.cabinet_items import CabinetItemOut

router = APIRouter()


@router.get("/", response_model=Pagination[CabinetItemOut])
def list_cabinet_items(
    page: int = 1,
    page_size: int = 50,
    cabinet_id: int | None = None,
    equipment_type_id: int | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(CabinetItem)
    if not include_deleted:
        query = query.where(CabinetItem.is_deleted == False)
    if cabinet_id:
        query = query.where(CabinetItem.cabinet_id == cabinet_id)
    if equipment_type_id:
        query = query.where(CabinetItem.equipment_type_id == equipment_type_id)

    total, items = paginate(query.order_by(CabinetItem.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)
