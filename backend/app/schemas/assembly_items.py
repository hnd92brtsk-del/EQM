from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields


class AssemblyItemOut(EntityBase, SoftDeleteFields):
    assembly_id: int
    equipment_type_id: int
    quantity: int
    location_full_path: str | None = None
    equipment_type_name: str | None = None
    manufacturer_name: str | None = None


class AssemblyItemCreate(BaseModel):
    assembly_id: int
    equipment_type_id: int
    quantity: int = Field(ge=0)


class AssemblyItemUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    is_deleted: bool | None = None
