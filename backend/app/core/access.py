from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import select

from app.core.dependencies import get_current_user, get_db
from app.models.security import AccessSpace, RoleSpacePermission, SpaceKey, User, UserRole
from app.schemas.users import SpacePermissionOut

WORK_SPACES = {
    SpaceKey.overview,
    SpaceKey.personnel,
    SpaceKey.equipment,
    SpaceKey.cabinets,
    SpaceKey.engineering,
    SpaceKey.dictionaries,
}

DEFAULT_SPACE_CATALOG: list[tuple[SpaceKey, str, bool]] = [
    (SpaceKey.overview, "Overview", False),
    (SpaceKey.personnel, "Personnel", False),
    (SpaceKey.equipment, "Equipment", False),
    (SpaceKey.cabinets, "Cabinets", False),
    (SpaceKey.engineering, "Engineering", False),
    (SpaceKey.dictionaries, "Dictionaries", False),
    (SpaceKey.admin_users, "Admin Users", True),
    (SpaceKey.admin_sessions, "Admin Sessions", True),
    (SpaceKey.admin_audit, "Admin Audit", True),
    (SpaceKey.admin_diagnostics, "Admin Diagnostics", True),
]


def normalize_permission_flags(can_read: bool, can_write: bool, can_admin: bool) -> tuple[bool, bool, bool]:
    normalized_read = bool(can_read or can_write or can_admin)
    return normalized_read, bool(can_write), bool(can_admin)


def default_role_permission_map(role: UserRole) -> dict[SpaceKey, tuple[bool, bool, bool]]:
    permissions: dict[SpaceKey, tuple[bool, bool, bool]] = {}
    for key, _label, is_admin in DEFAULT_SPACE_CATALOG:
        if role == UserRole.admin:
            permissions[key] = (True, True, True if is_admin else False)
        elif role == UserRole.engineer:
            permissions[key] = (True, True, False) if key in WORK_SPACES else (False, False, False)
        else:
            permissions[key] = (True, False, False) if key in WORK_SPACES else (False, False, False)
    return permissions


def ensure_space_permissions_seeded(db) -> None:
    if db.scalar(select(AccessSpace).limit(1)) is None:
        for key, label, is_admin in DEFAULT_SPACE_CATALOG:
            db.add(AccessSpace(key=key.value, label=label, is_admin_space=is_admin))
        db.flush()

    if db.scalar(select(RoleSpacePermission).limit(1)) is not None:
        return

    for role in UserRole:
        for space_key, (can_read, can_write, can_admin) in default_role_permission_map(role).items():
            db.add(
                RoleSpacePermission(
                    role=role.value,
                    space_key=space_key.value,
                    can_read=can_read,
                    can_write=can_write,
                    can_admin=can_admin,
                )
            )
    db.flush()


def get_role_permissions(db, role: UserRole) -> list[RoleSpacePermission]:
    ensure_space_permissions_seeded(db)
    return db.scalars(
        select(RoleSpacePermission).where(RoleSpacePermission.role == role.value).order_by(RoleSpacePermission.space_key)
    ).all()


def build_user_permissions(db, user: User) -> list[SpacePermissionOut]:
    return [
        SpacePermissionOut(
            space_key=str(permission.space_key),
            can_read=bool(permission.can_read),
            can_write=bool(permission.can_write),
            can_admin=bool(permission.can_admin),
        )
        for permission in get_role_permissions(db, user.role)
    ]


def has_space_access(db, user: User, space_key: SpaceKey | str, action: str = "read") -> bool:
    normalized_space = SpaceKey(space_key).value if isinstance(space_key, str) else space_key.value
    permission = next(
        (entry for entry in get_role_permissions(db, user.role) if entry.space_key == normalized_space),
        None,
    )
    if permission is None:
        return False
    if action == "read":
        return bool(permission.can_read or permission.can_write or permission.can_admin)
    if action == "write":
        return bool(permission.can_write or permission.can_admin)
    if action == "admin":
        return bool(permission.can_admin)
    raise ValueError(f"Unsupported action: {action}")


def require_space_access(space_key: SpaceKey | str, action: str = "read"):
    def checker(db=Depends(get_db), user: User = Depends(get_current_user)):
        if not has_space_access(db, user, space_key, action):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return checker
