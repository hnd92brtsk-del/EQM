from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, SoftDeleteFields


class TechnologicalEquipmentOut(EntityBase, SoftDeleteFields):
    name: str
    main_equipment_id: int
    main_equipment_name: str | None = None
    main_equipment_drive_id: int | None = None
    main_equipment_full_path: str | None = None
    main_equipment_drive_full_path: str | None = None
    type_display: str | None = None
    tag: str | None = None
    location_id: int | None = None
    location_name: str | None = None
    location_path: str | None = None
    description: str | None = None


class TechnologicalEquipmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    main_equipment_id: int
    main_equipment_drive_id: int | None = None
    tag: str | None = Field(default=None, max_length=120)
    location_id: int | None = None
    description: str | None = None


class TechnologicalEquipmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    main_equipment_id: int | None = None
    main_equipment_drive_id: int | None = None
    tag: str | None = Field(default=None, max_length=120)
    location_id: int | None = None
    description: str | None = None
    is_deleted: bool | None = None
