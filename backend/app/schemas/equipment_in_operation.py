from datetime import datetime
from pydantic import BaseModel, Field


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
    equipment_type_photo_url: str | None = None
    equipment_type_datasheet_url: str | None = None
    equipment_type_datasheet_name: str | None = None
    equipment_type_meta_data: dict | None = None
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


class EquipmentInOperationContainerOut(BaseModel):
    source: str
    container_id: int
    container_name: str
    container_factory_number: str | None = None
    container_inventory_number: str | None = None
    location_full_path: str | None = None
    container_is_deleted: bool = False
    is_empty: bool
    quantity_sum: int
    active_items_count: int = 0
    deleted_items_count: int = 0
    equipment_type_name_sort: str | None = None
    manufacturer_name_sort: str | None = None
    created_at: datetime | None = None


class EquipmentInOperationContainerNode(EquipmentInOperationContainerOut):
    pass


class EquipmentInOperationLocationNode(BaseModel):
    location_id: int
    location_name: str
    location_full_path: str
    active_containers_count: int
    deleted_containers_count: int
    quantity_sum: int
    children: list["EquipmentInOperationLocationNode"] = Field(default_factory=list)
    containers: list[EquipmentInOperationContainerNode] = Field(default_factory=list)


EquipmentInOperationLocationNode.model_rebuild()
