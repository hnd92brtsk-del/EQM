from __future__ import annotations

import csv
import ipaddress
from collections import Counter
from datetime import datetime
from io import StringIO

from fastapi import HTTPException
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import selectinload

from app.models.core import Cabinet, EquipmentType, Location, Manufacturer
from app.models.assemblies import Assembly
from app.models.ipam import EquipmentNetworkInterface, IPAddress, IPAddressAuditLog, Subnet
from app.models.operations import AssemblyItem, CabinetItem
from app.schemas.common import Pagination
from app.schemas.ipam import (
    AddressGridResponse,
    AddressSummaryOut,
    CabinetItemIPAMSummaryOut,
    EquipmentNetworkInterfaceOut,
    HeatmapAggregateOut,
    HostEquipmentTreeLeaf,
    HostEquipmentTreeNode,
    IPAddressDetailsOut,
    SubnetCalculatorCreate,
    SubnetOut,
)

SERVICE_STATUSES = {"network", "broadcast", "gateway"}
DEFAULT_SOURCE = "manual"
EQUIPMENT_SOURCES = {"cabinet", "assembly"}


def build_location_full_path(location_id: int | None, locations_map: dict[int, Location]) -> str | None:
    if not location_id or location_id not in locations_map:
        return None
    parts: list[str] = []
    current_id: int | None = location_id
    seen: set[int] = set()
    while current_id and current_id in locations_map and current_id not in seen:
        location = locations_map[current_id]
        parts.append(location.name)
        seen.add(current_id)
        current_id = location.parent_id
    return " / ".join(reversed(parts))


def parse_network_ports(network_ports: list[dict] | None) -> list[dict]:
    result: list[dict] = []
    if not isinstance(network_ports, list):
        return result
    for item in network_ports:
        if not isinstance(item, dict):
            continue
        port_type = str(item.get("type") or "").strip()
        count = int(item.get("count") or 0)
        if port_type and count > 0:
            result.append({"type": port_type, "count": count})
    return result


def equipment_has_network_interfaces(equipment_type: EquipmentType | None) -> bool:
    if not equipment_type or equipment_type.is_deleted:
        return False
    return any(item["count"] > 0 for item in parse_network_ports(equipment_type.network_ports))


def normalize_equipment_target(
    equipment_source: str | None,
    equipment_item_id: int | None,
    equipment_instance_id: int | None = None,
) -> tuple[str, int]:
    if equipment_source:
        source = equipment_source.strip().lower()
        if source not in EQUIPMENT_SOURCES:
            raise HTTPException(status_code=400, detail="Unsupported equipment source")
        if not equipment_item_id:
            raise HTTPException(status_code=400, detail="Equipment item id is required")
        return source, equipment_item_id
    if equipment_instance_id:
        return "cabinet", equipment_instance_id
    raise HTTPException(status_code=400, detail="Equipment target is required")


