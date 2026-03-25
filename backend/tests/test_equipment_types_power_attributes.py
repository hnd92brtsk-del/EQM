from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers.equipment_types import apply_power_payload, normalize_power_payload
from app.schemas.equipment_types import EquipmentTypeCreate, EquipmentTypeUpdate


def make_equipment(**overrides):
    defaults = {
        "role_in_power_chain": None,
        "power_role": None,
        "current_type": None,
        "supply_voltage": None,
        "current_consumption_a": None,
        "top_current_type": None,
        "top_supply_voltage": None,
        "bottom_current_type": None,
        "bottom_supply_voltage": None,
        "current_value_a": None,
        "output_voltage": None,
        "max_output_current_a": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_normalize_power_payload_defaults_passive_for_create():
    payload = EquipmentTypeCreate(name="Клемма", nomenclature_number="NT-001", manufacturer_id=1)

    normalized = normalize_power_payload(payload, require_on_create=True)

    assert normalized["role_in_power_chain"] == "passive"
    assert normalized["current_value_a"] is None


def test_normalize_power_payload_requires_consumer_fields():
    payload = EquipmentTypeCreate(
        name="Блок",
        nomenclature_number="NT-002",
        manufacturer_id=1,
        role_in_power_chain="consumer",
        power_attributes={"role_in_power_chain": "consumer", "supply_voltage": "24В"},
    )

    with pytest.raises(HTTPException) as error:
        normalize_power_payload(payload, require_on_create=True)

    assert error.value.status_code == 400
    assert "Missing power attributes" in error.value.detail


def test_apply_power_payload_clears_irrelevant_fields_for_passive():
    equipment = make_equipment(
        role_in_power_chain="consumer",
        power_role="consumer",
        current_type="Постоянный",
        supply_voltage="24В",
        current_consumption_a=1.2,
        current_value_a=1.2,
    )
    payload = EquipmentTypeUpdate(
        role_in_power_chain="passive",
        power_attributes={"role_in_power_chain": "passive"},
    )

    normalized = normalize_power_payload(payload, equipment, require_on_create=False)
    apply_power_payload(equipment, normalized)

    assert equipment.role_in_power_chain == "passive"
    assert equipment.current_type is None
    assert equipment.current_value_a is None
    assert equipment.current_consumption_a is None


def test_converter_payload_uses_both_sides_and_current_value():
    equipment = make_equipment()
    payload = EquipmentTypeCreate(
        name="Преобразователь",
        nomenclature_number="NT-003",
        manufacturer_id=1,
        role_in_power_chain="converter",
        power_attributes={
            "role_in_power_chain": "converter",
            "top_current_type": "Постоянный",
            "top_supply_voltage": "24В",
            "bottom_current_type": "Переменный",
            "bottom_supply_voltage": "220В",
            "current_value_a": 2.5,
        },
    )

    normalized = normalize_power_payload(payload, require_on_create=True)
    apply_power_payload(equipment, normalized)

    assert equipment.role_in_power_chain == "converter"
    assert equipment.top_supply_voltage == "24В"
    assert equipment.bottom_supply_voltage == "220В"
    assert equipment.current_value_a == 2.5
    assert equipment.output_voltage == "220В"
