from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields


class CabinetItemOut(EntityBase, SoftDeleteFields):
    cabinet_id: int
    equipment_type_id: int
    quantity: int


class CabinetItemCreate(BaseModel):
    cabinet_id: int
    equipment_type_id: int
    quantity: int = Field(ge=0)


class CabinetItemUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    is_deleted: bool | None = None
