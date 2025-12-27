from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from app.schemas.common import EntityBase, SoftDeleteFields


class EquipmentTypeOut(EntityBase, SoftDeleteFields):
    name: str
    nomenclature_number: str
    manufacturer_id: int
    equipment_category_id: int | None = None
    is_channel_forming: bool
    channel_count: int
    unit_price_rub: float | None = None
    meta_data: Optional[Dict[str, Any]] = None


class EquipmentTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    nomenclature_number: str = Field(min_length=1, max_length=100)
    manufacturer_id: int
    equipment_category_id: int | None = None
    is_channel_forming: bool = False
    channel_count: int = Field(default=0, ge=0)
    unit_price_rub: float | None = Field(default=None, ge=0)
    meta_data: Optional[Dict[str, Any]] = None


class EquipmentTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    manufacturer_id: int | None = None
    equipment_category_id: int | None = None
    is_channel_forming: bool | None = None
    channel_count: int | None = Field(default=None, ge=0)
    unit_price_rub: float | None = Field(default=None, ge=0)
    meta_data: Optional[Dict[str, Any]] = None
    is_deleted: bool | None = None
