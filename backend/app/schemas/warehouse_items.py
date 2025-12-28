from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields


class WarehouseItemOut(EntityBase, SoftDeleteFields):
    warehouse_id: int
    equipment_type_id: int
    quantity: int
    equipment_type_name: str | None = None
    equipment_category_name: str | None = None
    manufacturer_name: str | None = None
    unit_price_rub: float | None = None


class WarehouseItemCreate(BaseModel):
    warehouse_id: int
    equipment_type_id: int
    quantity: int = Field(ge=0)


class WarehouseItemUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    is_deleted: bool | None = None
