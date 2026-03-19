from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_admin, require_read_access, require_write_access
from app.core.pagination import paginate
from app.models.ipam import IPAddressAuditLog, Subnet, Vlan
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.ipam import (
    AddressGridResponse,
    EligibleEquipmentOut,
    HostEquipmentTreeNode,
    IPAddressAuditLogOut,
    IPAddressDetailsOut,
    IPAddressUpdate,
    IPAssignPayload,
    IPReservePayload,
    SubnetCalculatorCreate,
    SubnetCreate,
    SubnetOut,
    SubnetUpdate,
    VlanCreate,
    VlanOut,
    VlanUpdate,
)
from app.services.ipam import (
    apply_assignment_to_record,
    build_host_equipment_tree,
    build_address_grid_response,
    create_subnet_from_calculator_payload,
    ensure_service_address_records,
    export_subnet_csv,
    get_ip_record_for_offset,
    get_subnet_or_404,
    list_eligible_equipment,
    release_ip_record,
    subnet_to_out,
    validate_ip_in_subnet,
    validate_subnet_cidr,
)

router = APIRouter()


@router.get("/vlans", response_model=Pagination[VlanOut])
def list_vlans(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_active: bool | None = None,
    location_id: int | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Vlan).where(Vlan.is_deleted == False)
    if q:
        query = query.where(or_(Vlan.name.ilike(f"%{q}%"), Vlan.purpose.ilike(f"%{q}%")))
    if is_active is not None:
        query = query.where(Vlan.is_active == is_active)
    if location_id is not None:
        query = query.where(Vlan.location_id == location_id)
    if sort:
        field = sort.lstrip("-")
        column = getattr(Vlan, field, None)
        if column is None:
            raise HTTPException(status_code=400, detail=f"Invalid sort field: {field}")
        query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
    else:
        query = query.order_by(Vlan.vlan_number.asc())
    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/vlans", response_model=VlanOut)