def get_cabinet_item_or_404(db, equipment_instance_id: int) -> CabinetItem:
    item = db.scalar(
        select(CabinetItem)
        .options(
            selectinload(CabinetItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(CabinetItem.cabinet),
        )
        .where(CabinetItem.id == equipment_instance_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Equipment in operation not found")
    return item


def get_assembly_item_or_404(db, equipment_item_id: int) -> AssemblyItem:
    item = db.scalar(
        select(AssemblyItem)
        .options(
            selectinload(AssemblyItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(AssemblyItem.assembly),
        )
        .where(AssemblyItem.id == equipment_item_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Assembly equipment in operation not found")
    return item


def get_equipment_item_or_404(db, equipment_source: str, equipment_item_id: int):
    if equipment_source == "cabinet":
        return get_cabinet_item_or_404(db, equipment_item_id)
    if equipment_source == "assembly":
        return get_assembly_item_or_404(db, equipment_item_id)
    raise HTTPException(status_code=400, detail="Unsupported equipment source")


def ensure_eligible_equipment_item(db, equipment_source: str, equipment_item_id: int):
    item = get_equipment_item_or_404(db, equipment_source, equipment_item_id)
    if item.is_deleted:
        raise HTTPException(status_code=400, detail="Equipment item is deleted")
    if equipment_source == "cabinet":
        if not item.cabinet_id or not item.cabinet or item.cabinet.is_deleted:
            raise HTTPException(status_code=400, detail="Equipment instance is not installed in cabinet")
    else:
        if not item.assembly_id or not item.assembly or item.assembly.is_deleted:
            raise HTTPException(status_code=400, detail="Equipment instance is not available in assembly")
    if not equipment_has_network_interfaces(item.equipment_type):
        raise HTTPException(status_code=400, detail="Equipment instance has no network interfaces")
    return item


def sync_equipment_network_interfaces(db, equipment_item, equipment_source: str | None = None) -> list[EquipmentNetworkInterface]:
    if equipment_source is None:
        equipment_source = "assembly" if isinstance(equipment_item, AssemblyItem) else "cabinet"
    item_id = equipment_item.id
    cabinet_item_id = equipment_item.id if equipment_source == "cabinet" else None
    ports = parse_network_ports(equipment_item.equipment_type.network_ports if equipment_item.equipment_type else None)
    existing = db.scalars(
        select(EquipmentNetworkInterface).where(
            EquipmentNetworkInterface.equipment_item_source == equipment_source,
            EquipmentNetworkInterface.equipment_item_id == item_id,
        )
    ).all()
    if not existing and cabinet_item_id is not None:
        existing = db.scalars(
            select(EquipmentNetworkInterface).where(EquipmentNetworkInterface.equipment_instance_id == cabinet_item_id)
        ).all()
    existing_map = {(item.interface_type, item.interface_index): item for item in existing}
    valid_pairs: set[tuple[str, int]] = set()
    for port in ports:
        port_type = port["type"]
        count = port["count"]
        for index in range(1, count + 1):
            interface_index = index if count > 1 else 1
            valid_pairs.add((port_type, interface_index))
            item = existing_map.get((port_type, interface_index))
            interface_name = f"{port_type} Port {index}" if count > 1 else port_type
            if item:
                item.equipment_instance_id = cabinet_item_id
                item.equipment_item_source = equipment_source
                item.equipment_item_id = item_id
                item.interface_name = interface_name
                item.interface_type = port_type
                item.interface_index = interface_index
                item.connector_spec = port_type
                item.is_active = True
                item.is_deleted = False
                item.deleted_at = None
                item.deleted_by_id = None
            else:
                db.add(
                    EquipmentNetworkInterface(
                        equipment_instance_id=cabinet_item_id,
                        equipment_item_source=equipment_source,
                        equipment_item_id=item_id,
                        interface_name=interface_name,
                        interface_index=interface_index,
                        interface_type=port_type,
                        connector_spec=port_type,
                        is_active=True,
                    )
                )
    db.flush()
    all_items = db.scalars(
        select(EquipmentNetworkInterface)
        .where(
            EquipmentNetworkInterface.equipment_item_source == equipment_source,
            EquipmentNetworkInterface.equipment_item_id == item_id,
        )
        .order_by(EquipmentNetworkInterface.interface_type, EquipmentNetworkInterface.interface_index)
    ).all()
    for item in all_items:
        if (item.interface_type, item.interface_index) not in valid_pairs:
            item.is_active = False
    return all_items


def validate_subnet_cidr(cidr: str) -> tuple[ipaddress.IPv4Network, int]:
    try:
        network = ipaddress.ip_network(cidr, strict=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CIDR: {cidr}") from exc
    if network.version != 4:
        raise HTTPException(status_code=400, detail="Only IPv4 is supported")
    return network, network.prefixlen


def validate_ip_in_subnet(ip_address: str, network: ipaddress.IPv4Network) -> ipaddress.IPv4Address:
    try:
        ip = ipaddress.ip_address(ip_address)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid IP address: {ip_address}") from exc
    if ip.version != 4 or ip not in network:
        raise HTTPException(status_code=400, detail="IP is outside subnet range")
    return ip


def get_subnet_network(subnet: Subnet) -> ipaddress.IPv4Network:
    return ipaddress.ip_network(subnet.cidr, strict=True)


def subnet_to_out(subnet: Subnet) -> SubnetOut:
    return SubnetOut(
        id=subnet.id,
        vlan_id=subnet.vlan_id,
        vlan_number=subnet.vlan.vlan_number if subnet.vlan else None,
        vlan_name=subnet.vlan.name if subnet.vlan else None,
        cidr=subnet.cidr,
        prefix=subnet.prefix,
        network_address=subnet.network_address,
        gateway_ip=subnet.gateway_ip,
        name=subnet.name,
        description=subnet.description,
        location_id=subnet.location_id,
        vrf=subnet.vrf,
        is_active=subnet.is_active,
        created_at=subnet.created_at,
        updated_at=subnet.updated_at,
        is_deleted=subnet.is_deleted,
        deleted_at=subnet.deleted_at,
    )


def interface_to_out(item: EquipmentNetworkInterface) -> EquipmentNetworkInterfaceOut:
    return EquipmentNetworkInterfaceOut(
        id=item.id,
        equipment_instance_id=item.equipment_instance_id,
        equipment_item_source=item.equipment_item_source,
        equipment_item_id=item.equipment_item_id,
        interface_name=item.interface_name,
        interface_index=item.interface_index,
        interface_type=item.interface_type,
        connector_spec=item.connector_spec,
        mac_address=item.mac_address,
        is_management=item.is_management,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
        is_deleted=item.is_deleted,
        deleted_at=item.deleted_at,
    )


def ensure_service_address_records(db, subnet: Subnet) -> None:
    network = get_subnet_network(subnet)
    records = {
        0: ("network", str(network.network_address)),
        network.num_addresses - 1: ("broadcast", str(network.broadcast_address)),
    }
    if subnet.gateway_ip:
        gateway_ip = validate_ip_in_subnet(subnet.gateway_ip, network)
        records[int(gateway_ip) - int(network.network_address)] = ("gateway", str(gateway_ip))
    existing = {
        record.ip_offset: record
        for record in db.scalars(select(IPAddress).where(IPAddress.subnet_id == subnet.id)).all()
    }
    for offset, (status, ip_address) in records.items():
        record = existing.get(offset)
        if record:
            record.status = status
            record.ip_address = ip_address
            record.is_deleted = False
            record.is_primary = False
        else:
            db.add(
                IPAddress(
                    subnet_id=subnet.id,
                    ip_address=ip_address,
                    ip_offset=offset,
                    status=status,
                    is_primary=False,
                    source="system",
                )
            )
    db.flush()


def get_subnet_or_404(db, subnet_id: int) -> Subnet:
    subnet = db.scalar(select(Subnet).options(selectinload(Subnet.vlan)).where(Subnet.id == subnet_id))
    if not subnet or subnet.is_deleted:
        raise HTTPException(status_code=404, detail="Subnet not found")
    return subnet


def get_ip_record_for_offset(db, subnet: Subnet, offset: int) -> IPAddress | None:
    network = get_subnet_network(subnet)
    if offset < 0 or offset >= network.num_addresses:
        raise HTTPException(status_code=400, detail="IP offset is outside subnet range")
    return db.scalar(
        select(IPAddress)
        .options(selectinload(IPAddress.equipment_interface), selectinload(IPAddress.subnet))
        .where(IPAddress.subnet_id == subnet.id, IPAddress.ip_offset == offset)
    )


def address_record_to_out(
    subnet: Subnet,
    record: IPAddress | None,
    offset: int,
    interface_name: str | None = None,
) -> IPAddressDetailsOut:
    network = get_subnet_network(subnet)
    ip_address = str(network.network_address + offset)
    status = record.status if record else "free"
    return IPAddressDetailsOut(
        id=record.id if record else None,
        subnet_id=subnet.id,
        ip_address=record.ip_address if record else ip_address,
        ip_offset=offset,
        status=status,
        hostname=record.hostname if record else None,
        dns_name=record.dns_name if record else None,
        mac_address=record.mac_address if record else None,
        comment=record.comment if record else None,
        equipment_source=record.equipment_item_source if record else None,
        equipment_item_id=record.equipment_item_id if record else None,
        equipment_instance_id=record.equipment_instance_id if record else None,
        equipment_interface_id=record.equipment_interface_id if record else None,
        equipment_interface_name=interface_name,
        is_primary=record.is_primary if record else True,
        source=record.source if record else None,
        last_seen_at=record.last_seen_at if record else None,
        is_service=status in SERVICE_STATUSES,
        is_editable=status not in SERVICE_STATUSES,
        created_at=record.created_at if record else datetime.utcnow(),
        updated_at=record.updated_at if record else datetime.utcnow(),
        is_deleted=record.is_deleted if record else False,
        deleted_at=record.deleted_at if record else None,
    )


def get_summary_counts(db, subnet: Subnet) -> AddressSummaryOut:
    network = get_subnet_network(subnet)
    counts = Counter(
        db.scalars(select(IPAddress.status).where(IPAddress.subnet_id == subnet.id, IPAddress.is_deleted == False)).all()
    )
    non_free = sum(counts.values())
    return AddressSummaryOut(
        total=network.num_addresses,
        free=max(network.num_addresses - non_free, 0),
        used=counts.get("used", 0),
        reserved=counts.get("reserved", 0),
        service=counts.get("service", 0),
        gateway=counts.get("gateway", 0),
        broadcast=counts.get("broadcast", 0),
        network=counts.get("network", 0),
    )


def build_address_grid_response(
    db,
    subnet: Subnet,
    q: str | None = None,
    status: str | None = None,
    mode: str = "grid",
    include_service: bool = True,
    page: int = 1,
    page_size: int = 100,
    sort: str | None = None,
) -> AddressGridResponse:
    ensure_service_address_records(db, subnet)
    network = get_subnet_network(subnet)
    summary = get_summary_counts(db, subnet)
    query = (
        select(IPAddress)
        .options(selectinload(IPAddress.equipment_interface), selectinload(IPAddress.subnet))
        .where(IPAddress.subnet_id == subnet.id, IPAddress.is_deleted == False)
    )
    if q:
        query = query.where(or_(IPAddress.ip_address.ilike(f"%{q}%"), IPAddress.hostname.ilike(f"%{q}%")))
    elif status:
        query = query.where(IPAddress.status == status)
    if not include_service:
        query = query.where(IPAddress.status.not_in(tuple(SERVICE_STATUSES)))
    query = query.order_by(IPAddress.ip_offset.desc() if sort == "-ip_address" else IPAddress.ip_offset.asc())
    records = db.scalars(query).all()
    interface_map = {record.id: (record.equipment_interface.interface_name if record.equipment_interface else None) for record in records}
    if mode == "heatmap" and subnet.prefix == 16:
        records_by_offset = {record.ip_offset: record for record in records}
        aggregates: list[HeatmapAggregateOut] = []
        for block_start in range(0, network.num_addresses, 256):
            block_end = min(block_start + 255, network.num_addresses - 1)
            counter = Counter()
            for offset in range(block_start, block_end + 1):
                record = records_by_offset.get(offset)
                counter[record.status if record else "free"] += 1
            block_network = ipaddress.ip_network(f"{network.network_address + block_start}/24", strict=False)
            aggregates.append(
                HeatmapAggregateOut(
                    block_cidr=str(block_network),
                    offset_start=block_start,
                    offset_end=block_end,
                    free=counter.get("free", 0),
                    used=counter.get("used", 0),
                    reserved=counter.get("reserved", 0),
                    service=counter.get("service", 0),
                    gateway=counter.get("gateway", 0),
                    broadcast=counter.get("broadcast", 0),
                    network=counter.get("network", 0),
                )
            )
        return AddressGridResponse(subnet=subnet_to_out(subnet), summary=summary, mode=mode, aggregates=aggregates)
    if mode == "list":
        total = len(records)
        start = max((page - 1) * page_size, 0)
        items = [
            address_record_to_out(subnet, record, record.ip_offset, interface_map.get(record.id))
            for record in records[start : start + page_size]
        ]
        return AddressGridResponse(
            subnet=subnet_to_out(subnet),
            summary=summary,
            mode=mode,
            items=items,
            pagination=Pagination(items=[], page=page, page_size=page_size, total=total),
        )
    items: list[IPAddressDetailsOut] = []
    if q:
        items = [address_record_to_out(subnet, record, record.ip_offset, interface_map.get(record.id)) for record in records]
    else:
        records_by_offset = {record.ip_offset: record for record in records}
        max_offsets = 256 if subnet.prefix == 24 else 4096 if subnet.prefix == 20 else network.num_addresses
        for offset in range(max_offsets):
            record = records_by_offset.get(offset)
            inferred_status = record.status if record else "free"
            if status and inferred_status != status:
                continue
            if not include_service and inferred_status in SERVICE_STATUSES:
                continue
            items.append(address_record_to_out(subnet, record, offset, interface_map.get(record.id) if record else None))
    return AddressGridResponse(subnet=subnet_to_out(subnet), summary=summary, mode=mode, items=items)


def validate_interface_belongs(
    db,
    equipment_source: str,
    equipment_item_id: int,
    equipment_interface_id: int,
) -> EquipmentNetworkInterface:
    interface = db.scalar(select(EquipmentNetworkInterface).where(EquipmentNetworkInterface.id == equipment_interface_id))
    if not interface or interface.is_deleted:
        raise HTTPException(status_code=404, detail="Equipment interface not found")
    if (
        interface.equipment_item_source != equipment_source
        or interface.equipment_item_id != equipment_item_id
    ):
        raise HTTPException(status_code=400, detail="Interface does not belong to equipment instance")
    return interface


def audit_ip_address_change(
    db,
    *,
    actor_user_id: int | None,
    action: str,
    subnet_id: int,
    ip_address: str,
    ip_address_id: int | None,
    before: dict | None,
    after: IPAddress,
    payload_json: dict | None = None,
) -> None:
    db.add(
        IPAddressAuditLog(
            ip_address_id=ip_address_id,
            subnet_id=subnet_id,
            ip_address=ip_address,
            action=action,
            old_status=before.get("status") if before else None,
            new_status=after.status,
            old_hostname=before.get("hostname") if before else None,
            new_hostname=after.hostname,
            old_equipment_instance_id=before.get("equipment_instance_id") if before else None,
            new_equipment_instance_id=after.equipment_instance_id,
            old_equipment_item_source=before.get("equipment_item_source") if before else None,
            new_equipment_item_source=after.equipment_item_source,
            old_equipment_item_id=before.get("equipment_item_id") if before else None,
            new_equipment_item_id=after.equipment_item_id,
            actor_user_id=actor_user_id,
            payload_json=payload_json or {},
        )
    )


def get_or_create_ip_record(db, subnet: Subnet, offset: int, status: str) -> IPAddress:
    record = get_ip_record_for_offset(db, subnet, offset)
    if record:
        return record
    network = get_subnet_network(subnet)
    record = IPAddress(
        subnet_id=subnet.id,
        ip_address=str(network.network_address + offset),
        ip_offset=offset,
        status=status,
        source=DEFAULT_SOURCE,
    )
    db.add(record)
    db.flush()
    return record


def apply_assignment_to_record(
    db,
    subnet: Subnet,
    offset: int,
    *,
    actor_user_id: int | None,
    status: str,
    hostname: str | None = None,
    dns_name: str | None = None,
    comment: str | None = None,
    equipment_source: str | None = None,
    equipment_item_id: int | None = None,
    equipment_instance_id: int | None = None,
    equipment_interface_id: int | None = None,
    is_primary: bool | None = None,
    mac_address: str | None = None,
    action: str,
) -> IPAddress:
    record = get_ip_record_for_offset(db, subnet, offset)
    if record and record.status in SERVICE_STATUSES:
        raise HTTPException(status_code=400, detail="Service addresses cannot be edited")
    before = None
    if record:
        before = {
            "status": record.status,
            "hostname": record.hostname,
            "equipment_instance_id": record.equipment_instance_id,
            "equipment_item_source": record.equipment_item_source,
            "equipment_item_id": record.equipment_item_id,
        }
    if status == "used":
        source, item_id = normalize_equipment_target(equipment_source, equipment_item_id, equipment_instance_id)
        if not equipment_interface_id:
            raise HTTPException(status_code=400, detail="Equipment instance and interface are required for used IP")
        equipment_item = ensure_eligible_equipment_item(db, source, item_id)
        sync_equipment_network_interfaces(db, equipment_item, source)
        validate_interface_belongs(db, source, item_id, equipment_interface_id)
        record = record or get_or_create_ip_record(db, subnet, offset, "used")
        record.equipment_instance_id = item_id if source == "cabinet" else None
        record.equipment_item_source = source
        record.equipment_item_id = item_id
        record.equipment_interface_id = equipment_interface_id
    else:
        record = record or get_or_create_ip_record(db, subnet, offset, status)
        record.equipment_instance_id = None
        record.equipment_item_source = None
        record.equipment_item_id = None
        record.equipment_interface_id = None
    record.status = status
    record.hostname = hostname
    record.dns_name = dns_name
    record.comment = comment
    record.mac_address = mac_address
    if is_primary is not None:
        record.is_primary = is_primary
    if status == "free":
        record.hostname = None
        record.dns_name = None
        record.comment = None
        record.mac_address = None
        record.is_primary = True
    elif status in {"reserved", "service"}:
        record.equipment_instance_id = None
        record.equipment_item_source = None
        record.equipment_item_id = None
        record.equipment_interface_id = None
    if not record.source:
        record.source = DEFAULT_SOURCE
    db.flush()
    audit_ip_address_change(
        db,
        actor_user_id=actor_user_id,
        action=action,
        subnet_id=subnet.id,
        ip_address=record.ip_address,
        ip_address_id=record.id,
        before=before,
        after=record,
        payload_json={"equipment_interface_id": record.equipment_interface_id, "status": status},
    )
    return record


def release_ip_record(db, subnet: Subnet, offset: int, actor_user_id: int | None) -> IPAddress:
    return apply_assignment_to_record(db, subnet, offset, actor_user_id=actor_user_id, status="free", action="release")


def list_eligible_equipment(
    db,
    *,
    q: str | None = None,
    cabinet_id: int | None = None,
    manufacturer_id: int | None = None,
    equipment_type_id: int | None = None,
    location_id: int | None = None,
    has_network_interfaces: bool = True,
    installed_only: bool = True,
) -> list[dict]:
    cabinet_query: Select = (
        select(CabinetItem)
        .join(Cabinet, CabinetItem.cabinet_id == Cabinet.id)
        .join(EquipmentType, CabinetItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .options(
            selectinload(CabinetItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(CabinetItem.cabinet),
        )
        .where(CabinetItem.is_deleted == False, EquipmentType.is_deleted == False)
    )
    if installed_only:
        cabinet_query = cabinet_query.where(CabinetItem.cabinet_id.is_not(None))
    if cabinet_id:
        cabinet_query = cabinet_query.where(CabinetItem.cabinet_id == cabinet_id)
    if manufacturer_id:
        cabinet_query = cabinet_query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if equipment_type_id:
        cabinet_query = cabinet_query.where(CabinetItem.equipment_type_id == equipment_type_id)
    if location_id:
        cabinet_query = cabinet_query.where(CabinetItem.cabinet.has(location_id=location_id))
    if q:
        cabinet_query = cabinet_query.where(
            or_(
                EquipmentType.name.ilike(f"%{q}%"),
                Manufacturer.name.ilike(f"%{q}%"),
                Cabinet.name.ilike(f"%{q}%"),
            )
        )
    assembly_query: Select = (
        select(AssemblyItem)
        .join(Assembly, AssemblyItem.assembly_id == Assembly.id)
        .join(EquipmentType, AssemblyItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .options(
            selectinload(AssemblyItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(AssemblyItem.assembly),
        )
        .where(AssemblyItem.is_deleted == False, EquipmentType.is_deleted == False)
    )
    if installed_only:
        assembly_query = assembly_query.where(AssemblyItem.assembly_id.is_not(None))
    if manufacturer_id:
        assembly_query = assembly_query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if equipment_type_id:
        assembly_query = assembly_query.where(AssemblyItem.equipment_type_id == equipment_type_id)
    if location_id:
        assembly_query = assembly_query.where(AssemblyItem.assembly.has(location_id=location_id))
    if q:
        assembly_query = assembly_query.where(
            or_(
                EquipmentType.name.ilike(f"%{q}%"),
                Manufacturer.name.ilike(f"%{q}%"),
                Assembly.name.ilike(f"%{q}%"),
            )
        )
    cabinet_items = db.scalars(cabinet_query.order_by(CabinetItem.id.desc())).all()
    assembly_items = db.scalars(assembly_query.order_by(AssemblyItem.id.desc())).all()
    locations = db.scalars(select(Location)).all()
    locations_map = {loc.id: loc for loc in locations}
    result: list[dict] = []
    for item in cabinet_items:
        if has_network_interfaces and not equipment_has_network_interfaces(item.equipment_type):
            continue
        if not item.cabinet:
            continue
        interfaces = sync_equipment_network_interfaces(db, item, "cabinet")
        if has_network_interfaces and not interfaces:
            continue
        current_ip_links_count = db.scalar(
            select(func.count(IPAddress.id)).where(
                IPAddress.equipment_item_source == "cabinet",
                IPAddress.equipment_item_id == item.id,
                IPAddress.is_deleted == False,
                IPAddress.status == "used",
            )
        ) or 0
        result.append(
            {
                "equipment_source": "cabinet",
                "equipment_item_id": item.id,
                "equipment_instance_id": item.id,
                "display_name": f"{item.equipment_type_name or item.equipment_type.name} / {item.cabinet.name}",
                "source": "cabinet",
                "cabinet_id": item.cabinet_id,
                "cabinet_name": item.cabinet.name,
                "assembly_id": None,
                "assembly_name": None,
                "location": build_location_full_path(item.cabinet.location_id, locations_map),
                "manufacturer_id": item.equipment_type.manufacturer_id if item.equipment_type else None,
                "manufacturer_name": item.manufacturer_name,
                "equipment_type_id": item.equipment_type_id,
                "equipment_type_name": item.equipment_type_name or item.equipment_type.name,
                "inventory_number": item.equipment_type.nomenclature_number if item.equipment_type else None,
                "serial": item.cabinet.factory_number if item.cabinet else None,
                "tag": item.cabinet.nomenclature_number if item.cabinet else None,
                "has_network_interfaces": True,
                "current_ip_links_count": current_ip_links_count,
                "network_interfaces": [interface_to_out(interface) for interface in interfaces if interface.is_active],
            }
        )
    for item in assembly_items:
        if has_network_interfaces and not equipment_has_network_interfaces(item.equipment_type):
            continue
        if not item.assembly:
            continue
        interfaces = sync_equipment_network_interfaces(db, item, "assembly")
        if has_network_interfaces and not interfaces:
            continue
        current_ip_links_count = db.scalar(
            select(func.count(IPAddress.id)).where(
                IPAddress.equipment_item_source == "assembly",
                IPAddress.equipment_item_id == item.id,
                IPAddress.is_deleted == False,
                IPAddress.status == "used",
            )
        ) or 0
        result.append(
            {
                "equipment_source": "assembly",
                "equipment_item_id": item.id,
                "equipment_instance_id": None,
                "display_name": f"{item.equipment_type_name or item.equipment_type.name} / {item.assembly.name}",
                "source": "assembly",
                "cabinet_id": None,
                "cabinet_name": None,
                "assembly_id": item.assembly_id,
                "assembly_name": item.assembly.name,
                "location": build_location_full_path(item.assembly.location_id, locations_map),
                "manufacturer_id": item.equipment_type.manufacturer_id if item.equipment_type else None,
                "manufacturer_name": item.manufacturer_name,
                "equipment_type_id": item.equipment_type_id,
                "equipment_type_name": item.equipment_type_name or item.equipment_type.name,
                "inventory_number": item.equipment_type.nomenclature_number if item.equipment_type else None,
                "serial": item.assembly.factory_number if item.assembly else None,
                "tag": item.assembly.nomenclature_number if item.assembly else None,
                "has_network_interfaces": True,
                "current_ip_links_count": current_ip_links_count,
                "network_interfaces": [interface_to_out(interface) for interface in interfaces if interface.is_active],
            }
        )
    return result


def build_host_equipment_tree(db, q: str | None = None) -> list[HostEquipmentTreeNode]:
    locations = db.scalars(select(Location)).all()
    locations_map = {loc.id: loc for loc in locations}
    children_by_parent: dict[int | None, list[Location]] = {}
    for location in locations:
        children_by_parent.setdefault(location.parent_id, []).append(location)

    eligible_items = list_eligible_equipment(db, q=q, has_network_interfaces=True, installed_only=True)
    normalized_query = (q or "").strip().lower()
    equipment_by_location: dict[int, list[HostEquipmentTreeLeaf]] = {}
    for item in eligible_items:
        source = item["equipment_source"]
        item_id = item["equipment_item_id"]
        value = f"{source}:{item_id}"
        container_name = item.get("cabinet_name") or item.get("assembly_name")
        leaf = HostEquipmentTreeLeaf(
            value=value,
            label=item["display_name"],
            equipment_source=source,
            equipment_item_id=item_id,
            equipment_instance_id=item.get("equipment_instance_id"),
            location_full_path=item.get("location"),
            container_name=container_name,
            manufacturer_name=item.get("manufacturer_name"),
            equipment_type_name=item["equipment_type_name"],
            network_interfaces=item["network_interfaces"],
        )
        location_path = item.get("location")
        location_id = None
        if location_path:
            for loc in locations:
                if build_location_full_path(loc.id, locations_map) == location_path:
                    location_id = loc.id
                    break
        if location_id is None:
            continue
        equipment_by_location.setdefault(location_id, []).append(leaf)

    def build_node(location: Location) -> HostEquipmentTreeNode | None:
        child_nodes = [
            node
            for child in sorted(children_by_parent.get(location.id, []), key=lambda item: item.name.lower())
            if (node := build_node(child)) is not None
        ]
        equipment = sorted(
            equipment_by_location.get(location.id, []),
            key=lambda item: item.label.lower(),
        )
        if normalized_query:
            location_match = normalized_query in (build_location_full_path(location.id, locations_map) or location.name).lower()
            if not location_match and not child_nodes and not equipment:
                return None
        elif not child_nodes and not equipment:
            return None
        return HostEquipmentTreeNode(
            value=f"location:{location.id}",
            label=location.name,
            children=child_nodes,
            equipment=equipment,
        )

    return [
        node
        for location in sorted(children_by_parent.get(None, []), key=lambda item: item.name.lower())
        if (node := build_node(location)) is not None
    ]


def create_subnet_from_calculator_payload(db, payload: SubnetCalculatorCreate) -> tuple[ipaddress.IPv4Network, int, dict]:
    network = ipaddress.ip_network(f"{payload.network_address_input}/{payload.cidr}", strict=False)
    gateway_ip = payload.gateway_ip or str(network.network_address + 1)
    validate_ip_in_subnet(gateway_ip, network)
    return network, network.prefixlen, {
        "vlan_id": payload.vlan_id,
        "cidr": str(network),
        "gateway_ip": gateway_ip,
        "name": payload.name,
        "description": payload.description,
        "location_id": payload.location_id,
        "vrf": payload.vrf,
        "is_active": payload.is_active,
    }


def build_cabinet_item_ipam_summary(db, item_id: int) -> CabinetItemIPAMSummaryOut:
    item = get_cabinet_item_or_404(db, item_id)
    eligible = False
    network_interfaces_count = 0
    try:
        ensure_eligible_equipment_item(db, "cabinet", item_id)
        eligible = True
        network_interfaces_count = len(sync_equipment_network_interfaces(db, item, "cabinet"))
    except HTTPException:
        eligible = False
    linked_records = db.scalars(
        select(IPAddress)
        .options(selectinload(IPAddress.subnet))
        .where(
            IPAddress.equipment_item_source == "cabinet",
            IPAddress.equipment_item_id == item_id,
            IPAddress.is_deleted == False,
            IPAddress.status == "used",
        )
        .order_by(IPAddress.ip_address)
    ).all()
    return CabinetItemIPAMSummaryOut(
        eligible_for_ipam=eligible,
        network_interfaces_count=network_interfaces_count,
        linked_ip_addresses=[record.ip_address for record in linked_records],
        linked_subnets=sorted({record.subnet.cidr for record in linked_records if record.subnet}),
        current_ip_links_count=len(linked_records),
    )


def export_subnet_csv(db, subnet: Subnet) -> StringIO:
    ensure_service_address_records(db, subnet)
    records = db.scalars(
        select(IPAddress)
        .options(selectinload(IPAddress.equipment_interface))
        .where(IPAddress.subnet_id == subnet.id, IPAddress.is_deleted == False)
        .order_by(IPAddress.ip_offset)
    ).all()
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["ip_address", "status", "hostname", "vlan", "cidr", "equipment_instance_id", "equipment_interface", "comment"]
    )
    vlan_label = subnet.vlan.vlan_number if subnet.vlan else ""
    for record in records:
        writer.writerow(
            [
                record.ip_address,
                record.status,
                record.hostname or "",
                vlan_label,
                subnet.cidr,
                f"{record.equipment_item_source}:{record.equipment_item_id}" if record.equipment_item_source and record.equipment_item_id else "",
                record.equipment_interface.interface_name if record.equipment_interface else "",
                record.comment or "",
            ]
        )
    buffer.seek(0)
    return buffer
