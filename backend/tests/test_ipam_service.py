from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.ipam import equipment_has_network_interfaces, parse_network_ports, validate_subnet_cidr


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
