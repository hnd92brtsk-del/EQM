from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, SoftDeleteFields


DigitalTwinScope = Literal["cabinet", "assembly"]
DigitalTwinItemKind = Literal["source-backed", "manual"]
DigitalTwinMountType = Literal["din-rail", "wall", "other"]
DigitalTwinPowerRole = Literal["consumer", "source", "converter", "passive"]
DigitalTwinItemStatus = Literal["active", "out_of_operation"]
DigitalTwinPlacementMode = Literal["unplaced", "rail", "wall"]


class DigitalTwinWall(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)


class DigitalTwinRail(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    wall_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    length_mm: int = Field(default=600, ge=1)
    sort_order: int = Field(default=0, ge=0)


class DigitalTwinPort(BaseModel):
    type: str = Field(min_length=1, max_length=64)
    count: int = Field(default=0, ge=0)


class DigitalTwinItem(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    item_kind: DigitalTwinItemKind
    source_status: DigitalTwinItemStatus = "active"
    placement_mode: DigitalTwinPlacementMode = "unplaced"
    name: str = Field(min_length=1, max_length=255)
    user_label: str | None = Field(default=None, max_length=255)
    equipment_item_source: DigitalTwinScope | None = None
    equipment_item_id: int | None = Field(default=None, ge=1)
    equipment_type_id: int | None = Field(default=None, ge=1)
    manufacturer_name: str | None = Field(default=None, max_length=255)
    article: str | None = Field(default=None, max_length=100)
    nomenclature_number: str | None = Field(default=None, max_length=100)
    quantity: int = Field(default=1, ge=1)
    current_type: str | None = Field(default=None, max_length=32)
    supply_voltage: str | None = Field(default=None, max_length=32)
    current_consumption_a: float | None = Field(default=None, ge=0)
    mount_type: DigitalTwinMountType | None = None
    mount_width_mm: int | None = Field(default=None, ge=0)
    power_role: DigitalTwinPowerRole | None = None
    output_voltage: str | None = Field(default=None, max_length=32)
    max_output_current_a: float | None = Field(default=None, ge=0)
    is_channel_forming: bool = False
    channel_count: int = Field(default=0, ge=0)
    ai_count: int = Field(default=0, ge=0)
    di_count: int = Field(default=0, ge=0)
    ao_count: int = Field(default=0, ge=0)
    do_count: int = Field(default=0, ge=0)
    is_network: bool = False
    network_ports: list[DigitalTwinPort] = Field(default_factory=list)
    has_serial_interfaces: bool = False
    serial_ports: list[DigitalTwinPort] = Field(default_factory=list)
    wall_id: str | None = Field(default=None, max_length=64)
    rail_id: str | None = Field(default=None, max_length=64)
    sort_order: int = Field(default=0, ge=0)


class DigitalTwinPowerNode(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    item_id: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=255)
    x: float = 0
    y: float = 0
    voltage: str | None = Field(default=None, max_length=32)
    role: DigitalTwinPowerRole | None = None
    status: DigitalTwinItemStatus = "active"


class DigitalTwinPowerEdge(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    source: str = Field(min_length=1, max_length=100)
    target: str = Field(min_length=1, max_length=100)
    label: str = Field(default="", max_length=255)
    voltage: str | None = Field(default=None, max_length=32)
    role: str | None = Field(default=None, max_length=64)


class DigitalTwinPowerGraph(BaseModel):
    nodes: list[DigitalTwinPowerNode] = Field(default_factory=list)
    edges: list[DigitalTwinPowerEdge] = Field(default_factory=list)


class DigitalTwinViewport(BaseModel):
    x: float = 0
    y: float = 0
    zoom: float = 1


class DigitalTwinUiState(BaseModel):
    active_wall_id: str | None = Field(default=None, max_length=64)
    active_layer: str = Field(default="all", max_length=32)
    selected_item_id: str | None = Field(default=None, max_length=100)


class DigitalTwinDocument(BaseModel):
    version: int = 1
    walls: list[DigitalTwinWall] = Field(default_factory=list)
    rails: list[DigitalTwinRail] = Field(default_factory=list)
    items: list[DigitalTwinItem] = Field(default_factory=list)
    powerGraph: DigitalTwinPowerGraph = Field(default_factory=DigitalTwinPowerGraph)
    viewport: DigitalTwinViewport = Field(default_factory=DigitalTwinViewport)
    ui: DigitalTwinUiState = Field(default_factory=DigitalTwinUiState)


class DigitalTwinDocumentUpdate(BaseModel):
    source_context: dict | None = None
    document: DigitalTwinDocument | None = None


class DigitalTwinDocumentOut(EntityBase, SoftDeleteFields):
    scope: DigitalTwinScope
    source_id: int
    source_context: dict | None = None
    document: DigitalTwinDocument
    created_by_id: int | None = None
    updated_by_id: int | None = None
