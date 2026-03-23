from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.models.assemblies import Assembly
from app.models.core import EquipmentType, Location, Manufacturer
from app.models.operations import AssemblyItem, CabinetItem
from app.models.security import User
from app.models.serial_map import SerialMapDocument
from app.schemas.common import Pagination
from app.schemas.serial_map import (
    LegacySerialMapProjectDocument,
    SerialMapDocumentCreate,
    SerialMapDocumentData,
    SerialMapDocumentOut,
    SerialMapDocumentUpdate,
    SerialMapDuplicatePayload,
    SerialMapEligibleEquipmentOut,
    SerialPortDescriptor,
)
from app.services.ipam import build_location_full_path

router = APIRouter()


def _empty_document() -> dict:
    return {
        "version": 2,
        "updatedAt": datetime.utcnow().isoformat(),
        "viewport": {"x": 0, "y": 0, "zoom": 1},
        "nodes": [],
        "edges": [],
        "history": {"past": [], "future": []},
    }


def _normalize_legacy_scheme(raw_scheme: dict | None) -> dict:
    if not isinstance(raw_scheme, dict):
        return _empty_document()
    return {
        "version": 2,
        "updatedAt": datetime.utcnow().isoformat(),
        "viewport": raw_scheme.get("viewport") or {"x": 0, "y": 0, "zoom": 1},
        "nodes": raw_scheme.get("nodes") or [],
        "edges": raw_scheme.get("edges") or [],
        "history": raw_scheme.get("history") or {"past": [], "future": []},
    }


def _document_from_json(value: dict | None) -> SerialMapDocumentData:
    raw = value or {}
    if isinstance(raw, dict) and raw.get("version") == 2 and "nodes" in raw and "edges" in raw:
        return SerialMapDocumentData.model_validate(raw)
    legacy = LegacySerialMapProjectDocument.model_validate(raw)
    active_scheme = next((scheme for scheme in legacy.schemes if scheme.id == legacy.activeSchemeId), legacy.schemes[0] if legacy.schemes else None)
    return SerialMapDocumentData.model_validate(_normalize_legacy_scheme(active_scheme.model_dump() if active_scheme else None))


def _parse_serial_ports(value: list[dict] | None) -> list[SerialPortDescriptor]:
    ports: list[SerialPortDescriptor] = []
    if not isinstance(value, list):
        return ports
    for item in value:
        if not isinstance(item, dict):
            continue
        port_type = str(item.get("type") or "").strip()
        count = int(item.get("count") or 0)
        if port_type and count > 0:
            ports.append(SerialPortDescriptor(type=port_type, count=count))
    return ports


def _to_out(item: SerialMapDocument) -> SerialMapDocumentOut:
    return SerialMapDocumentOut(
        id=item.id,
        name=item.name,
        description=item.description,
        scope=item.scope,
        location_id=item.location_id,
        source_context=item.source_context,
        document=_document_from_json(item.document_json or {}),
        created_by_id=item.created_by_id,
        updated_by_id=item.updated_by_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
        is_deleted=item.is_deleted,
        deleted_at=item.deleted_at,
    )


def _migrate_legacy_document(db, item: SerialMapDocument) -> SerialMapDocument:
    raw = item.document_json or {}
    if not isinstance(raw, dict) or "schemes" not in raw:
        return item
    legacy = LegacySerialMapProjectDocument.model_validate(raw)
    schemes = legacy.schemes or []
    if len(schemes) <= 1:
        active_scheme = next((scheme for scheme in schemes if scheme.id == legacy.activeSchemeId), schemes[0] if schemes else None)
        item.document_json = _normalize_legacy_scheme(active_scheme.model_dump() if active_scheme else None)
        item.source_context = {
            **(item.source_context or {}),
            "legacy_project_id": legacy.projectId,
            "migrated_from_multi_scheme": False,
        }
        db.flush()
        return item

    active_scheme = next((scheme for scheme in schemes if scheme.id == legacy.activeSchemeId), schemes[0])
    item.document_json = _normalize_legacy_scheme(active_scheme.model_dump())
    item.source_context = {
        **(item.source_context or {}),
        "legacy_project_id": legacy.projectId,
        "legacy_scheme_id": active_scheme.id,
        "migrated_from_multi_scheme": True,
    }
    for index, scheme in enumerate(schemes):
        if scheme.id == active_scheme.id:
            continue
        clone = SerialMapDocument(
            name=f"{item.name} / {scheme.name or f'Схема {index + 1}'}",
            description=scheme.description or item.description,
            scope=item.scope,
            location_id=item.location_id,
            source_context={
                **(item.source_context or {}),
                "legacy_project_id": legacy.projectId,
                "legacy_scheme_id": scheme.id,
                "migrated_from_document_id": item.id,
            },
            document_json=_normalize_legacy_scheme(scheme.model_dump()),
            created_by_id=item.created_by_id,
            updated_by_id=item.updated_by_id,
        )
        db.add(clone)
    db.flush()
    return item


