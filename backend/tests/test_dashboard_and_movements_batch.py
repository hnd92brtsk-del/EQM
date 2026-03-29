import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user, get_db
from app.db.base import Base
from app.models.core import Cabinet, EquipmentCategory, EquipmentType, Manufacturer, Warehouse
from app.models.movements import EquipmentMovement
from app.models.operations import CabinetItem, WarehouseItem
from app.models.security import RoleDefinition, User, UserRole
from app.routers import dashboard as dashboard_router
from app.routers import movements as movements_router


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kw):
    return "JSON"


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(engine)

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(engine)


@pytest.fixture()
def admin_user(db_session):
    role = RoleDefinition(key=UserRole.admin.value, label="Administrator", is_system=True)
    user = User(username="admin", password_hash="x", role=UserRole.admin.value, is_deleted=False)
    db_session.add_all([role, user])
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def client(db_session, admin_user, monkeypatch):
    monkeypatch.setattr(dashboard_router, "add_audit_log", lambda *args, **kwargs: None, raising=False)
    monkeypatch.setattr(movements_router, "add_audit_log", lambda *args, **kwargs: None)

    app = FastAPI()
    app.include_router(dashboard_router.router, prefix="/dashboard")
    app.include_router(movements_router.router, prefix="/movements")

    def _get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: admin_user
    return TestClient(app)


def seed_base_catalog(db_session):
    manufacturer = Manufacturer(name="Test manufacturer", country="RU", is_deleted=False)
    root = EquipmentCategory(name="Root", is_deleted=False)
    child_a = EquipmentCategory(name="Child A", parent=root, is_deleted=False)
    child_b = EquipmentCategory(name="Child B", parent=root, is_deleted=False)
    warehouse = Warehouse(name="Main warehouse", is_deleted=False)
    cabinet = Cabinet(name="Main cabinet", is_deleted=False)
    db_session.add_all([manufacturer, root, child_a, child_b, warehouse, cabinet])
    db_session.flush()
    return manufacturer, root, child_a, child_b, warehouse, cabinet


def create_equipment_type(db_session, manufacturer_id: int, name: str, nomenclature_number: str, category_id: int | None):
    equipment = EquipmentType(
        name=name,
        nomenclature_number=nomenclature_number,
        manufacturer_id=manufacturer_id,
        equipment_category_id=category_id,
        is_channel_forming=False,
        channel_count=0,
        ai_count=0,
        di_count=0,
        ao_count=0,
        do_count=0,
        is_network=False,
        has_serial_interfaces=False,
        serial_ports=[],
        is_deleted=False,
    )
    db_session.add(equipment)
    db_session.flush()
    return equipment


def test_dashboard_overview_groups_warehouse_items_by_root_category(client, db_session):
    manufacturer, _root, child_a, child_b, warehouse, _cabinet = seed_base_catalog(db_session)
    equipment_a = create_equipment_type(db_session, manufacturer.id, "EQ-1", "N-1", child_a.id)
    equipment_b = create_equipment_type(db_session, manufacturer.id, "EQ-2", "N-2", child_b.id)
    uncategorized = create_equipment_type(db_session, manufacturer.id, "EQ-3", "N-3", None)

    db_session.add_all(
        [
            WarehouseItem(warehouse_id=warehouse.id, equipment_type_id=equipment_a.id, quantity=2, is_deleted=False),
            WarehouseItem(warehouse_id=warehouse.id, equipment_type_id=equipment_b.id, quantity=3, is_deleted=False),
            WarehouseItem(warehouse_id=warehouse.id, equipment_type_id=uncategorized.id, quantity=4, is_deleted=False),
        ]
    )
    db_session.commit()

    response = client.get("/dashboard/overview")

    assert response.status_code == 200
    donuts = response.json()["donuts"]["by_category"]
    assert {"name": "Root", "qty": 5} in donuts
    assert {"name": "Без категории", "qty": 4} in donuts


def test_movements_batch_creates_all_rows_in_single_request(client, db_session):
    manufacturer, _root, child_a, child_b, _warehouse, cabinet = seed_base_catalog(db_session)
    equipment_a = create_equipment_type(db_session, manufacturer.id, "EQ-1", "N-1", child_a.id)
    equipment_b = create_equipment_type(db_session, manufacturer.id, "EQ-2", "N-2", child_b.id)
    db_session.commit()

    response = client.post(
        "/movements/batch",
        json={
            "movement_type": "direct_to_cabinet",
            "to_cabinet_id": cabinet.id,
            "items": [
                {"equipment_type_id": equipment_a.id, "quantity": 2},
                {"equipment_type_id": equipment_b.id, "quantity": 3},
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2

    cabinet_items = db_session.scalars(select(CabinetItem).order_by(CabinetItem.equipment_type_id)).all()
    assert [(item.equipment_type_id, item.quantity) for item in cabinet_items] == [
        (equipment_a.id, 2),
        (equipment_b.id, 3),
    ]

    movements = db_session.scalars(select(EquipmentMovement).order_by(EquipmentMovement.id)).all()
    assert len(movements) == 2


def test_movements_batch_rolls_back_when_any_item_is_invalid(client, db_session):
    manufacturer, _root, child_a, _child_b, _warehouse, cabinet = seed_base_catalog(db_session)
    equipment = create_equipment_type(db_session, manufacturer.id, "EQ-1", "N-1", child_a.id)
    db_session.commit()

    response = client.post(
        "/movements/batch",
        json={
            "movement_type": "direct_to_cabinet",
            "to_cabinet_id": cabinet.id,
            "items": [
                {"equipment_type_id": equipment.id, "quantity": 2},
                {"equipment_type_id": 999999, "quantity": 1},
            ],
        },
    )

    assert response.status_code == 404
    assert db_session.scalars(select(CabinetItem)).all() == []
    assert db_session.scalars(select(EquipmentMovement)).all() == []
