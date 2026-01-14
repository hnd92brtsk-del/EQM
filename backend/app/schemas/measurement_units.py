from pydantic import BaseModel, Field
from typing import List

from app.schemas.common import EntityBase, SoftDeleteFields


class MeasurementUnitOut(EntityBase, SoftDeleteFields):
    name: str
    parent_id: int | None = None
    sort_order: int | None = None


class MeasurementUnitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: int | None = None
    sort_order: int | None = None


class MeasurementUnitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: int | None = None
    sort_order: int | None = None
    is_deleted: bool | None = None


class MeasurementUnitTreeNode(BaseModel):
    id: int
    name: str
    children: List["MeasurementUnitTreeNode"] = Field(default_factory=list)


MeasurementUnitTreeNode.model_rebuild()
