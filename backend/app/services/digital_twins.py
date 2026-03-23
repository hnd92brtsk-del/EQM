from __future__ import annotations

from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.assemblies import Assembly
from app.models.core import Cabinet, EquipmentType
from app.models.digital_twins import DigitalTwinDocument as DigitalTwinDocumentModel
from app.models.operations import AssemblyItem, CabinetItem
from app.schemas.digital_twins import (
    DigitalTwinDocument,
    DigitalTwinItem,
    DigitalTwinPowerGraph,
    DigitalTwinPowerNode,
    DigitalTwinUiState,
    DigitalTwinViewport,
    DigitalTwinWall,
)

DEFAULT_WALLS = [
    DigitalTwinWall(id="back", name="Задняя панель"),
    DigitalTwinWall(id="left", name="Левая стенка"),
    DigitalTwinWall(id="right", name="Правая стенка"),
    DigitalTwinWall(id="top", name="Верхняя панель"),
]


def default_document() -> DigitalTwinDocument:
    return DigitalTwinDocument(
        version=1,
        walls=DEFAULT_WALLS,
        rails=[],
        items=[],
        powerGraph=DigitalTwinPowerGraph(nodes=[], edges=[]),
        viewport=DigitalTwinViewport(x=0, y=0, zoom=1),
        ui=DigitalTwinUiState(active_wall_id="back", active_layer="all"),
    )


def normalize_document(raw: dict | None) -> DigitalTwinDocument:
    document = DigitalTwinDocument.model_validate(raw or default_document().model_dump())
    if not document.walls:
        document.walls = DEFAULT_WALLS.copy()
    if not document.ui.active_wall_id and document.walls:
        document.ui.active_wall_id = document.walls[0].id
    return document


def _get_scope_container(db, scope: str, source_id: int):
    if scope == "cabinet":
        item = db.scalar(select(Cabinet).where(Cabinet.id == source_id, Cabinet.is_deleted == False))
        if not item:
            raise HTTPException(status_code=404, detail="Cabinet not found")
        return item
    if scope == "assembly":
        item = db.scalar(select(Assembly).where(Assembly.id == source_id, Assembly.is_deleted == False))
        if not item:
            raise HTTPException(status_code=404, detail="Assembly not found")
        return item
    raise HTTPException(status_code=400, detail="Unsupported digital twin scope")


def build_source_context(scope: str, source_item) -> dict:
    return {
        "scope": scope,
        "source_id": source_item.id,
        "name": source_item.name,
        "factory_number": getattr(source_item, "factory_number", None),
        "nomenclature_number": getattr(source_item, "nomenclature_number", None),
        "location_id": getattr(source_item, "location_id", None),
    }


def _serialize_ports(ports: list[dict] | None) -> list[dict]:
    if not isinstance(ports, list):
        return []
    result: list[dict] = []
    for item in ports:
        if not isinstance(item, dict):
            continue
        port_type = str(item.get("type") or "").strip()
        count = int(item.get("count") or 0)
        if port_type and count >= 0:
            result.append({"type": port_type, "count": count})
    return result


def load_operation_items(db, scope: str, source_id: int) -> list[CabinetItem | AssemblyItem]:
    if scope == "cabinet":
        return db.scalars(
            select(CabinetItem)
            .options(selectinload(CabinetItem.equipment_type).selectinload(EquipmentType.manufacturer))
            .where(CabinetItem.cabinet_id == source_id, CabinetItem.is_deleted == False)
            .order_by(CabinetItem.id.asc())
        ).all()
    return db.scalars(
        select(AssemblyItem)
        .options(selectinload(AssemblyItem.equipment_type).selectinload(EquipmentType.manufacturer))
        .where(AssemblyItem.assembly_id == source_id, AssemblyItem.is_deleted == False)
        .order_by(AssemblyItem.id.asc())
    ).all()


def stable_item_id(scope: str, equipment_item_id: int) -> str:
    return f"{scope}-source-{equipment_item_id}"


def _next_sort_order(items: list[DigitalTwinItem], placement_mode: str, wall_id: str | None, rail_id: str | None) -> int:
    same_bucket = [
        item.sort_order
        for item in items
        if item.placement_mode == placement_mode and item.wall_id == wall_id and item.rail_id == rail_id
    ]
    return max(same_bucket, default=-1) + 1


def operation_item_to_twin_item(
    scope: str,
    operation_item: CabinetItem | AssemblyItem,
    existing: DigitalTwinItem | None,
    current_items: list[DigitalTwinItem],
) -> DigitalTwinItem:
    equipment = operation_item.equipment_type
    if not equipment:
        raise HTTPException(status_code=400, detail="Equipment type not found for operation item")

    preserved = existing.model_dump() if existing else {}
    sort_order = preserved.get("sort_order")
    if sort_order is None:
        sort_order = _next_sort_order(current_items, "unplaced", None, None)

    return DigitalTwinItem(
        id=existing.id if existing else stable_item_id(scope, operation_item.id),
        item_kind="source-backed",
        source_status="active",
        placement_mode=preserved.get("placement_mode", "unplaced"),
        name=equipment.name,
        user_label=preserved.get("user_label"),
        equipment_item_source=scope,
        equipment_item_id=operation_item.id,
        equipment_type_id=equipment.id,
        manufacturer_name=equipment.manufacturer.name if equipment.manufacturer else None,
        article=equipment.article,
        nomenclature_number=equipment.nomenclature_number,
        quantity=operation_item.quantity,
        current_type=equipment.current_type,
        supply_voltage=equipment.supply_voltage,
        current_consumption_a=equipment.current_consumption_a,
        mount_type=equipment.mount_type,
        mount_width_mm=equipment.mount_width_mm,
        power_role=equipment.power_role,
        output_voltage=equipment.output_voltage,
        max_output_current_a=equipment.max_output_current_a,
        is_channel_forming=equipment.is_channel_forming,
        channel_count=equipment.channel_count,
        ai_count=equipment.ai_count,
        di_count=equipment.di_count,
        ao_count=equipment.ao_count,
        do_count=equipment.do_count,
        is_network=equipment.is_network,
        network_ports=_serialize_ports(equipment.network_ports),
        has_serial_interfaces=equipment.has_serial_interfaces,
        serial_ports=_serialize_ports(equipment.serial_ports),
        wall_id=preserved.get("wall_id"),
        rail_id=preserved.get("rail_id"),
        sort_order=sort_order,
    )


