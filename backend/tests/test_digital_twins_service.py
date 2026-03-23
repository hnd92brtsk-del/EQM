from types import SimpleNamespace

from app.schemas.digital_twins import (
    DigitalTwinDocument,
    DigitalTwinItem,
    DigitalTwinPowerEdge,
    DigitalTwinPowerGraph,
    DigitalTwinPowerNode,
    DigitalTwinRail,
)
from app.services.digital_twins import default_document, stable_item_id, sync_document_with_operation_items


def make_equipment_type(**overrides):
    defaults = {
        "id": 100,
        "name": "SIMATIC S7-1200",
        "manufacturer": SimpleNamespace(name="Siemens"),
        "article": "6ES7214-1AG40-0XB0",
        "nomenclature_number": "ET-100",
        "current_type": "Переменный",
        "supply_voltage": "220В",
        "current_consumption_a": 0.5,
        "mount_type": "din-rail",
        "mount_width_mm": 110,
        "power_role": "consumer",
        "output_voltage": None,
        "max_output_current_a": None,
        "is_channel_forming": True,
        "channel_count": 14,
        "ai_count": 2,
        "di_count": 8,
        "ao_count": 0,
        "do_count": 4,
        "is_network": True,
        "network_ports": [{"type": "RJ-45 (8p8c)", "count": 2}],
        "has_serial_interfaces": False,
        "serial_ports": [],
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def make_operation_item(item_id: int, quantity: int = 1, equipment_type=None):
    return SimpleNamespace(
        id=item_id,
        quantity=quantity,
        equipment_type=equipment_type or make_equipment_type(),
    )


def test_sync_adds_source_backed_items_from_operation():
    document = default_document()

    synced = sync_document_with_operation_items(document, "cabinet", [make_operation_item(10, quantity=2)])

    assert len(synced.items) == 1
    item = synced.items[0]
    assert item.id == stable_item_id("cabinet", 10)
    assert item.item_kind == "source-backed"
    assert item.quantity == 2
    assert item.mount_width_mm == 110
    assert item.placement_mode == "unplaced"
    assert synced.powerGraph.nodes[0].item_id == item.id


def test_sync_is_idempotent_and_preserves_manual_placement_and_edges():
    source_item_id = stable_item_id("cabinet", 10)
    document = DigitalTwinDocument(
        version=1,
        walls=default_document().walls,
        rails=default_document().rails,
        items=[
            DigitalTwinItem(
                id=source_item_id,
                item_kind="source-backed",
                source_status="active",
                placement_mode="rail",
                wall_id="back",
                rail_id="rail-1",
                sort_order=3,
                name="Old Name",
                user_label="CPU main",
                equipment_item_source="cabinet",
                equipment_item_id=10,
                equipment_type_id=100,
                quantity=1,
            ),
            DigitalTwinItem(
                id="manual-1",
                item_kind="manual",
                placement_mode="wall",
                wall_id="left",
                sort_order=0,
                name="Ручной элемент",
                quantity=1,
            ),
        ],
        powerGraph=DigitalTwinPowerGraph(
            nodes=[
                DigitalTwinPowerNode(id="pnode-a", item_id=source_item_id, label="CPU main", x=10, y=20),
                DigitalTwinPowerNode(id="pnode-b", item_id="manual-1", label="Ручной элемент", x=30, y=40),
            ],
            edges=[DigitalTwinPowerEdge(id="edge-1", source="pnode-a", target="pnode-b", label="feed")],
        ),
        viewport=default_document().viewport,
        ui=default_document().ui,
    )
    document.rails.append(
        DigitalTwinRail(id="rail-1", wall_id="back", name="DIN-рейка 1", length_mm=600, sort_order=0)
    )

    synced = sync_document_with_operation_items(document, "cabinet", [make_operation_item(10)])

    source_items = [item for item in synced.items if item.item_kind == "source-backed"]
    assert len(source_items) == 1
    assert source_items[0].name == "SIMATIC S7-1200"
    assert source_items[0].user_label == "CPU main"
    assert source_items[0].placement_mode == "rail"
    assert source_items[0].rail_id == "rail-1"
    assert any(item.id == "manual-1" and item.item_kind == "manual" for item in synced.items)
    assert len(synced.powerGraph.edges) == 1


def test_sync_marks_missing_operation_items_as_out_of_operation():
    document = default_document()
    document.items = [
        DigitalTwinItem(
            id=stable_item_id("assembly", 21),
            item_kind="source-backed",
            source_status="active",
            placement_mode="wall",
            wall_id="right",
            name="Источник",
            equipment_item_source="assembly",
            equipment_item_id=21,
            equipment_type_id=7,
            quantity=1,
        )
    ]

    synced = sync_document_with_operation_items(document, "assembly", [])

    assert len(synced.items) == 1
    assert synced.items[0].source_status == "out_of_operation"
