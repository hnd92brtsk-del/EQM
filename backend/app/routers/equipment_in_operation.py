from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, union_all, literal, or_, not_

from app.core.dependencies import get_db, require_read_access
from app.models.operations import CabinetItem, AssemblyItem
from app.models.core import Cabinet, EquipmentType, Manufacturer, Location
from app.models.assemblies import Assembly
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.equipment_in_operation import EquipmentInOperationOut

router = APIRouter()


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


@router.get("/", response_model=Pagination[EquipmentInOperationOut])
def list_equipment_in_operation(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    cabinet_id: int | None = None,
    assembly_id: int | None = None,
    equipment_type_id: int | None = None,
    manufacturer_id: int | None = None,
    location_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    cabinet_query = (
        select(
            CabinetItem.id.label("id"),
            literal("cabinet").label("source"),
            CabinetItem.cabinet_id.label("container_id"),
            Cabinet.name.label("container_name"),
            Cabinet.factory_number.label("container_factory_number"),
            Cabinet.nomenclature_number.label("container_inventory_number"),
            Cabinet.location_id.label("location_id"),
            CabinetItem.equipment_type_id.label("equipment_type_id"),
            EquipmentType.name.label("equipment_type_name"),
            EquipmentType.article.label("equipment_type_article"),
            EquipmentType.nomenclature_number.label("equipment_type_inventory_number"),
            EquipmentType.photo_filename.label("equipment_type_photo_filename"),
            EquipmentType.datasheet_filename.label("equipment_type_datasheet_filename"),
            EquipmentType.datasheet_original_name.label("equipment_type_datasheet_name"),
            EquipmentType.network_ports.label("network_ports"),
            EquipmentType.serial_ports.label("serial_ports"),
            EquipmentType.is_channel_forming.label("is_channel_forming"),
            EquipmentType.channel_count.label("channel_count"),
            not_(
                or_(
                    EquipmentType.is_network == True,
                    EquipmentType.is_channel_forming == True,
                    EquipmentType.has_serial_interfaces == True,
                )
            ).label("can_edit_quantity"),
            Manufacturer.name.label("manufacturer_name"),
            CabinetItem.quantity.label("quantity"),
            CabinetItem.is_deleted.label("is_deleted"),
            CabinetItem.deleted_at.label("deleted_at"),
            CabinetItem.created_at.label("created_at"),
            CabinetItem.updated_at.label("updated_at"),
        )
        .join(Cabinet, CabinetItem.cabinet_id == Cabinet.id)
        .join(EquipmentType, CabinetItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
    )

    assembly_query = (
        select(
            AssemblyItem.id.label("id"),
            literal("assembly").label("source"),
            AssemblyItem.assembly_id.label("container_id"),
            Assembly.name.label("container_name"),
            Assembly.factory_number.label("container_factory_number"),
            Assembly.nomenclature_number.label("container_inventory_number"),
            Assembly.location_id.label("location_id"),
            AssemblyItem.equipment_type_id.label("equipment_type_id"),
            EquipmentType.name.label("equipment_type_name"),
            EquipmentType.article.label("equipment_type_article"),
            EquipmentType.nomenclature_number.label("equipment_type_inventory_number"),
            EquipmentType.photo_filename.label("equipment_type_photo_filename"),
            EquipmentType.datasheet_filename.label("equipment_type_datasheet_filename"),
            EquipmentType.datasheet_original_name.label("equipment_type_datasheet_name"),
            EquipmentType.network_ports.label("network_ports"),
            EquipmentType.serial_ports.label("serial_ports"),
            EquipmentType.is_channel_forming.label("is_channel_forming"),
            EquipmentType.channel_count.label("channel_count"),
            not_(
                or_(
                    EquipmentType.is_network == True,
                    EquipmentType.is_channel_forming == True,
                    EquipmentType.has_serial_interfaces == True,
                )
            ).label("can_edit_quantity"),
            Manufacturer.name.label("manufacturer_name"),
            AssemblyItem.quantity.label("quantity"),
            AssemblyItem.is_deleted.label("is_deleted"),
            AssemblyItem.deleted_at.label("deleted_at"),
            AssemblyItem.created_at.label("created_at"),
            AssemblyItem.updated_at.label("updated_at"),
        )
        .join(Assembly, AssemblyItem.assembly_id == Assembly.id)
        .join(EquipmentType, AssemblyItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
    )

    if is_deleted is None:
        if not include_deleted:
            cabinet_query = cabinet_query.where(CabinetItem.is_deleted == False)
            assembly_query = assembly_query.where(AssemblyItem.is_deleted == False)
    else:
        cabinet_query = cabinet_query.where(CabinetItem.is_deleted == is_deleted)
        assembly_query = assembly_query.where(AssemblyItem.is_deleted == is_deleted)

    if cabinet_id:
        cabinet_query = cabinet_query.where(CabinetItem.cabinet_id == cabinet_id)
    if assembly_id:
        assembly_query = assembly_query.where(AssemblyItem.assembly_id == assembly_id)
    if equipment_type_id:
        cabinet_query = cabinet_query.where(CabinetItem.equipment_type_id == equipment_type_id)
        assembly_query = assembly_query.where(AssemblyItem.equipment_type_id == equipment_type_id)
    if manufacturer_id:
        cabinet_query = cabinet_query.where(EquipmentType.manufacturer_id == manufacturer_id)
        assembly_query = assembly_query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if location_id:
        cabinet_query = cabinet_query.where(Cabinet.location_id == location_id)
        assembly_query = assembly_query.where(Assembly.location_id == location_id)

    if created_at_from:
        cabinet_query = cabinet_query.where(CabinetItem.created_at >= created_at_from)
        assembly_query = assembly_query.where(AssemblyItem.created_at >= created_at_from)
    if created_at_to:
        cabinet_query = cabinet_query.where(CabinetItem.created_at <= created_at_to)
        assembly_query = assembly_query.where(AssemblyItem.created_at <= created_at_to)
    if updated_at_from:
        cabinet_query = cabinet_query.where(CabinetItem.updated_at >= updated_at_from)
        assembly_query = assembly_query.where(AssemblyItem.updated_at >= updated_at_from)
    if updated_at_to:
        cabinet_query = cabinet_query.where(CabinetItem.updated_at <= updated_at_to)
        assembly_query = assembly_query.where(AssemblyItem.updated_at <= updated_at_to)

    if q:
        if q.isdigit():
            value = int(q)
            cabinet_query = cabinet_query.where(
                (CabinetItem.cabinet_id == value) | (CabinetItem.equipment_type_id == value)
            )
            assembly_query = assembly_query.where(
                (AssemblyItem.assembly_id == value) | (AssemblyItem.equipment_type_id == value)
            )
        else:
            cabinet_query = cabinet_query.where(
                EquipmentType.name.ilike(f"%{q}%")
                | Manufacturer.name.ilike(f"%{q}%")
                | Cabinet.name.ilike(f"%{q}%")
            )
            assembly_query = assembly_query.where(
                EquipmentType.name.ilike(f"%{q}%")
                | Manufacturer.name.ilike(f"%{q}%")
                | Assembly.name.ilike(f"%{q}%")
            )

    union_query = union_all(cabinet_query, assembly_query).subquery()

    total = db.scalar(select(func.count()).select_from(union_query))

    query = select(union_query)
    if sort:
        sort_field = sort.lstrip("-")
        sort_map = {
            "equipment_type_name": union_query.c.equipment_type_name,
            "manufacturer_name": union_query.c.manufacturer_name,
            "container_name": union_query.c.container_name,
            "quantity": union_query.c.quantity,
            "created_at": union_query.c.created_at,
            "updated_at": union_query.c.updated_at,
        }
        if sort_field in sort_map:
            column = sort_map[sort_field]
            query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    rows = db.execute(query).all()
    locations = db.scalars(select(Location)).all()
    locations_map = {loc.id: loc for loc in locations}
    items: list[dict] = []
    for row in rows:
        data = dict(row._mapping)
        equipment_type_id = data.get("equipment_type_id")
        photo_filename = data.pop("equipment_type_photo_filename", None)
        datasheet_filename = data.pop("equipment_type_datasheet_filename", None)
        datasheet_name = data.pop("equipment_type_datasheet_name", None)
        data["equipment_type_photo_url"] = (
            f"/equipment-types/{equipment_type_id}/photo" if equipment_type_id and photo_filename else None
        )
        if equipment_type_id and datasheet_filename:
            data["equipment_type_datasheet_url"] = f"/equipment-types/{equipment_type_id}/datasheet"
            data["equipment_type_datasheet_name"] = datasheet_name
        else:
            data["equipment_type_datasheet_url"] = None
            data["equipment_type_datasheet_name"] = None
        data["location_full_path"] = build_location_full_path(data.get("location_id"), locations_map)
        data.pop("location_id", None)
        items.append(data)

    return Pagination(items=items, page=page, page_size=page_size, total=total)
