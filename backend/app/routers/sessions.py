from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles
from app.core.pagination import paginate
from app.models.sessions import UserSession
from app.models.security import User, UserRole
from app.schemas.sessions import SessionOut
from app.schemas.common import Pagination

router = APIRouter()


@router.get("/", response_model=Pagination[SessionOut])
def list_sessions(
    page: int = 1,
    page_size: int = 50,
    user_id: int | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin])),
):
    query = select(UserSession)
    if user_id:
        query = query.where(UserSession.user_id == user_id)
    if from_dt:
        query = query.where(UserSession.started_at >= from_dt)
    if to_dt:
        query = query.where(UserSession.started_at <= to_dt)

    total, items = paginate(query.order_by(UserSession.id.desc()), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)
