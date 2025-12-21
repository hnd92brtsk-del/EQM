from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles
from app.core.pagination import paginate
from app.models.audit import AuditLog
from app.models.security import User, UserRole
from app.schemas.audit_logs import AuditLogOut
from app.schemas.common import Pagination

router = APIRouter()


@router.get("/", response_model=Pagination[AuditLogOut])
def list_audit_logs(
    page: int = 1,
    page_size: int = 50,
    actor_id: int | None = None,
    entity: str | None = None,
    action: str | None = None,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin])),
):
    query = select(AuditLog)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if entity:
        query = query.where(AuditLog.entity == entity)
    if action:
        query = query.where(AuditLog.action == action)

    total, items = paginate(query.order_by(AuditLog.id.desc()), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)
