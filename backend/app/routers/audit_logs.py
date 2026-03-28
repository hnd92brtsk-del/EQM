from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select

from app.core.access import require_space_access
from app.core.dependencies import get_db
from app.core.identity import build_full_name, build_personnel_identity_subquery, make_identity
from app.models.audit import AuditLog
from app.models.security import SpaceKey, User
from app.models.security import User as SecurityUser
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
    entity_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_audit, "read")),
):
    personnel_identity = build_personnel_identity_subquery()
    query = (
        select(
            AuditLog,
            SecurityUser.username.label("username"),
            SecurityUser.role.label("system_role"),
            personnel_identity.c.first_name,
            personnel_identity.c.last_name,
            personnel_identity.c.middle_name,
            personnel_identity.c.personnel_role,
        )
        .join(SecurityUser, SecurityUser.id == AuditLog.actor_id)
        .outerjoin(personnel_identity, personnel_identity.c.user_id == SecurityUser.id)
    )
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if entity_id is not None:
        query = query.where(AuditLog.entity_id == entity_id)
    if entity:
        query = query.where(AuditLog.entity.ilike(f"%{entity}%"))
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if created_at_from:
        query = query.where(AuditLog.created_at >= created_at_from)
    if created_at_to:
        query = query.where(AuditLog.created_at <= created_at_to)
    if q:
        query = query.where(
            or_(
                AuditLog.entity.ilike(f"%{q}%"),
                AuditLog.action.ilike(f"%{q}%"),
                SecurityUser.username.ilike(f"%{q}%"),
                personnel_identity.c.first_name.ilike(f"%{q}%"),
                personnel_identity.c.last_name.ilike(f"%{q}%"),
                personnel_identity.c.middle_name.ilike(f"%{q}%"),
                personnel_identity.c.personnel_role.ilike(f"%{q}%"),
            )
        )

    sort_field = sort.lstrip("-") if sort else "id"
    sort_column = getattr(AuditLog, sort_field, None)
    if sort and sort_column is None:
        raise HTTPException(status_code=400, detail=f"Invalid sort field: {sort_field}")
    query = query.order_by(sort_column.desc() if sort and sort.startswith("-") else sort_column.asc()) if sort else query.order_by(AuditLog.id.desc())

    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    rows = db.execute(query.offset((page - 1) * page_size).limit(page_size)).all()
    items = []
    for audit_log, username, system_role, first_name, last_name, middle_name, personnel_role in rows:
        personnel_full_name = build_full_name(last_name, first_name, middle_name)
        identity = make_identity(audit_log.actor_id, username, personnel_full_name, personnel_role, system_role)
        items.append(
            AuditLogOut(
                id=audit_log.id,
                actor_id=audit_log.actor_id,
                identity=identity,
                username=username,
                personnel_full_name=personnel_full_name,
                personnel_role=personnel_role,
                system_role=identity.system_role,
                display_user_label=identity.display_user_label,
                action=audit_log.action,
                entity=audit_log.entity,
                entity_id=audit_log.entity_id,
                before=audit_log.before,
                after=audit_log.after,
                meta=audit_log.meta,
                created_at=audit_log.created_at,
            )
        )
    return Pagination(items=items, page=page, page_size=page_size, total=total)
