from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, union_all, literal, or_, not_

from app.core.dependencies import get_db, require_read_access
from app.models.operations import CabinetItem, AssemblyItem
from app.models.core import Cabinet, EquipmentType, Manufacturer, Location
from app.models.assemblies import Assembly
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.equipment_in_operation import (
    EquipmentInOperationContainerOut,
    EquipmentInOperationContainerNode,
    EquipmentInOperationLocationNode,
    EquipmentInOperationOut,
)

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


def get_location_scope_ids(location_id: int | None, locations_map: dict[int, Location]) -> list[int] | None:
    if not location_id or location_id not in locations_map:
        return None

    children_by_parent: dict[int | None, list[int]] = {}
    for location in locations_map.values():
        children_by_parent.setdefault(location.parent_id, []).append(location.id)

    scope_ids: list[int] = []
    stack = [location_id]
    seen: set[int] = set()
    while stack:
        current_id = stack.pop()
        if current_id in seen:
            continue
        seen.add(current_id)
        scope_ids.append(current_id)
        stack.extend(children_by_parent.get(current_id, []))

    return scope_ids


def build_cabinet_items_query(
    *,
    q: str | None,
    is_deleted: bool | None,
    include_deleted: bool,
    cabinet_id: int | None,
    equipment_type_id: int | None,
    manufacturer_id: int | None,
    location_ids: list[int] | None,
    created_at_from: datetime | None,
    created_at_to: datetime | None,
    updated_at_from: datetime | None,
    updated_at_to: datetime | None,
):
    query = (
        select(
            CabinetItem.id.label("id"),
            literal("cabinet").label("source"),
            CabinetItem.cabinet_id.label("container_id"),
            Cabinet.name.label("container_name"),
            Cabinet.factory_number.label("container_factory_number"),
            Cabinet.nomenclature_number.label("container_inventory_number"),
            Cabinet.location_id.label("location_id"),
            Cabinet.created_at.label("container_created_at"),
            CabinetItem.equipment_type_id.label("equipment_type_id"),
            EquipmentType.name.label("equipment_type_name"),
            EquipmentType.article.label("equipment_type_article"),
            EquipmentType.nomenclature_number.label("equipment_type_inventory_number"),
            EquipmentType.photo_filename.label("equipment_type_photo_filename"),
            EquipmentType.datasheet_filename.label("equipment_type_datasheet_filename"),
            EquipmentType.datasheet_original_name.label("equipment_type_datasheet_name"),
            EquipmentType.meta_data.label("equipment_type_meta_data"),
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

    if is_deleted is None:
        if not include_deleted:
            query = query.where(CabinetItem.is_deleted == False)
    else:
        query = query.where(CabinetItem.is_deleted == is_deleted)

    if cabinet_id:
        query = query.where(CabinetItem.cabinet_id == cabinet_id)
    if equipment_type_id:
        query = query.where(CabinetItem.equipment_type_id == equipment_type_id)
    if manufacturer_id:
        query = query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if location_ids:
        query = query.where(Cabinet.location_id.in_(location_ids))
    if created_at_from:
        query = query.where(CabinetItem.created_at >= created_at_from)
    if created_at_to:
        query = query.where(CabinetItem.created_at <= created_at_to)
    if updated_at_from:
        query = query.where(CabinetItem.updated_at >= updated_at_from)
    if updated_at_to:
        query = query.where(CabinetItem.updated_at <= updated_at_to)

    if q:
        if q.isdigit():
            value = int(q)
            query = query.where((CabinetItem.cabinet_id == value) | (CabinetItem.equipment_type_id == value))
        else:
            query = query.where(
                EquipmentType.name.ilike(f"%{q}%")
                | Manufacturer.name.ilike(f"%{q}%")
                | Cabinet.name.ilike(f"%{q}%")
                | Cabinet.factory_number.ilike(f"%{q}%")
                | Cabinet.nomenclature_number.ilike(f"%{q}%")
            )
    return query


def build_assembly_items_query(
    *,
    q: str | None,
    is_deleted: bool | None,
    include_deleted: bool,
    assembly_id: int | None,
    equipment_type_id: int | None,
    manufacturer_id: int | None,
    location_ids: list[int] | None,
    created_at_from: datetime | None,
    created_at_to: datetime | None,
    updated_at_from: datetime | None,
    updated_at_to: datetime | None,
):
    query = (
        select(
            AssemblyItem.id.label("id"),
            literal("assembly").label("source"),
            AssemblyItem.assembly_id.label("container_id"),
            Assembly.name.label("container_name"),
            Assembly.factory_number.label("container_factory_number"),
            Assembly.nomenclature_number.label("container_inventory_number"),
            Assembly.location_id.label("location_id"),
            Assembly.created_at.label("container_created_at"),
            AssemblyItem.equipment_type_id.label("equipment_type_id"),
            EquipmentType.name.label("equipment_type_name"),
            EquipmentType.article.label("equipment_type_article"),
            EquipmentType.nomenclature_number.label("equipment_type_inventory_number"),
            EquipmentType.photo_filename.label("equipment_type_photo_filename"),
            EquipmentType.datasheet_filename.label("equipment_type_datasheet_filename"),
            EquipmentType.datasheet_original_name.label("equipment_type_datasheet_name"),
            EquipmentType.meta_data.label("equipment_type_meta_data"),
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
            query = query.where(AssemblyItem.is_deleted == False)
    else:
        query = query.where(AssemblyItem.is_deleted == is_deleted)

    if assembly_id:
        query = query.where(AssemblyItem.assembly_id == assembly_id)
    if equipment_type_id:
        query = query.where(AssemblyItem.equipment_type_id == equipment_type_id)
    if manufacturer_id:
        query = query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if location_ids:
        query = query.where(Assembly.location_id.in_(location_ids))
    if created_at_from:
        query = query.where(AssemblyItem.created_at >= created_at_from)
    if created_at_to:
        query = query.where(AssemblyItem.created_at <= created_at_to)
    if updated_at_from:
        query = query.where(AssemblyItem.updated_at >= updated_at_from)
    if updated_at_to:
        query = query.where(AssemblyItem.updated_at <= updated_at_to)

    if q:
        if q.isdigit():
            value = int(q)
            query = query.where((AssemblyItem.assembly_id == value) | (AssemblyItem.equipment_type_id == value))
        else:
            query = query.where(
                EquipmentType.name.ilike(f"%{q}%")
                | Manufacturer.name.ilike(f"%{q}%")
                | Assembly.name.ilike(f"%{q}%")
                | Assembly.factory_number.ilike(f"%{q}%")
                | Assembly.nomenclature_number.ilike(f"%{q}%")
            )
    return query


def load_locations_map(db) -> dict[int, Location]:
    return {loc.id: loc for loc in db.scalars(select(Location)).all()}


def build_location_tree_response(
    *,
    locations_map: dict[int, Location],
    containers: list[dict],
) -> list[EquipmentInOperationLocationNode]:
    node_map: dict[int, EquipmentInOperationLocationNode] = {}

    for location in locations_map.values():
        full_path = build_location_full_path(location.id, locations_map) or location.name
        node_map[location.id] = EquipmentInOperationLocationNode(
            location_id=location.id,
            location_name=location.name,
            location_full_path=full_path,
            active_containers_count=0,
            deleted_containers_count=0,
            quantity_sum=0,
        )

    for container in containers:
        location_id = container.get("location_id")
        if not location_id or location_id not in node_map:
            continue
        current_id: int | None = location_id
        while current_id and current_id in node_map:
            node = node_map[current_id]
            if container.get("container_is_deleted"):
                node.deleted_containers_count += 1
            else:
                node.active_containers_count += 1
            node.quantity_sum += int(container.get("quantity_sum") or 0)
            current_location = locations_map.get(current_id)
            current_id = current_location.parent_id if current_location else None

        payload = dict(container)
        payload.pop("location_id", None)
        node_map[location_id].containers.append(EquipmentInOperationContainerNode(**payload))

    for node in node_map.values():
        node.containers.sort(key=lambda item: (item.container_name or "").lower())

    roots: list[EquipmentInOperationLocationNode] = []
    for location in locations_map.values():
        node = node_map[location.id]
        if (
            node.active_containers_count == 0
            and node.deleted_containers_count == 0
            and not node.containers
        ):
            continue
        if location.parent_id and location.parent_id in node_map:
            parent_node = node_map[location.parent_id]
            if (
                parent_node.active_containers_count > 0
                or parent_node.deleted_containers_count > 0
                or parent_node.containers
            ):
                parent_node.children.append(node)
                continue
        roots.append(node)

    def sort_nodes(nodes: list[EquipmentInOperationLocationNode]) -> list[EquipmentInOperationLocationNode]:
        return sorted(
            (
                EquipmentInOperationLocationNode(
                    location_id=node.location_id,
                    location_name=node.location_name,
                    location_full_path=node.location_full_path,
                    active_containers_count=node.active_containers_count,
                    deleted_containers_count=node.deleted_containers_count,
                    quantity_sum=node.quantity_sum,
                    containers=node.containers,
                    children=sort_nodes(node.children),
                )
                for node in nodes
            ),
            key=lambda item: item.location_name.lower(),
        )

    return sort_nodes(roots)


def serialize_item_rows(rows, locations_map: dict[int, Location]) -> list[dict]:
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
        data.pop("container_created_at", None)
        items.append(data)
    return items


def cabinet_matches_query(cabinet: Cabinet, location_full_path: str | None, q: str | None) -> bool:
    if not q:
        return True
    normalized = q.strip().lower()
    if not normalized:
        return True
    fields = [
        str(cabinet.id),
        cabinet.name,
        cabinet.factory_number,
        cabinet.nomenclature_number,
        location_full_path,
    ]
    return any(normalized in str(value).lower() for value in fields if value not in (None, ""))


def sort_container_rows(containers: list[dict], sort: str | None) -> list[dict]:
    sort_value = sort or "-created_at"
    sort_field = sort_value.lstrip("-")
    sort_desc = sort_value.startswith("-")

    def compare_text(value: str | None):
        return (value is None or value == "", (value or "").lower())

    if sort_field == "quantity":
        containers.sort(key=lambda item: (item["quantity_sum"], item["container_name"].lower()), reverse=sort_desc)
    elif sort_field == "equipment_type_name":
        containers.sort(
            key=lambda item: (compare_text(item.get("equipment_type_name_sort")), item["container_name"].lower()),
            reverse=sort_desc,
        )
    elif sort_field == "manufacturer_name":
        containers.sort(
            key=lambda item: (compare_text(item.get("manufacturer_name_sort")), item["container_name"].lower()),
            reverse=sort_desc,
        )
    elif sort_field == "container_name":
        containers.sort(key=lambda item: item["container_name"].lower(), reverse=sort_desc)
    else:
        created_key = "_created_at_max" if sort_desc else "_created_at_min"
        containers.sort(
            key=lambda item: (
                item.get(created_key) is None,
                item.get(created_key) or datetime.min,
                item["container_name"].lower(),
            ),
            reverse=sort_desc,
        )
    return containers


def build_container_rows(
    *,
    db,
    locations_map: dict[int, Location],
    q: str | None,
    sort: str | None,
    is_deleted: bool | None,
    include_deleted: bool,
    cabinet_id: int | None,
    assembly_id: int | None,
    equipment_type_id: int | None,
    manufacturer_id: int | None,
    location_id: int | None,
    created_at_from: datetime | None,
    created_at_to: datetime | None,
    updated_at_from: datetime | None,
    updated_at_to: datetime | None,
) -> list[dict]:
    location_scope_ids = get_location_scope_ids(location_id, locations_map)

    cabinet_rows = db.execute(
        build_cabinet_items_query(
            q=q,
            is_deleted=is_deleted,
            include_deleted=include_deleted,
            cabinet_id=cabinet_id,
            equipment_type_id=equipment_type_id,
            manufacturer_id=manufacturer_id,
            location_ids=location_scope_ids,
            created_at_from=created_at_from,
            created_at_to=created_at_to,
            updated_at_from=updated_at_from,
            updated_at_to=updated_at_to,
        )
    ).all()

    assembly_rows = db.execute(
        build_assembly_items_query(
            q=q,
            is_deleted=is_deleted,
            include_deleted=include_deleted,
            assembly_id=assembly_id,
            equipment_type_id=equipment_type_id,
            manufacturer_id=manufacturer_id,
            location_ids=location_scope_ids,
            created_at_from=created_at_from,
            created_at_to=created_at_to,
            updated_at_from=updated_at_from,
            updated_at_to=updated_at_to,
        )
    ).all()

    cabinet_items_by_id: dict[int, list[dict]] = {}
    for row in cabinet_rows:
        data = dict(row._mapping)
        cabinet_items_by_id.setdefault(data["container_id"], []).append(data)

    assembly_items_by_id: dict[int, list[dict]] = {}
    for row in assembly_rows:
        data = dict(row._mapping)
        assembly_items_by_id.setdefault(data["container_id"], []).append(data)

    containers: list[dict] = []

    cabinets_query = select(Cabinet)
    if not include_deleted:
        cabinets_query = cabinets_query.where(Cabinet.is_deleted == False)
    if cabinet_id:
        cabinets_query = cabinets_query.where(Cabinet.id == cabinet_id)
    if location_scope_ids:
        cabinets_query = cabinets_query.where(Cabinet.location_id.in_(location_scope_ids))
    cabinets = db.scalars(cabinets_query).all()

    for cabinet in cabinets:
        location_full_path = build_location_full_path(cabinet.location_id, locations_map)
        matched_rows = cabinet_items_by_id.get(cabinet.id, [])
        include_cabinet = False

        if equipment_type_id or manufacturer_id or is_deleted is True:
            include_cabinet = len(matched_rows) > 0
        elif q:
            include_cabinet = cabinet_matches_query(cabinet, location_full_path, q) or len(matched_rows) > 0
        else:
            include_cabinet = True

        if not include_cabinet:
            continue

        equipment_names = sorted(
            {row.get("equipment_type_name") for row in matched_rows if row.get("equipment_type_name")}
        )
        manufacturer_names = sorted(
            {row.get("manufacturer_name") for row in matched_rows if row.get("manufacturer_name")}
        )
        created_values = [row.get("created_at") for row in matched_rows if row.get("created_at")]

        containers.append(
            {
                "source": "cabinet",
                "container_id": cabinet.id,
                "container_name": cabinet.name,
                "container_factory_number": cabinet.factory_number,
                "container_inventory_number": cabinet.nomenclature_number,
                "location_id": cabinet.location_id,
                "location_full_path": location_full_path,
                "container_is_deleted": cabinet.is_deleted,
                "is_empty": len(matched_rows) == 0,
                "quantity_sum": sum(int(row.get("quantity") or 0) for row in matched_rows),
                "active_items_count": sum(1 for row in matched_rows if not row.get("is_deleted")),
                "deleted_items_count": sum(1 for row in matched_rows if row.get("is_deleted")),
                "equipment_type_name_sort": equipment_names[0] if equipment_names else None,
                "manufacturer_name_sort": manufacturer_names[0] if manufacturer_names else None,
                "created_at": max(created_values) if created_values else cabinet.created_at,
                "_created_at_min": min(created_values) if created_values else cabinet.created_at,
                "_created_at_max": max(created_values) if created_values else cabinet.created_at,
            }
        )

    assemblies_query = select(Assembly)
    if not include_deleted:
        assemblies_query = assemblies_query.where(Assembly.is_deleted == False)
    if assembly_id:
        assemblies_query = assemblies_query.where(Assembly.id == assembly_id)
    if location_scope_ids:
        assemblies_query = assemblies_query.where(Assembly.location_id.in_(location_scope_ids))
    assemblies = {assembly.id: assembly for assembly in db.scalars(assemblies_query).all()}

    for assembly_id_value, rows in assembly_items_by_id.items():
        assembly = assemblies.get(assembly_id_value)
        if not assembly:
            continue
        first = rows[0]
        equipment_names = sorted(
            {row.get("equipment_type_name") for row in rows if row.get("equipment_type_name")}
        )
        manufacturer_names = sorted(
            {row.get("manufacturer_name") for row in rows if row.get("manufacturer_name")}
        )
        created_values = [row.get("created_at") for row in rows if row.get("created_at")]
        containers.append(
            {
                "source": "assembly",
                "container_id": assembly_id_value,
                "container_name": assembly.name,
                "container_factory_number": assembly.factory_number,
                "container_inventory_number": assembly.nomenclature_number,
                "location_id": assembly.location_id,
                "location_full_path": build_location_full_path(assembly.location_id, locations_map),
                "container_is_deleted": assembly.is_deleted,
                "is_empty": False,
                "quantity_sum": sum(int(row.get("quantity") or 0) for row in rows),
                "active_items_count": sum(1 for row in rows if not row.get("is_deleted")),
                "deleted_items_count": sum(1 for row in rows if row.get("is_deleted")),
                "equipment_type_name_sort": equipment_names[0] if equipment_names else None,
                "manufacturer_name_sort": manufacturer_names[0] if manufacturer_names else None,
                "created_at": max(created_values) if created_values else first.get("container_created_at"),
                "_created_at_min": min(created_values) if created_values else first.get("container_created_at"),
                "_created_at_max": max(created_values) if created_values else first.get("container_created_at"),
            }
        )

    return sort_container_rows(containers, sort)


@router.get("/containers", response_model=Pagination[EquipmentInOperationContainerOut])
def list_equipment_in_operation_containers(
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
    locations_map = load_locations_map(db)
    containers = build_container_rows(
        db=db,
        locations_map=locations_map,
        q=q,
        sort=sort,
        is_deleted=is_deleted,
        include_deleted=include_deleted,
        cabinet_id=cabinet_id,
        assembly_id=assembly_id,
        equipment_type_id=equipment_type_id,
        manufacturer_id=manufacturer_id,
        location_id=location_id,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
        updated_at_from=updated_at_from,
        updated_at_to=updated_at_to,
    )

    total = len(containers)
    start = (page - 1) * page_size
    paged_items = containers[start : start + page_size]
    serialized = []
    for item in paged_items:
        data = dict(item)
        data.pop("_created_at_min", None)
        data.pop("_created_at_max", None)
        serialized.append(data)

    return Pagination(items=serialized, page=page, page_size=page_size, total=total)


@router.get("/tree", response_model=list[EquipmentInOperationLocationNode])
def get_equipment_in_operation_tree(
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
    locations_map = load_locations_map(db)
    containers = build_container_rows(
        db=db,
        locations_map=locations_map,
        q=q,
        sort=sort,
        is_deleted=is_deleted,
        include_deleted=include_deleted,
        cabinet_id=cabinet_id,
        assembly_id=assembly_id,
        equipment_type_id=equipment_type_id,
        manufacturer_id=manufacturer_id,
        location_id=location_id,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
        updated_at_from=updated_at_from,
        updated_at_to=updated_at_to,
    )
    return build_location_tree_response(locations_map=locations_map, containers=containers)


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
    locations_map = load_locations_map(db)
    location_scope_ids = get_location_scope_ids(location_id, locations_map)

    cabinet_query = build_cabinet_items_query(
        q=q,
        is_deleted=is_deleted,
        include_deleted=include_deleted,
        cabinet_id=cabinet_id,
        equipment_type_id=equipment_type_id,
        manufacturer_id=manufacturer_id,
        location_ids=location_scope_ids,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
        updated_at_from=updated_at_from,
        updated_at_to=updated_at_to,
    )
    assembly_query = build_assembly_items_query(
        q=q,
        is_deleted=is_deleted,
        include_deleted=include_deleted,
        assembly_id=assembly_id,
        equipment_type_id=equipment_type_id,
        manufacturer_id=manufacturer_id,
        location_ids=location_scope_ids,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
        updated_at_from=updated_at_from,
        updated_at_to=updated_at_to,
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
    items = serialize_item_rows(rows, locations_map)

    return Pagination(items=items, page=page, page_size=page_size, total=total)
