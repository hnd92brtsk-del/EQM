from pydantic import BaseModel, Field
from typing import List

from app.schemas.common import EntityBase, SoftDeleteFields


class MainEquipmentOut(EntityBase, SoftDeleteFields):
    name: str
    parent_id: int | None = None
    level: int
    code: str
    meta_data: dict | None = None


class MainEquipmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: int | None = None
    code: str | None = Field(default=None, max_length=50)
    meta_data: dict | None = None


class MainEquipmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: int | None = None
    code: str | None = Field(default=None, max_length=50)
    meta_data: dict | None = None
    is_deleted: bool | None = None


class MainEquipmentTreeNode(BaseModel):
    id: int
    name: str
    level: int
    code: str
    children: List["MainEquipmentTreeNode"] = Field(default_factory=list)


MainEquipmentTreeNode.model_rebuild()

