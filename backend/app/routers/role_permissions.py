import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.access import ensure_space_permissions_seeded, normalize_permission_flags, require_space_access
from app.core.dependencies import get_db
from app.models.security import AccessSpace, RoleDefinition, RoleSpacePermission, SpaceKey, User
from app.schemas.role_permissions import (
    AccessSpaceOut,
    RoleDefinitionCreate,
    RoleDefinitionOut,
    RolePermissionsMatrixOut,
    RolePermissionsMatrixUpdate,
    RoleSpacePermissionOut,
)

router = APIRouter()
ROLE_KEY_PATTERN = re.compile(r"^[a-z0-9_-]+$")


@router.get("/", response_model=RolePermissionsMatrixOut)
def get_role_permissions_matrix(
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    ensure_space_permissions_seeded(db)
    roles = db.scalars(select(RoleDefinition).order_by(RoleDefinition.is_system.desc(), RoleDefinition.key.asc())).all()
    spaces = db.scalars(select(AccessSpace).order_by(AccessSpace.key)).all()
    permissions = db.scalars(select(RoleSpacePermission).order_by(RoleSpacePermission.role, RoleSpacePermission.space_key)).all()
    return RolePermissionsMatrixOut(
        roles=[
            RoleDefinitionOut(
                key=role.key,
                label=role.label,
                is_system=role.is_system,
            )
            for role in roles
        ],
        spaces=[
            AccessSpaceOut(
                key=str(space.key),
                label=space.label,
                is_admin_space=space.is_admin_space,
            )
            for space in spaces
        ],
        permissions=[
            RoleSpacePermissionOut(
                role=str(permission.role),
                space_key=str(permission.space_key),
                can_read=permission.can_read,
                can_write=permission.can_write,
                can_admin=permission.can_admin,
            )
            for permission in permissions
        ],
    )


@router.post("/roles", response_model=RoleDefinitionOut)
def create_role(
    payload: RoleDefinitionCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    ensure_space_permissions_seeded(db)
    role_key = payload.key.strip().lower()
    role_label = payload.label.strip()

    if not role_key:
        raise HTTPException(status_code=400, detail="Role key is required")
    if not role_label:
        raise HTTPException(status_code=400, detail="Role label is required")
    if not ROLE_KEY_PATTERN.fullmatch(role_key):
        raise HTTPException(status_code=400, detail="Role key may contain only latin letters, numbers, dash and underscore")
    if db.scalar(select(RoleDefinition).where(RoleDefinition.key == role_key)) is not None:
        raise HTTPException(status_code=400, detail="Role already exists")

    role = RoleDefinition(key=role_key, label=role_label, is_system=False)
    db.add(role)
    db.flush()

    for space in db.scalars(select(AccessSpace)).all():
        db.add(
            RoleSpacePermission(
                role=role.key,
                space_key=space.key,
                can_read=False,
                can_write=False,
                can_admin=False,
            )
        )

    db.commit()
    return RoleDefinitionOut(key=role.key, label=role.label, is_system=role.is_system)


@router.put("/", response_model=RolePermissionsMatrixOut)
def update_role_permissions_matrix(
    payload: RolePermissionsMatrixUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    ensure_space_permissions_seeded(db)
    role_map = {role.key: role for role in db.scalars(select(RoleDefinition)).all()}
    space_map = {space.key: space for space in db.scalars(select(AccessSpace)).all()}
    existing = {
        (permission.role, permission.space_key): permission
        for permission in db.scalars(select(RoleSpacePermission)).all()
    }

    for item in payload.permissions:
        role_key = item.role.strip().lower()
        if role_key not in role_map:
            raise HTTPException(status_code=400, detail=f"Role not found: {item.role}")
        space_key = item.space_key
        if space_key not in space_map:
            raise HTTPException(status_code=400, detail=f"Space not found: {item.space_key}")
        can_read, can_write, can_admin = normalize_permission_flags(item.can_read, item.can_write, item.can_admin)
        permission = existing.get((role_key, space_key))
        if permission is None:
            permission = RoleSpacePermission(role=role_key, space_key=space_key)
            db.add(permission)
        permission.can_read = can_read
        permission.can_write = can_write
        permission.can_admin = can_admin

    db.commit()
    return get_role_permissions_matrix(db, current_user)
