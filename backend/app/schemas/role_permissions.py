from pydantic import BaseModel

from app.schemas.users import UserRole


class AccessSpaceOut(BaseModel):
    key: str
    label: str
    is_admin_space: bool


class RoleSpacePermissionOut(BaseModel):
    role: UserRole
    space_key: str
    can_read: bool
    can_write: bool
    can_admin: bool


class RolePermissionsMatrixOut(BaseModel):
    spaces: list[AccessSpaceOut]
    permissions: list[RoleSpacePermissionOut]


class RoleSpacePermissionUpdate(BaseModel):
    role: UserRole
    space_key: str
    can_read: bool
    can_write: bool
    can_admin: bool


class RolePermissionsMatrixUpdate(BaseModel):
    permissions: list[RoleSpacePermissionUpdate]
