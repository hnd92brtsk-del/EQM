from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.access import DEFAULT_SPACE_CATALOG, ensure_space_permissions_seeded, normalize_permission_flags, require_space_access
from app.core.dependencies import get_db
from app.models.security import AccessSpace, RoleSpacePermission, SpaceKey, User, UserRole
from app.schemas.role_permissions import (
    AccessSpaceOut,
    RolePermissionsMatrixOut,
    RolePermissionsMatrixUpdate,
    RoleSpacePermissionOut,
)

router = APIRouter()


@router.get("/", response_model=RolePermissionsMatrixOut)
def get_role_permissions_matrix(
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    ensure_space_permissions_seeded(db)
    spaces = db.scalars(select(AccessSpace).order_by(AccessSpace.key)).all()
    permissions = db.scalars(select(RoleSpacePermission).order_by(RoleSpacePermission.role, RoleSpacePermission.space_key)).all()
    return RolePermissionsMatrixOut(
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


@router.put("/", response_model=RolePermissionsMatrixOut)
def update_role_permissions_matrix(
    payload: RolePermissionsMatrixUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    ensure_space_permissions_seeded(db)
    space_map = {space.key: space for space in db.scalars(select(AccessSpace)).all()}
    existing = {
        (permission.role, permission.space_key): permission
        for permission in db.scalars(select(RoleSpacePermission)).all()
    }

    for item in payload.permissions:
        role = UserRole(item.role)
        space_key = SpaceKey(item.space_key).value
        can_read, can_write, can_admin = normalize_permission_flags(item.can_read, item.can_write, item.can_admin)
        permission = existing.get((role, space_key))
        if permission is None:
            permission = RoleSpacePermission(role=role.value, space_key=space_key)
            db.add(permission)
        permission.can_read = can_read
        permission.can_write = can_write
        permission.can_admin = can_admin

    db.commit()
    return get_role_permissions_matrix(db, current_user)
