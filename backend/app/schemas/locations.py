from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields


class LocationOut(EntityBase, SoftDeleteFields):
    name: str
    parent_id: int | None = None


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    parent_id: int | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    parent_id: int | None = None
    is_deleted: bool | None = None
