from types import SimpleNamespace

from app.services.equipment_uniqueness import (
    is_unique_equipment,
    normalize_operation_quantity,
)


def make_equipment(**overrides):
    defaults = {
        "is_channel_forming": False,
        "is_network": False,
        "has_serial_interfaces": False,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_is_unique_equipment_detects_all_unique_flags():
    assert is_unique_equipment(make_equipment(is_channel_forming=True)) is True
    assert is_unique_equipment(make_equipment(is_network=True)) is True
    assert is_unique_equipment(make_equipment(has_serial_interfaces=True)) is True


def test_normalize_operation_quantity_keeps_regular_equipment_quantity():
    equipment = make_equipment()
    assert normalize_operation_quantity(equipment, 3) == 3


def test_normalize_operation_quantity_locks_unique_equipment_to_one():
    equipment = make_equipment(has_serial_interfaces=True)
    assert normalize_operation_quantity(equipment, 4) == 1
