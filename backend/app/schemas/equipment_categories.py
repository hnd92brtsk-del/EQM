from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields, Pagination


class EquipmentCategoryOut(EntityBase, SoftDeleteFields):
    name: str


class EquipmentCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class EquipmentCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    is_deleted: bool | None = None


class EquipmentCategoryList(Pagination[EquipmentCategoryOut]):
    pass
