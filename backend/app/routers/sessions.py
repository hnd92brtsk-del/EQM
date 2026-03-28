from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select

from app.core.access import require_space_access
from app.core.dependencies import get_db
from app.core.identity import build_full_name, build_personnel_identity_subquery, make_identity
from app.models.security import SpaceKey, User
from app.models.sessions import UserSession
from app.models.security import User as SecurityUser
from app.schemas.common import Pagination
from app.schemas.sessions import SessionOut

router = APIRouter()


@router.get("/", response_model=Pagination[SessionOut])
def list_sessions(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    user_id: int | None = None,
    end_reason: str | None = None,
    ip_address: str | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_sessions, "read")),
):
    personnel_identity = build_personnel_identity_subquery()
    query = (
        select(
            UserSession,
            SecurityUser.username.label("username"),
            SecurityUser.role.label("system_role"),
            personnel_identity.c.first_name,
            personnel_identity.c.last_name,
            personnel_identity.c.middle_name,
            personnel_identity.c.personnel_role,
        )
        .join(SecurityUser, SecurityUser.id == UserSession.user_id)
        .outerjoin(personnel_identity, personnel_identity.c.user_id == SecurityUser.id)
    )
    if user_id:
        query = query.where(UserSession.user_id == user_id)
    if end_reason:
        query = query.where(UserSession.end_reason.ilike(f"%{end_reason}%"))
    if ip_address:
        query = query.where(UserSession.ip_address.ilike(f"%{ip_address}%"))
    if from_dt:
        query = query.where(UserSession.started_at >= from_dt)
    if to_dt:
        query = query.where(UserSession.started_at <= to_dt)
    if q:
        q_conditions = [
            UserSession.ip_address.ilike(f"%{q}%"),
            SecurityUser.username.ilike(f"%{q}%"),
            personnel_identity.c.first_name.ilike(f"%{q}%"),
            personnel_identity.c.last_name.ilike(f"%{q}%"),
            personnel_identity.c.middle_name.ilike(f"%{q}%"),
            personnel_identity.c.personnel_role.ilike(f"%{q}%"),
        ]
        if q.isdigit():
            q_conditions.append(UserSession.user_id == int(q))
            q_conditions.append(UserSession.id == int(q))
        query = query.where(or_(*q_conditions))

    sort_field = sort.lstrip("-") if sort else "id"
    sort_column = getattr(UserSession, sort_field, None)
    if sort and sort_column is None:
        raise HTTPException(status_code=400, detail=f"Invalid sort field: {sort_field}")
    query = query.order_by(sort_column.desc() if sort and sort.startswith("-") else sort_column.asc()) if sort else query.order_by(UserSession.id.desc())

    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    rows = db.execute(query.offset((page - 1) * page_size).limit(page_size)).all()

    items = []
    for session, username, system_role, first_name, last_name, middle_name, personnel_role in rows:
        personnel_full_name = build_full_name(last_name, first_name, middle_name)
        identity = make_identity(session.user_id, username, personnel_full_name, personnel_role, system_role)
        items.append(
            SessionOut(
                id=session.id,
                user_id=session.user_id,
                identity=identity,
                username=username,
                personnel_full_name=personnel_full_name,
                personnel_role=personnel_role,
                system_role=identity.system_role,
                display_user_label=identity.display_user_label,
                started_at=session.started_at,
                ended_at=session.ended_at,
                end_reason=session.end_reason,
                ip_address=session.ip_address,
                user_agent=session.user_agent,
            )
        )
    return Pagination(items=items, page=page, page_size=page_size, total=total)