def _get_or_404(db, document_id: int) -> SerialMapDocument:
    item = db.scalar(select(SerialMapDocument).where(SerialMapDocument.id == document_id))
    if not item or item.is_deleted:
        raise HTTPException(status_code=404, detail="Serial map document not found")
    return item


@router.get("", response_model=Pagination[SerialMapDocumentOut])
def list_serial_map_documents(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    scope: str | None = None,
    location_id: int | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(SerialMapDocument).where(SerialMapDocument.is_deleted == False)
    if q:
        query = query.where(
            or_(
                SerialMapDocument.name.ilike(f"%{q}%"),
                SerialMapDocument.description.ilike(f"%{q}%"),
            )
        )
    if scope:
        query = query.where(SerialMapDocument.scope == scope)
    if location_id is not None:
        query = query.where(SerialMapDocument.location_id == location_id)
    if sort:
        field = sort.lstrip("-")
        column = getattr(SerialMapDocument, field, None)
        if column is None:
            raise HTTPException(status_code=400, detail=f"Invalid sort field: {field}")
        query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
    else:
        query = query.order_by(SerialMapDocument.updated_at.desc())
    total, items = paginate(query, db, page, page_size)
    mutated = False
    for item in items:
        before = item.document_json
        _migrate_legacy_document(db, item)
        if before != item.document_json:
            mutated = True
    if mutated:
        db.commit()
    return Pagination(items=[_to_out(item) for item in items], page=page, page_size=page_size, total=total)


@router.post("", response_model=SerialMapDocumentOut)
def create_serial_map_document(
    payload: SerialMapDocumentCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = SerialMapDocument(
        name=payload.name,
        description=payload.description,
        scope=payload.scope,
        location_id=payload.location_id,
        source_context=payload.source_context,
        document_json=payload.document.model_dump(),
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(item)
    db.flush()
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="serial_map_documents",
        entity_id=item.id,
        after=model_to_dict(item),
    )
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.get("/eligible-equipment/list", response_model=list[SerialMapEligibleEquipmentOut])
def list_serial_map_eligible_equipment(
    q: str | None = None,
    location_id: int | None = None,
    manufacturer_id: int | None = None,
    equipment_type_id: int | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    locations = db.scalars(select(Location)).all()
    locations_map = {loc.id: loc for loc in locations}

    cabinet_query = (
        select(CabinetItem)
        .join(CabinetItem.cabinet)
        .join(CabinetItem.equipment_type)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .options(
            selectinload(CabinetItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(CabinetItem.cabinet),
        )
        .where(CabinetItem.is_deleted == False, EquipmentType.is_deleted == False, CabinetItem.cabinet_id.is_not(None))
    )
    assembly_query = (
        select(AssemblyItem)
        .join(Assembly, AssemblyItem.assembly_id == Assembly.id)
        .join(EquipmentType, AssemblyItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .options(
            selectinload(AssemblyItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(AssemblyItem.assembly),
        )
        .where(AssemblyItem.is_deleted == False, EquipmentType.is_deleted == False, AssemblyItem.assembly_id.is_not(None))
    )

    if manufacturer_id:
        cabinet_query = cabinet_query.where(EquipmentType.manufacturer_id == manufacturer_id)
        assembly_query = assembly_query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if equipment_type_id:
        cabinet_query = cabinet_query.where(CabinetItem.equipment_type_id == equipment_type_id)
        assembly_query = assembly_query.where(AssemblyItem.equipment_type_id == equipment_type_id)
    if location_id:
        cabinet_query = cabinet_query.where(CabinetItem.cabinet.has(location_id=location_id))
        assembly_query = assembly_query.where(AssemblyItem.assembly.has(location_id=location_id))
    if q:
        cabinet_query = cabinet_query.where(
            or_(
                EquipmentType.name.ilike(f"%{q}%"),
                Manufacturer.name.ilike(f"%{q}%"),
                CabinetItem.equipment_type_name.ilike(f"%{q}%"),
            )
        )
        assembly_query = assembly_query.where(
            or_(
                EquipmentType.name.ilike(f"%{q}%"),
                Manufacturer.name.ilike(f"%{q}%"),
                AssemblyItem.equipment_type_name.ilike(f"%{q}%"),
            )
        )

    items: list[SerialMapEligibleEquipmentOut] = []

    for item in db.scalars(cabinet_query.order_by(CabinetItem.id.desc())).all():
        ports = _parse_serial_ports(item.equipment_type.serial_ports if item.equipment_type else None)
        if not ports:
            continue
        items.append(
            SerialMapEligibleEquipmentOut(
                key=f"cabinet:{item.id}",
                id=item.id,
                source="cabinet",
                containerId=item.cabinet_id,
                containerName=item.cabinet.name if item.cabinet else f"Cabinet {item.cabinet_id}",
                equipmentTypeId=item.equipment_type_id,
                equipmentTypeName=item.equipment_type_name or (item.equipment_type.name if item.equipment_type else f"#{item.equipment_type_id}"),
                manufacturerName=item.manufacturer_name,
                displayName=item.equipment_type_name or (item.equipment_type.name if item.equipment_type else f"Equipment #{item.id}"),
                serialPorts=ports,
                locationFullPath=build_location_full_path(item.cabinet.location_id if item.cabinet else None, locations_map),
            )
        )

    for item in db.scalars(assembly_query.order_by(AssemblyItem.id.desc())).all():
        ports = _parse_serial_ports(item.equipment_type.serial_ports if item.equipment_type else None)
        if not ports:
            continue
        items.append(
            SerialMapEligibleEquipmentOut(
                key=f"assembly:{item.id}",
                id=item.id,
                source="assembly",
                containerId=item.assembly_id,
                containerName=item.assembly.name if item.assembly else f"Assembly {item.assembly_id}",
                equipmentTypeId=item.equipment_type_id,
                equipmentTypeName=item.equipment_type_name or (item.equipment_type.name if item.equipment_type else f"#{item.equipment_type_id}"),
                manufacturerName=item.manufacturer_name,
                displayName=item.equipment_type_name or (item.equipment_type.name if item.equipment_type else f"Equipment #{item.id}"),
                serialPorts=ports,
                locationFullPath=build_location_full_path(item.assembly.location_id if item.assembly else None, locations_map),
            )
        )

    items.sort(key=lambda item: item.displayName.lower())
    return items


@router.get("/{document_id}", response_model=SerialMapDocumentOut)
def get_serial_map_document(document_id: int, db=Depends(get_db), user: User = Depends(require_read_access())):
    item = _get_or_404(db, document_id)
    before = item.document_json
    item = _migrate_legacy_document(db, item)
    if before != item.document_json:
        db.commit()
        db.refresh(item)
    return _to_out(item)


@router.patch("/{document_id}", response_model=SerialMapDocumentOut)
def update_serial_map_document(
    document_id: int,
    payload: SerialMapDocumentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = _get_or_404(db, document_id)
    item = _migrate_legacy_document(db, item)
    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)
    if "document" in data:
        item.document_json = payload.document.model_dump() if payload.document else item.document_json
        data.pop("document", None)
    for field, value in data.items():
        setattr(item, field, value)
    item.updated_by_id = current_user.id
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="serial_map_documents",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.delete("/{document_id}")
def delete_serial_map_document(
    document_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = _get_or_404(db, document_id)
    item = _migrate_legacy_document(db, item)
    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id
    item.updated_by_id = current_user.id
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="serial_map_documents",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )
    db.commit()
    return {"status": "ok"}


@router.post("/{document_id}/duplicate", response_model=SerialMapDocumentOut)
def duplicate_serial_map_document(
    document_id: int,
    payload: SerialMapDuplicatePayload,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    source = _migrate_legacy_document(db, _get_or_404(db, document_id))
    clone = SerialMapDocument(
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
        entity="serial_map_documents",
        entity_id=clone.id,
        meta={"duplicated_from_id": source.id},
        after=model_to_dict(clone),
    )
    db.commit()
    db.refresh(clone)
    return _to_out(clone)