def sync_power_graph(document: DigitalTwinDocument) -> None:
    existing_nodes = {node.item_id: node for node in document.powerGraph.nodes}
    next_nodes: list[DigitalTwinPowerNode] = []
    for index, item in enumerate(document.items):
        previous = existing_nodes.get(item.id)
        next_nodes.append(
            DigitalTwinPowerNode(
                id=previous.id if previous else f"pnode-{item.id}",
                item_id=item.id,
                label=item.user_label or item.name,
                x=previous.x if previous else 80 + (index % 3) * 180,
                y=previous.y if previous else 60 + (index // 3) * 110,
                voltage=item.output_voltage or item.supply_voltage,
                role=item.power_role,
                status=item.source_status,
            )
        )
    valid_node_ids = {node.id for node in next_nodes}
    document.powerGraph.nodes = next_nodes
    document.powerGraph.edges = [
        edge for edge in document.powerGraph.edges if edge.source in valid_node_ids and edge.target in valid_node_ids
    ]


def ensure_document_integrity(document: DigitalTwinDocument) -> DigitalTwinDocument:
    wall_ids = {wall.id for wall in document.walls}
    rail_ids = {rail.id for rail in document.rails}
    for item in document.items:
        if item.wall_id and item.wall_id not in wall_ids:
            item.wall_id = document.walls[0].id if document.walls else None
        if item.rail_id and item.rail_id not in rail_ids:
            item.rail_id = None
            if item.placement_mode == "rail":
                item.placement_mode = "unplaced"
    if not document.ui.active_wall_id and document.walls:
        document.ui.active_wall_id = document.walls[0].id
    sync_power_graph(document)
    return document


def sync_document_with_operation_items(
    document: DigitalTwinDocument,
    scope: str,
    operation_items: list[CabinetItem | AssemblyItem],
) -> DigitalTwinDocument:
    by_source_key = {
        (item.equipment_item_source, item.equipment_item_id): item
        for item in document.items
        if item.item_kind == "source-backed" and item.equipment_item_source and item.equipment_item_id
    }
    next_items: list[DigitalTwinItem] = []
    seen_keys: set[tuple[str, int]] = set()

    for item in document.items:
        if item.item_kind == "manual":
            next_items.append(item)
        else:
            item.source_status = "out_of_operation"
            next_items.append(item)

    for operation_item in operation_items:
        key = (scope, operation_item.id)
        existing = by_source_key.get(key)
        next_item = operation_item_to_twin_item(scope, operation_item, existing, next_items)
        replaced = False
        for index, current in enumerate(next_items):
            if current.item_kind == "source-backed" and current.equipment_item_source == scope and current.equipment_item_id == operation_item.id:
                next_items[index] = next_item
                replaced = True
                break
        if not replaced:
            next_items.append(next_item)
        seen_keys.add(key)

    for item in next_items:
        if item.item_kind == "source-backed" and (item.equipment_item_source, item.equipment_item_id) not in seen_keys:
            item.source_status = "out_of_operation"

    buckets: dict[tuple[str, str | None, str | None], list[DigitalTwinItem]] = defaultdict(list)
    for item in next_items:
        buckets[(item.placement_mode, item.wall_id, item.rail_id)].append(item)
    for bucket_items in buckets.values():
        for index, item in enumerate(sorted(bucket_items, key=lambda current: (current.sort_order, current.id))):
            item.sort_order = index

    document.items = next_items
    return ensure_document_integrity(document)


def get_digital_twin_or_404(db, scope: str, source_id: int) -> DigitalTwinDocumentModel:
    item = db.scalar(
        select(DigitalTwinDocumentModel).where(
            DigitalTwinDocumentModel.scope == scope,
            DigitalTwinDocumentModel.source_id == source_id,
            DigitalTwinDocumentModel.is_deleted == False,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Digital twin not found")
    return item


def ensure_digital_twin(db, scope: str, source_id: int, user_id: int | None = None) -> DigitalTwinDocumentModel:
    source_item = _get_scope_container(db, scope, source_id)
    source_context = build_source_context(scope, source_item)
    model = db.scalar(
        select(DigitalTwinDocumentModel).where(
            DigitalTwinDocumentModel.scope == scope,
            DigitalTwinDocumentModel.source_id == source_id,
            DigitalTwinDocumentModel.is_deleted == False,
        )
    )
    document = normalize_document(model.document_json if model else None)
    document = sync_document_with_operation_items(document, scope, load_operation_items(db, scope, source_id))
    if model:
        model.source_context = source_context
        model.document_json = document.model_dump(by_alias=True)
        model.updated_by_id = user_id
        return model

    model = DigitalTwinDocumentModel(
        scope=scope,
        source_id=source_id,
        source_context=source_context,
        document_json=document.model_dump(by_alias=True),
        created_by_id=user_id,
        updated_by_id=user_id,
    )
    db.add(model)
    db.flush()
    return model
