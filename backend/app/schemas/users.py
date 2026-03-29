from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, SoftDeleteFields


class SpacePermissionOut(BaseModel):
    space_key: str
    can_read: bool
    can_write: bool
    can_admin: bool


class UserOut(EntityBase, SoftDeleteFields):
    username: str
    role: str
    permissions: list[SpacePermissionOut] = []


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(min_length=2, max_length=64)


class UserUpdate(BaseModel):
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: str | None = Field(default=None, min_length=2, max_length=64)
    is_deleted: bool | None = None
