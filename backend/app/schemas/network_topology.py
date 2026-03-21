from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, Pagination, SoftDeleteFields
from app.schemas.ipam import EquipmentNetworkInterfaceOut


class TopologyViewport(BaseModel):
    x: float
    y: float


class NodeInterface(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    ip: str = Field(default="", max_length=64)
    vlan: str = Field(default="", max_length=255)
    status: Literal["up", "down", "degraded"] = "up"


class RouteEntry(BaseModel):
    prefix: str = Field(default="", max_length=128)
    nextHop: str = Field(default="", max_length=128)
    protocol: str = Field(default="static", max_length=64)
    metric: int | str = 0


HealthStatus = Literal["healthy", "warning", "critical"]
EdgeStyle = Literal["ethernet", "fiber", "vpn", "wireless", "mpls", "trunk"]
NetworkLayer = Literal["core", "distribution", "access", "security", "datacenter", "wan", "edge"]
NodeType = Literal[
    "router",
    "core-switch",
    "switch",
    "firewall",
    "load-balancer",
    "vpn-gateway",
    "wireless-controller",
    "access-point",
    "server",
    "vm-host",
    "storage",
    "nas",
    "cloud",
    "internet",
    "workstation",
    "printer",
    "camera",
    "iot-gateway",
]


class NetworkNode(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    type: NodeType
    x: float
    y: float
    ip: str = Field(default="", max_length=64)
    vlan: str = Field(default="", max_length=255)
    zone: str = Field(default="", max_length=255)
    asn: str = Field(default="", max_length=64)
    layer: NetworkLayer
    status: HealthStatus
    model: str = Field(default="", max_length=255)
    os: str = Field(default="", max_length=255)
    interfaces: list[NodeInterface] = Field(default_factory=list)
    routes: list[RouteEntry] = Field(default_factory=list)
    services: list[str] = Field(default_factory=list)


class NetworkEdge(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    from_: str = Field(alias="from", min_length=1, max_length=100)
    to: str = Field(min_length=1, max_length=100)
    label: str = Field(default="", max_length=255)
    style: EdgeStyle
    bandwidth: str = Field(default="", max_length=128)
    latency: str = Field(default="", max_length=128)
    status: HealthStatus
    network: str = Field(default="", max_length=255)

    model_config = {"populate_by_name": True}


class TopologyPolicy(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(min_length=1, max_length=100)
    target: str = Field(min_length=1, max_length=255)
    state: Literal["active", "triggered", "disabled"]


class TopologyDocument(BaseModel):
    nodes: list[NetworkNode] = Field(default_factory=list)
    edges: list[NetworkEdge] = Field(default_factory=list)
    policies: list[TopologyPolicy] = Field(default_factory=list)
    viewport: TopologyViewport | None = None
    zoom: float | None = None


class NetworkTopologyDocumentBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    scope: str | None = Field(default=None, max_length=64)
    location_id: int | None = None
    source_context: dict | None = None
    document: TopologyDocument


class NetworkTopologyDocumentCreate(NetworkTopologyDocumentBase):
    pass


class NetworkTopologyDocumentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    scope: str | None = Field(default=None, max_length=64)
    location_id: int | None = None
    source_context: dict | None = None
    document: TopologyDocument | None = None


class NetworkTopologyDocumentOut(EntityBase, SoftDeleteFields):
    name: str
    description: str | None = None
    scope: str | None = None
    location_id: int | None = None
    source_context: dict | None = None
    document: TopologyDocument
    created_by_id: int | None = None
    updated_by_id: int | None = None


class NetworkTopologyEligibleEquipmentOut(BaseModel):
    equipment_source: str
    equipment_item_id: int
    equipment_instance_id: int | None = None
    display_name: str
    source: str
    cabinet_id: int | None = None
    cabinet_name: str | None = None
    assembly_id: int | None = None
    assembly_name: str | None = None
    location: str | None = None
    manufacturer_id: int | None = None
    manufacturer_name: str | None = None
    equipment_type_id: int
    equipment_type_name: str
    inventory_number: str | None = None
    serial: str | None = None
    tag: str | None = None
    has_network_interfaces: bool
    current_ip_links_count: int
    network_interfaces: list[EquipmentNetworkInterfaceOut] = Field(default_factory=list)
    linked_ip_addresses: list[str] = Field(default_factory=list)
    primary_ip: str | None = None


class NetworkTopologyDuplicatePayload(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
