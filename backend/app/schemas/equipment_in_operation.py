from datetime import datetime
from pydantic import BaseModel


class EquipmentInOperationOut(BaseModel):
    id: int
    source: str
    container_id: int
    container_name: str
    container_factory_number: str | None = None
    container_inventory_number: str | None = None
    equipment_type_id: int
    equipment_type_name: str | None = None
    equipment_type_article: str | None = None
    equipment_type_inventory_number: str | None = None
    network_ports: list[dict] | None = None
    serial_ports: list[dict] | None = None
    is_channel_forming: bool | None = None
    channel_count: int | None = None
    can_edit_quantity: bool = True
    manufacturer_name: str | None = None
    quantity: int
    location_full_path: str | None = None
    is_deleted: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
