from enum import Enum
from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields


class UserRole(str, Enum):
    admin = "admin"
    engineer = "engineer"
    viewer = "viewer"


class UserOut(EntityBase, SoftDeleteFields):
    username: str
    role: UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole


class UserUpdate(BaseModel):
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = None
    is_deleted: bool | None = None
