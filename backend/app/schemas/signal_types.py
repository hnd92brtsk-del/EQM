from pydantic import BaseModel, Field
from typing import List

from app.schemas.common import EntityBase, SoftDeleteFields


class SignalTypeOut(EntityBase, SoftDeleteFields):
    name: str
    parent_id: int | None = None
    sort_order: int | None = None


class SignalTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: int | None = None
    sort_order: int | None = None


class SignalTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: int | None = None
    sort_order: int | None = None
    is_deleted: bool | None = None


class SignalTypeTreeNode(BaseModel):
    id: int
    name: str
    children: List["SignalTypeTreeNode"] = Field(default_factory=list)


SignalTypeTreeNode.model_rebuild()
