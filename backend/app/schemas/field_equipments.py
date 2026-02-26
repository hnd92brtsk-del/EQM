from pydantic import BaseModel, Field
from typing import List

from app.schemas.common import EntityBase, SoftDeleteFields


class FieldEquipmentOut(EntityBase, SoftDeleteFields):
    name: str
    parent_id: int | None = None


class FieldEquipmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: int | None = None


class FieldEquipmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: int | None = None
    is_deleted: bool | None = None


class FieldEquipmentTreeNode(BaseModel):
    id: int
    name: str
    children: List["FieldEquipmentTreeNode"] = Field(default_factory=list)


FieldEquipmentTreeNode.model_rebuild()
