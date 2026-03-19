from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.ipam import (
    create_subnet_from_calculator_payload,
    equipment_has_network_interfaces,
    normalize_equipment_target,
    parse_network_ports,
    validate_subnet_cidr,
)


def make_equipment_type(**overrides):
    defaults = {
        "is_deleted": False,
        "network_ports": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_parse_network_ports_filters_invalid_entries():
    ports = parse_network_ports(
        [
            {"type": "RJ-45 (8p8c)", "count": 2},
            {"type": "LC", "count": 0},
            {"type": "", "count": 3},
            "bad",
        ]
    )
    assert ports == [{"type": "RJ-45 (8p8c)", "count": 2}]


def test_equipment_has_network_interfaces_detects_positive_count():
    equipment = make_equipment_type(network_ports=[{"type": "RJ-45 (8p8c)", "count": 1}])
    assert equipment_has_network_interfaces(equipment) is True


def test_equipment_has_network_interfaces_rejects_missing_or_deleted():
    assert equipment_has_network_interfaces(make_equipment_type(network_ports=None)) is False
    assert (
        equipment_has_network_interfaces(
            make_equipment_type(is_deleted=True, network_ports=[{"type": "RJ-45 (8p8c)", "count": 2}])
        )
        is False
    )


@pytest.mark.parametrize("cidr,prefix", [("10.0.0.0/24", 24), ("10.16.0.0/20", 20), ("10.0.0.0/16", 16)])
def test_validate_subnet_cidr_accepts_supported_prefixes(cidr, prefix):
    network, got_prefix = validate_subnet_cidr(cidr)
    assert str(network) == cidr
    assert got_prefix == prefix


def test_validate_subnet_cidr_rejects_unsupported_prefix():
    with pytest.raises(HTTPException) as exc:
        validate_subnet_cidr("10.0.0.0/25")
    assert exc.value.status_code == 400


def test_create_subnet_from_calculator_payload_normalizes_network_and_gateway():
    payload = SimpleNamespace(
        network_address_input="10.10.0.19",
        cidr=24,
        vlan_id=None,
        gateway_ip=None,
        name="Office LAN",
        description=None,
        location_id=None,
        vrf=None,
        is_active=True,
    )
    network, prefix, data = create_subnet_from_calculator_payload(None, payload)
    assert str(network) == "10.10.0.0/24"
    assert prefix == 24
    assert data["gateway_ip"] == "10.10.0.1"


def test_normalize_equipment_target_supports_legacy_and_universal_payloads():
    assert normalize_equipment_target("assembly", 12) == ("assembly", 12)
    assert normalize_equipment_target(None, None, 5) == ("cabinet", 5)
