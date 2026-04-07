from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import inspect
from sqlalchemy import select

from app.core.dependencies import get_current_user, get_db
from app.models.security import AccessSpace, RoleDefinition, RoleSpacePermission, SpaceKey, User, UserRole
from app.schemas.users import SpacePermissionOut

WORK_SPACES = {
    SpaceKey.overview,
    SpaceKey.personnel,
    SpaceKey.equipment,
    SpaceKey.cabinets,
    SpaceKey.engineering,
    SpaceKey.maintenance,
    SpaceKey.dictionaries,
}

DEFAULT_SPACE_CATALOG: list[tuple[SpaceKey, str, bool]] = [
    (SpaceKey.overview, "Overview", False),
    (SpaceKey.personnel, "Personnel", False),
    (SpaceKey.equipment, "Equipment", False),
    (SpaceKey.cabinets, "Cabinets", False),
    (SpaceKey.engineering, "Engineering", False),
    (SpaceKey.maintenance, "Maintenance", False),
    (SpaceKey.dictionaries, "Dictionaries", False),
    (SpaceKey.admin_users, "Admin Users", True),
    (SpaceKey.admin_sessions, "Admin Sessions", True),
    (SpaceKey.admin_audit, "Admin Audit", True),
    (SpaceKey.admin_diagnostics, "Admin Diagnostics", True),
]

DEFAULT_ROLE_CATALOG: list[tuple[str, str, bool]] = [
    (UserRole.admin.value, "Administrator", True),
    (UserRole.engineer.value, "Engineer", True),
    (UserRole.viewer.value, "Viewer", True),
]


def normalize_permission_flags(can_read: bool, can_write: bool, can_admin: bool) -> tuple[bool, bool, bool]:
    normalized_read = bool(can_read or can_write or can_admin)
    return normalized_read, bool(can_write), bool(can_admin)


def normalize_role_key(role: str | UserRole) -> str:
    return role.value if isinstance(role, UserRole) else str(role)


def default_role_permission_map(role: str | UserRole) -> dict[SpaceKey, tuple[bool, bool, bool]]:
    normalized_role = normalize_role_key(role)
    permissions: dict[SpaceKey, tuple[bool, bool, bool]] = {}
    for key, _label, is_admin in DEFAULT_SPACE_CATALOG:
        if normalized_role == UserRole.admin.value:
            permissions[key] = (True, True, True if is_admin else False)
        elif normalized_role == UserRole.engineer.value:
            permissions[key] = (True, True, False) if key in WORK_SPACES else (False, False, False)
        else:
            permissions[key] = (True, False, False) if key in WORK_SPACES else (False, False, False)
    return permissions


def ensure_space_permissions_seeded(db) -> None:
    bind = db.get_bind()
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "role_definitions" not in existing_tables:
        RoleDefinition.__table__.create(bind, checkfirst=True)
        existing_tables.add("role_definitions")

    existing_spaces = {space.key: space for space in db.scalars(select(AccessSpace)).all()}
    for key, label, is_admin in DEFAULT_SPACE_CATALOG:
        if key.value not in existing_spaces:
            db.add(AccessSpace(key=key.value, label=label, is_admin_space=is_admin))

    existing_roles = {role.key: role for role in db.scalars(select(RoleDefinition)).all()}
    for key, label, is_system in DEFAULT_ROLE_CATALOG:
        if key not in existing_roles:
            db.add(RoleDefinition(key=key, label=label, is_system=is_system))

    db.flush()

    existing_permissions = {
        (permission.role, permission.space_key): permission
        for permission in db.scalars(select(RoleSpacePermission)).all()
    }
    for role_key, _label, _is_system in DEFAULT_ROLE_CATALOG:
        for space_key, (can_read, can_write, can_admin) in default_role_permission_map(role_key).items():
            key = (role_key, space_key.value)
            if key in existing_permissions:
                continue
            db.add(
                RoleSpacePermission(
                    role=role_key,
                    space_key=space_key.value,
                    can_read=can_read,
                    can_write=can_write,
                    can_admin=can_admin,
                )
            )
    db.flush()


def get_role_permissions(db, role: str | UserRole) -> list[RoleSpacePermission]:
    ensure_space_permissions_seeded(db)
    normalized_role = normalize_role_key(role)
    return db.scalars(
        select(RoleSpacePermission).where(RoleSpacePermission.role == normalized_role).order_by(RoleSpacePermission.space_key)
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
