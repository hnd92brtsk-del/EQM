from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, Pagination, SoftDeleteFields


class VlanBase(BaseModel):
    vlan_number: int = Field(ge=1, le=4094)
    name: str = Field(min_length=1, max_length=200)
    purpose: str | None = None
    description: str | None = None
    location_id: int | None = None
    is_active: bool = True


class VlanCreate(VlanBase):
    pass


class VlanUpdate(BaseModel):
    vlan_number: int | None = Field(default=None, ge=1, le=4094)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    purpose: str | None = None
    description: str | None = None
    location_id: int | None = None
    is_active: bool | None = None


class VlanOut(EntityBase, SoftDeleteFields):
    vlan_number: int
    name: str
    purpose: str | None = None
    description: str | None = None
    location_id: int | None = None
    is_active: bool


class SubnetBase(BaseModel):
    vlan_id: int | None = None
    cidr: str
    gateway_ip: str | None = None
    name: str | None = None
    description: str | None = None
    location_id: int | None = None
    vrf: str | None = None
    is_active: bool = True


class SubnetCreate(SubnetBase):
    pass


class SubnetUpdate(BaseModel):
    vlan_id: int | None = None
    gateway_ip: str | None = None
    name: str | None = None
    description: str | None = None
    location_id: int | None = None
    vrf: str | None = None
    is_active: bool | None = None


class SubnetOut(EntityBase, SoftDeleteFields):
    vlan_id: int | None = None
    vlan_number: int | None = None
    vlan_name: str | None = None
    cidr: str
    prefix: int
    network_address: str
    gateway_ip: str | None = None
    name: str | None = None
    description: str | None = None
    location_id: int | None = None
    vrf: str | None = None
    is_active: bool


class EquipmentNetworkInterfaceOut(EntityBase, SoftDeleteFields):
    equipment_instance_id: int
    interface_name: str
    interface_index: int | None = None
    interface_type: str | None = None
    connector_spec: str | None = None
    mac_address: str | None = None
    is_management: bool
    is_active: bool


class EligibleEquipmentOut(BaseModel):
    equipment_instance_id: int
    display_name: str
    source: str = "cabinet"
    cabinet_id: int
    cabinet_name: str
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


class IPAddressDetailsOut(EntityBase, SoftDeleteFields):
    id: int | None = None
    subnet_id: int
    ip_address: str
    ip_offset: int
    status: str
    hostname: str | None = None
    dns_name: str | None = None
    mac_address: str | None = None
    comment: str | None = None
    equipment_instance_id: int | None = None
    equipment_interface_id: int | None = None
    equipment_interface_name: str | None = None
    is_primary: bool = True
    source: str | None = None
    last_seen_at: datetime | None = None
    is_service: bool = False
    is_editable: bool = True


class IPAddressUpdate(BaseModel):
    status: str | None = None
    hostname: str | None = None
    dns_name: str | None = None
    comment: str | None = None
    equipment_instance_id: int | None = None
    equipment_interface_id: int | None = None
    is_primary: bool | None = None
    mac_address: str | None = None


class IPAssignPayload(BaseModel):
    hostname: str | None = None
    dns_name: str | None = None
    comment: str | None = None
    equipment_instance_id: int
    equipment_interface_id: int
    is_primary: bool = True
    mac_address: str | None = None


class IPReservePayload(BaseModel):
    hostname: str | None = None
    comment: str | None = None


class AddressSummaryOut(BaseModel):
    total: int
    free: int
    used: int
    reserved: int
    gateway: int
    broadcast: int
    network: int


class HeatmapAggregateOut(BaseModel):
    block_cidr: str
    offset_start: int
    offset_end: int
    free: int
    used: int
    reserved: int
    gateway: int
    broadcast: int
    network: int


class AddressGridResponse(BaseModel):
    subnet: SubnetOut
    summary: AddressSummaryOut
    mode: str
    items: list[IPAddressDetailsOut] = Field(default_factory=list)
    aggregates: list[HeatmapAggregateOut] = Field(default_factory=list)
    pagination: Pagination[Any] | None = None


class IPAddressAuditLogOut(BaseModel):
    id: int
    ip_address_id: int | None = None
    subnet_id: int
    ip_address: str
    action: str
    old_status: str | None = None
    new_status: str | None = None
    old_hostname: str | None = None
    new_hostname: str | None = None
    old_equipment_instance_id: int | None = None
    new_equipment_instance_id: int | None = None
    actor_user_id: int | None = None
    payload_json: dict[str, Any]
    created_at: datetime


class CabinetItemIPAMSummaryOut(BaseModel):
    eligible_for_ipam: bool
    network_interfaces_count: int
    linked_ip_addresses: list[str] = Field(default_factory=list)
    linked_subnets: list[str] = Field(default_factory=list)
    current_ip_links_count: int = 0
