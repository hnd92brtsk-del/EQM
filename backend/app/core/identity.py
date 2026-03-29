from __future__ import annotations

from sqlalchemy import func, select

from app.models.core import Personnel
from app.models.security import User, UserRole
from app.schemas.identity import UserIdentityOut
from app.schemas.users import UserOut


def build_personnel_identity_subquery():
    ranked_personnel = (
        select(
            Personnel.user_id.label("user_id"),
            Personnel.first_name.label("first_name"),
            Personnel.last_name.label("last_name"),
            Personnel.middle_name.label("middle_name"),
            Personnel.role.label("personnel_role"),
            func.row_number()
            .over(
                partition_by=Personnel.user_id,
                order_by=(Personnel.is_deleted.asc(), Personnel.updated_at.desc(), Personnel.id.desc()),
            )
            .label("rn"),
        )
        .where(Personnel.user_id.is_not(None))
        .subquery()
    )
    return (
        select(
            ranked_personnel.c.user_id,
            ranked_personnel.c.first_name,
            ranked_personnel.c.last_name,
            ranked_personnel.c.middle_name,
            ranked_personnel.c.personnel_role,
        )
        .where(ranked_personnel.c.rn == 1)
        .subquery()
    )


def build_full_name(last_name: str | None, first_name: str | None, middle_name: str | None) -> str | None:
    parts = [part for part in [last_name, first_name, middle_name] if part]
    return " ".join(parts) if parts else None


def make_identity(
    user_id: int,
    username: str | None,
    personnel_full_name: str | None,
    personnel_role: str | None,
    system_role: str | UserRole | None,
) -> UserIdentityOut:
    normalized_system_role = system_role.value if isinstance(system_role, UserRole) else system_role
    display_name = personnel_full_name or username or f"User {user_id}"
    role_label = personnel_role or normalized_system_role or "-"
    return UserIdentityOut(
        user_id=user_id,
        username=username,
        personnel_full_name=personnel_full_name,
        personnel_role=personnel_role,
        system_role=normalized_system_role,
        display_user_label=f"{user_id} / {display_name} / {role_label}",
    )


def user_out_with_permissions(user: User, permissions) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        permissions=permissions,
        created_at=user.created_at,
        updated_at=user.updated_at,
        is_deleted=user.is_deleted,
        deleted_at=user.deleted_at,
    )
