from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.models.ipam import IPAddress
from app.models.network_topology import NetworkTopologyDocument
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.network_topology import (
    NetworkTopologyDocumentCreate,
    NetworkTopologyDocumentOut,
    NetworkTopologyDocumentUpdate,
    NetworkTopologyDuplicatePayload,
    NetworkTopologyEligibleEquipmentOut,
    TopologyDocument,
)
from app.services.ipam import list_eligible_equipment

router = APIRouter()


def _to_out(item: NetworkTopologyDocument) -> NetworkTopologyDocumentOut:
    return NetworkTopologyDocumentOut(
        id=item.id,
        name=item.name,
        description=item.description,
        scope=item.scope,
        location_id=item.location_id,
        source_context=item.source_context,
        document=TopologyDocument.model_validate(item.document_json or {}),
        created_by_id=item.created_by_id,
        updated_by_id=item.updated_by_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
        is_deleted=item.is_deleted,
        deleted_at=item.deleted_at,
    )


def _get_or_404(db, topology_id: int) -> NetworkTopologyDocument:
    item = db.scalar(select(NetworkTopologyDocument).where(NetworkTopologyDocument.id == topology_id))
    if not item or item.is_deleted:
        raise HTTPException(status_code=404, detail="Network topology not found")
    return item


@router.get("", response_model=Pagination[NetworkTopologyDocumentOut])
def list_network_topologies(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    scope: str | None = None,
    location_id: int | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(NetworkTopologyDocument).where(NetworkTopologyDocument.is_deleted == False)
    if q:
        query = query.where(
            or_(
                NetworkTopologyDocument.name.ilike(f"%{q}%"),
                NetworkTopologyDocument.description.ilike(f"%{q}%"),
            )
        )
    if scope:
        query = query.where(NetworkTopologyDocument.scope == scope)
    if location_id is not None:
        query = query.where(NetworkTopologyDocument.location_id == location_id)
    if sort:
        field = sort.lstrip("-")
        column = getattr(NetworkTopologyDocument, field, None)
        if column is None:
            raise HTTPException(status_code=400, detail=f"Invalid sort field: {field}")
        query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
    else:
        query = query.order_by(NetworkTopologyDocument.updated_at.desc())
    total, items = paginate(query, db, page, page_size)
    return Pagination(items=[_to_out(item) for item in items], page=page, page_size=page_size, total=total)


@router.post("", response_model=NetworkTopologyDocumentOut)
def create_network_topology(
    payload: NetworkTopologyDocumentCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = NetworkTopologyDocument(
        name=payload.name,
        description=payload.description,
        scope=payload.scope,
        location_id=payload.location_id,
        source_context=payload.source_context,
        document_json=payload.document.model_dump(by_alias=True),
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(item)
    db.flush()
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="network_topologies",
        entity_id=item.id,
        after=model_to_dict(item),
    )
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.get("/{topology_id}", response_model=NetworkTopologyDocumentOut)
def get_network_topology(topology_id: int, db=Depends(get_db), user: User = Depends(require_read_access())):
    return _to_out(_get_or_404(db, topology_id))


@router.patch("/{topology_id}", response_model=NetworkTopologyDocumentOut)
def update_network_topology(
    topology_id: int,
    payload: NetworkTopologyDocumentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = _get_or_404(db, topology_id)
    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)
    if "document" in data:
        item.document_json = payload.document.model_dump(by_alias=True) if payload.document else item.document_json
        data.pop("document", None)
    for field, value in data.items():
        setattr(item, field, value)
    item.updated_by_id = current_user.id
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="network_topologies",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.delete("/{topology_id}")
def delete_network_topology(
    topology_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = _get_or_404(db, topology_id)
    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id
    item.updated_by_id = current_user.id
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="network_topologies",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )
    db.commit()
    return {"status": "ok"}


@router.post("/{topology_id}/duplicate", response_model=NetworkTopologyDocumentOut)
def duplicate_network_topology(
    topology_id: int,
    payload: NetworkTopologyDuplicatePayload,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    source = _get_or_404(db, topology_id)
    clone = NetworkTopologyDocument(
        name=payload.name or f"{source.name} Copy",
        description=source.description,
        scope=source.scope,
        location_id=source.location_id,
        source_context=source.source_context,
        document_json=source.document_json,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(clone)
    db.flush()
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="network_topologies",
        entity_id=clone.id,
        meta={"duplicated_from_id": source.id},
        after=model_to_dict(clone),
    )
    db.commit()
    db.refresh(clone)
    return _to_out(clone)


@router.get("/eligible-equipment/list", response_model=list[NetworkTopologyEligibleEquipmentOut])
def list_network_topology_eligible_equipment(
    q: str | None = None,
    location_id: int | None = None,
    manufacturer_id: int | None = None,
    equipment_type_id: int | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    items = list_eligible_equipment(
        db,
        q=q,
        location_id=location_id,
        manufacturer_id=manufacturer_id,
        equipment_type_id=equipment_type_id,
        has_network_interfaces=True,
        installed_only=True,
    )
    result: list[NetworkTopologyEligibleEquipmentOut] = []
    for item in items:
        ip_rows = db.scalars(
            select(IPAddress.ip_address)
            .where(
                IPAddress.equipment_item_source == item["equipment_source"],
                IPAddress.equipment_item_id == item["equipment_item_id"],
                IPAddress.is_deleted == False,
                IPAddress.status == "used",
            )
            .order_by(IPAddress.is_primary.desc(), IPAddress.created_at.asc())
        ).all()
        linked_ip_addresses = [ip for ip in ip_rows if ip]
        result.append(
            NetworkTopologyEligibleEquipmentOut(
                **item,
                linked_ip_addresses=linked_ip_addresses,
                primary_ip=linked_ip_addresses[0] if linked_ip_addresses else None,
            )
        )
    return result
