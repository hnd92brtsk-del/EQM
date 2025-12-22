from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.dependencies import get_db, require_admin
from app.core.pagination import paginate
from app.core.query import apply_sort
from app.models.sessions import UserSession
from app.models.security import User
from app.schemas.sessions import SessionOut
from app.schemas.common import Pagination

router = APIRouter()


@router.get("/", response_model=Pagination[SessionOut])
def list_sessions(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    user_id: int | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    query = select(UserSession)
    if user_id:
        query = query.where(UserSession.user_id == user_id)
    if from_dt:
        query = query.where(UserSession.started_at >= from_dt)
    if to_dt:
        query = query.where(UserSession.started_at <= to_dt)
    if q:
        if q.isdigit():
            query = query.where(
                (UserSession.user_id == int(q)) | (UserSession.id == int(q))
            )
        query = query.where(UserSession.ip_address.ilike(f"%{q}%"))

    query = apply_sort(query, UserSession, sort) if sort else query.order_by(UserSession.id.desc())

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)
