from typing import List

from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, SoftDeleteFields


class DataTypeOut(EntityBase, SoftDeleteFields):
    name: str
    parent_id: int | None = None
    tooltip: str | None = None


class DataTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: int | None = None
    tooltip: str | None = None


class DataTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: int | None = None
    tooltip: str | None = None
    is_deleted: bool | None = None


class DataTypeTreeNode(BaseModel):
    id: int
    name: str
    tooltip: str | None = None
    children: List["DataTypeTreeNode"] = Field(default_factory=list)


DataTypeTreeNode.model_rebuild()
