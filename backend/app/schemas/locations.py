from pydantic import BaseModel, Field
from typing import List
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


class LocationTreeNode(BaseModel):
    id: int
    name: str
    children: List["LocationTreeNode"] = Field(default_factory=list)


LocationTreeNode.model_rebuild()
