from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields


class WarehouseItemOut(EntityBase, SoftDeleteFields):
    warehouse_id: int
    equipment_type_id: int
    quantity: int


class WarehouseItemCreate(BaseModel):
    warehouse_id: int
    equipment_type_id: int
    quantity: int = Field(ge=0)


class WarehouseItemUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    is_deleted: bool | None = None