def create_vlan(
    payload: VlanCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    existing = db.scalar(select(Vlan).where(Vlan.vlan_number == payload.vlan_number, Vlan.is_deleted == False))
    if existing:
        raise HTTPException(status_code=400, detail="VLAN already exists")
    vlan = Vlan(**payload.model_dump())
    db.add(vlan)
    db.flush()
    add_audit_log(db, actor_id=current_user.id, action="CREATE", entity="ipam_vlans", entity_id=vlan.id, after=model_to_dict(vlan))
    db.commit()
    db.refresh(vlan)
    return vlan


@router.get("/vlans/{vlan_id}", response_model=VlanOut)
def get_vlan(vlan_id: int, db=Depends(get_db), user: User = Depends(require_read_access())):
    vlan = db.scalar(select(Vlan).where(Vlan.id == vlan_id, Vlan.is_deleted == False))
    if not vlan:
        raise HTTPException(status_code=404, detail="VLAN not found")
    return vlan


@router.patch("/vlans/{vlan_id}", response_model=VlanOut)
def update_vlan(
    vlan_id: int,
    payload: VlanUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    vlan = db.scalar(select(Vlan).where(Vlan.id == vlan_id))
    if not vlan or vlan.is_deleted:
        raise HTTPException(status_code=404, detail="VLAN not found")
    before = model_to_dict(vlan)
    data = payload.model_dump(exclude_unset=True)
    if "vlan_number" in data and data["vlan_number"] != vlan.vlan_number:
        existing = db.scalar(
            select(Vlan).where(Vlan.vlan_number == data["vlan_number"], Vlan.is_deleted == False, Vlan.id != vlan_id)
        )
        if existing:
            raise HTTPException(status_code=400, detail="VLAN already exists")
    for field, value in data.items():
        setattr(vlan, field, value)
    add_audit_log(db, actor_id=current_user.id, action="UPDATE", entity="ipam_vlans", entity_id=vlan.id, before=before, after=model_to_dict(vlan))
    db.commit()
    db.refresh(vlan)
    return vlan


@router.delete("/vlans/{vlan_id}")
def delete_vlan(vlan_id: int, db=Depends(get_db), current_user: User = Depends(require_admin())):
    vlan = db.scalar(select(Vlan).where(Vlan.id == vlan_id))
    if not vlan or vlan.is_deleted:
        raise HTTPException(status_code=404, detail="VLAN not found")
    before = model_to_dict(vlan)
    vlan.is_deleted = True
    vlan.deleted_at = datetime.utcnow()
    vlan.deleted_by_id = current_user.id
    add_audit_log(db, actor_id=current_user.id, action="DELETE", entity="ipam_vlans", entity_id=vlan.id, before=before, after=model_to_dict(vlan))
    db.commit()
    return {"status": "ok"}


@router.get("/subnets", response_model=Pagination[SubnetOut])
def list_subnets(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    vlan_id: int | None = None,
    vlan_number: int | None = None,
    prefix: int | None = None,
    location_id: int | None = None,
    is_active: bool | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Subnet).options(selectinload(Subnet.vlan)).where(Subnet.is_deleted == False)
    if q:
        query = query.where(or_(Subnet.cidr.ilike(f"%{q}%"), Subnet.name.ilike(f"%{q}%")))
    if vlan_id is not None:
        query = query.where(Subnet.vlan_id == vlan_id)
    if vlan_number is not None:
        query = query.join(Vlan, Subnet.vlan_id == Vlan.id).where(Vlan.vlan_number == vlan_number)
    if prefix is not None:
        query = query.where(Subnet.prefix == prefix)
    if location_id is not None:
        query = query.where(Subnet.location_id == location_id)
    if is_active is not None:
        query = query.where(Subnet.is_active == is_active)
    if sort:
        field = sort.lstrip("-")
        column = getattr(Subnet, field, None)
        if column is None:
            raise HTTPException(status_code=400, detail=f"Invalid sort field: {field}")
        query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
    else:
        query = query.order_by(Subnet.network_address.asc())
    total, items = paginate(query, db, page, page_size)
    return Pagination(items=[subnet_to_out(item) for item in items], page=page, page_size=page_size, total=total)


@router.post("/subnets", response_model=SubnetOut)
def create_subnet(payload: SubnetCreate, db=Depends(get_db), current_user: User = Depends(require_admin())):
    network, prefix = validate_subnet_cidr(payload.cidr)
    if payload.gateway_ip:
        validate_ip_in_subnet(payload.gateway_ip, network)
    existing = db.scalar(select(Subnet).where(Subnet.cidr == str(network), Subnet.is_deleted == False))
    if existing:
        raise HTTPException(status_code=400, detail="Subnet already exists")
    if payload.vlan_id is not None:
        vlan = db.scalar(select(Vlan).where(Vlan.id == payload.vlan_id, Vlan.is_deleted == False))
        if not vlan:
            raise HTTPException(status_code=404, detail="VLAN not found")
    subnet = Subnet(
        vlan_id=payload.vlan_id,
        cidr=str(network),
        prefix=prefix,
        network_address=str(network.network_address),
        gateway_ip=payload.gateway_ip,
        name=payload.name,
        description=payload.description,
        location_id=payload.location_id,
        vrf=payload.vrf,
        is_active=payload.is_active,
    )
    db.add(subnet)
    db.flush()
    ensure_service_address_records(db, subnet)
    add_audit_log(db, actor_id=current_user.id, action="CREATE", entity="ipam_subnets", entity_id=subnet.id, after=model_to_dict(subnet))
    db.commit()
    db.refresh(subnet)
    return subnet_to_out(subnet)


@router.post("/subnets/create-from-calculator", response_model=SubnetOut)
def create_subnet_from_calculator(
    payload: SubnetCalculatorCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    network, prefix, data = create_subnet_from_calculator_payload(db, payload)
    existing = db.scalar(select(Subnet).where(Subnet.cidr == str(network), Subnet.is_deleted == False))
    if existing:
        raise HTTPException(status_code=400, detail="Subnet already exists")
    if data["vlan_id"] is not None:
        vlan = db.scalar(select(Vlan).where(Vlan.id == data["vlan_id"], Vlan.is_deleted == False))
        if not vlan:
            raise HTTPException(status_code=404, detail="VLAN not found")
    subnet = Subnet(prefix=prefix, network_address=str(network.network_address), **data)
    db.add(subnet)
    db.flush()
    ensure_service_address_records(db, subnet)
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="ipam_subnets",
        entity_id=subnet.id,
        after=model_to_dict(subnet),
    )
    db.commit()
    db.refresh(subnet)
    return subnet_to_out(subnet)


@router.get("/subnets/{subnet_id}", response_model=SubnetOut)
def get_subnet(subnet_id: int, db=Depends(get_db), user: User = Depends(require_read_access())):
    return subnet_to_out(get_subnet_or_404(db, subnet_id))


@router.patch("/subnets/{subnet_id}", response_model=SubnetOut)
def update_subnet(
    subnet_id: int,
    payload: SubnetUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    subnet = get_subnet_or_404(db, subnet_id)
    before = model_to_dict(subnet)
    data = payload.model_dump(exclude_unset=True)
    if "vlan_id" in data and data["vlan_id"] is not None:
        vlan = db.scalar(select(Vlan).where(Vlan.id == data["vlan_id"], Vlan.is_deleted == False))
        if not vlan:
            raise HTTPException(status_code=404, detail="VLAN not found")
    if "gateway_ip" in data and data["gateway_ip"]:
        validate_ip_in_subnet(data["gateway_ip"], validate_subnet_cidr(subnet.cidr)[0])
    for field, value in data.items():
        setattr(subnet, field, value)
    ensure_service_address_records(db, subnet)
    add_audit_log(db, actor_id=current_user.id, action="UPDATE", entity="ipam_subnets", entity_id=subnet.id, before=before, after=model_to_dict(subnet))
    db.commit()
    db.refresh(subnet)
    return subnet_to_out(subnet)


@router.delete("/subnets/{subnet_id}")
def delete_subnet(subnet_id: int, db=Depends(get_db), current_user: User = Depends(require_admin())):
    subnet = get_subnet_or_404(db, subnet_id)
    before = model_to_dict(subnet)
    subnet.is_deleted = True
    subnet.deleted_at = datetime.utcnow()
    subnet.deleted_by_id = current_user.id
    add_audit_log(db, actor_id=current_user.id, action="DELETE", entity="ipam_subnets", entity_id=subnet.id, before=before, after=model_to_dict(subnet))
    db.commit()
    return {"status": "ok"}


@router.get("/subnets/{subnet_id}/addresses", response_model=AddressGridResponse)
def get_subnet_addresses(
    subnet_id: int,
    q: str | None = None,
    status: str | None = None,
    mode: str = Query(default="grid", pattern="^(grid|list|heatmap)$"),
    include_service: bool = True,
    page: int = 1,
    page_size: int = 100,
    sort: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    subnet = get_subnet_or_404(db, subnet_id)
    return build_address_grid_response(db, subnet, q=q, status=status, mode=mode, include_service=include_service, page=page, page_size=page_size, sort=sort)


@router.get("/subnets/{subnet_id}/addresses/{offset}", response_model=IPAddressDetailsOut)
def get_address_details(subnet_id: int, offset: int, db=Depends(get_db), user: User = Depends(require_read_access())):
    subnet = get_subnet_or_404(db, subnet_id)
    response = build_address_grid_response(db, subnet, mode="grid", include_service=True)
    for item in response.items:
        if item.ip_offset == offset:
            return item
    raise HTTPException(status_code=404, detail="Address not found")


@router.patch("/subnets/{subnet_id}/addresses/{offset}", response_model=IPAddressDetailsOut)
def patch_address(
    subnet_id: int,
    offset: int,
    payload: IPAddressUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    subnet = get_subnet_or_404(db, subnet_id)
    record = get_ip_record_for_offset(db, subnet, offset)
    data = payload.model_dump(exclude_unset=True)
    updated = apply_assignment_to_record(
        db,
        subnet,
        offset,
        actor_user_id=current_user.id,
        status=data.get("status", record.status if record else "reserved"),
        hostname=data.get("hostname", record.hostname if record else None),
        dns_name=data.get("dns_name", record.dns_name if record else None),
        comment=data.get("comment", record.comment if record else None),
        equipment_source=data.get("equipment_source", record.equipment_item_source if record else None),
        equipment_item_id=data.get("equipment_item_id", record.equipment_item_id if record else None),
        equipment_instance_id=data.get("equipment_instance_id", record.equipment_instance_id if record else None),
        equipment_interface_id=data.get("equipment_interface_id", record.equipment_interface_id if record else None),
        is_primary=data.get("is_primary", record.is_primary if record else None),
        mac_address=data.get("mac_address", record.mac_address if record else None),
        action="update",
    )
    db.commit()
    db.refresh(updated)
    return get_address_details(subnet_id, offset, db, current_user)


@router.post("/subnets/{subnet_id}/addresses/{offset}/assign", response_model=IPAddressDetailsOut)
def assign_address(
    subnet_id: int,
    offset: int,
    payload: IPAssignPayload,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    subnet = get_subnet_or_404(db, subnet_id)
    apply_assignment_to_record(
        db,
        subnet,
        offset,
        actor_user_id=current_user.id,
        status="used",
        hostname=payload.hostname,
        dns_name=payload.dns_name,
        comment=payload.comment,
        equipment_source=payload.equipment_source,
        equipment_item_id=payload.equipment_item_id,
        equipment_instance_id=payload.equipment_instance_id,
        equipment_interface_id=payload.equipment_interface_id,
        is_primary=payload.is_primary,
        mac_address=payload.mac_address,
        action="assign",
    )
    db.commit()
    return get_address_details(subnet_id, offset, db, current_user)


@router.post("/subnets/{subnet_id}/addresses/{offset}/reserve", response_model=IPAddressDetailsOut)
def reserve_address(
    subnet_id: int,
    offset: int,
    payload: IPReservePayload,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    subnet = get_subnet_or_404(db, subnet_id)
    apply_assignment_to_record(db, subnet, offset, actor_user_id=current_user.id, status="reserved", hostname=payload.hostname, comment=payload.comment, action="reserve")
    db.commit()
    return get_address_details(subnet_id, offset, db, current_user)


@router.post("/subnets/{subnet_id}/addresses/{offset}/release", response_model=IPAddressDetailsOut)
def release_address(subnet_id: int, offset: int, db=Depends(get_db), current_user: User = Depends(require_write_access())):
    subnet = get_subnet_or_404(db, subnet_id)
    release_ip_record(db, subnet, offset, current_user.id)
    db.commit()
    return get_address_details(subnet_id, offset, db, current_user)


@router.get("/subnets/{subnet_id}/export.csv")
def export_subnet(subnet_id: int, db=Depends(get_db), user: User = Depends(require_read_access())):
    subnet = get_subnet_or_404(db, subnet_id)
    buffer = export_subnet_csv(db, subnet)
    return StreamingResponse(buffer, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="subnet-{subnet.id}.csv"'})


@router.get("/audit-logs", response_model=Pagination[IPAddressAuditLogOut])
def list_ipam_audit_logs(
    page: int = 1,
    page_size: int = 50,
    subnet_id: int | None = None,
    ip_address: str | None = None,
    action: str | None = None,
    actor_user_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_admin()),
):
    query = select(IPAddressAuditLog)
    if subnet_id is not None:
        query = query.where(IPAddressAuditLog.subnet_id == subnet_id)
    if ip_address:
        query = query.where(IPAddressAuditLog.ip_address.ilike(f"%{ip_address}%"))
    if action:
        query = query.where(IPAddressAuditLog.action == action)
    if actor_user_id is not None:
        query = query.where(IPAddressAuditLog.actor_user_id == actor_user_id)
    if date_from:
        query = query.where(IPAddressAuditLog.created_at >= date_from)
    if date_to:
        query = query.where(IPAddressAuditLog.created_at <= date_to)
    query = query.order_by(IPAddressAuditLog.id.desc())
    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/equipment/eligible", response_model=list[EligibleEquipmentOut])
def get_eligible_equipment(
    q: str | None = None,
    cabinet_id: int | None = None,
    manufacturer_id: int | None = None,
    equipment_type_id: int | None = None,
    location_id: int | None = None,
    has_network_interfaces: bool = True,
    installed_only: bool = True,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    items = list_eligible_equipment(
        db,
        q=q,
        cabinet_id=cabinet_id,
        manufacturer_id=manufacturer_id,
        equipment_type_id=equipment_type_id,
        location_id=location_id,
        has_network_interfaces=has_network_interfaces,
        installed_only=installed_only,
    )
    db.commit()
    return items


@router.get("/equipment/host-tree", response_model=list[HostEquipmentTreeNode])
def get_host_equipment_tree(
    q: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    return build_host_equipment_tree(db, q=q)
