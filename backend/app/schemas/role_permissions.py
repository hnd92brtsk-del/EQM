from pydantic import BaseModel

class AccessSpaceOut(BaseModel):
    key: str
    label: str
    is_admin_space: bool


class RoleDefinitionOut(BaseModel):
    key: str
    label: str
    is_system: bool


class RoleSpacePermissionOut(BaseModel):
    role: str
    space_key: str
    can_read: bool
    can_write: bool
    can_admin: bool


class RolePermissionsMatrixOut(BaseModel):
    roles: list[RoleDefinitionOut]
    spaces: list[AccessSpaceOut]
    permissions: list[RoleSpacePermissionOut]


class RoleSpacePermissionUpdate(BaseModel):
    role: str
    space_key: str
    can_read: bool
    can_write: bool
    can_admin: bool


class RolePermissionsMatrixUpdate(BaseModel):
    permissions: list[RoleSpacePermissionUpdate]


class RoleDefinitionCreate(BaseModel):
    key: str
    label: str
