from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields, Pagination


class EquipmentCategoryOut(EntityBase, SoftDeleteFields):
    name: str
    parent_id: int | None = None
    full_path: str | None = None


class EquipmentCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: int | None = None


class EquipmentCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: int | None = None
    is_deleted: bool | None = None


class EquipmentCategoryList(Pagination[EquipmentCategoryOut]):
    pass


class EquipmentCategoryTreeNode(BaseModel):
    id: int
    name: str
    parent_id: int | None = None
    full_path: str | None = None
    is_deleted: bool = False
    children: list["EquipmentCategoryTreeNode"] = Field(default_factory=list)


EquipmentCategoryTreeNode.model_rebuild()
