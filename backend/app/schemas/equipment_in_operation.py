from datetime import datetime
from pydantic import BaseModel


class EquipmentInOperationOut(BaseModel):
    id: int
    source: str
    container_id: int
    container_name: str
    equipment_type_id: int
    equipment_type_name: str | None = None
    manufacturer_name: str | None = None
    quantity: int
    location_full_path: str | None = None
    is_deleted: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
