from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles
from app.core.pagination import paginate
from app.core.query import apply_sort
from app.models.audit import AuditLog
from app.models.security import UserRole
from app.schemas.audit_logs import AuditLogOut
from app.schemas.common import Pagination

router = APIRouter()


@router.get("/", response_model=Pagination[AuditLogOut])
def list_audit_logs(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    actor_id: int | None = None,
    entity: str | None = None,
    action: str | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    db=Depends(get_db),
    current_user=Depends(require_roles([UserRole.admin, UserRole.engineer])),
):
    query = select(AuditLog)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if entity:
        query = query.where(AuditLog.entity == entity)
    if action:
        query = query.where(AuditLog.action == action)
    if created_at_from:
        query = query.where(AuditLog.created_at >= created_at_from)
    if created_at_to:
        query = query.where(AuditLog.created_at <= created_at_to)
    if q:
        query = query.where(
            (AuditLog.entity.ilike(f"%{q}%"))
            | (AuditLog.action.ilike(f"%{q}%"))
        )

    query = apply_sort(query, AuditLog, sort) if sort else query.order_by(AuditLog.id.desc())

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)
