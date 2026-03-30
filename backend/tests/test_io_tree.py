from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user, get_db
from app.db.base import Base
from app.models.core import Cabinet, EquipmentCategory, EquipmentType, Location, Manufacturer
from app.models.operations import CabinetItem
from app.models.security import RoleDefinition, User, UserRole
from app.routers import io_tree as io_tree_router


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kw):
    return "JSON"


def test_io_tree_returns_only_relevant_location_branches():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(engine)

    db = SessionLocal()
    try:
        role = RoleDefinition(key=UserRole.engineer.value, label="Engineer", is_system=True)
        user = User(username="engineer", password_hash="x", role=UserRole.engineer.value, is_deleted=False)
        manufacturer = Manufacturer(name="Test manufacturer", country="RU", is_deleted=False)
        category = EquipmentCategory(name="Controllers", is_deleted=False)

        root = Location(name="Plant", is_deleted=False)
        child_without_plc = Location(name="Pump station", parent=root, is_deleted=False)
        child_with_plc = Location(name="Boiler room", parent=root, is_deleted=False)
        empty_root = Location(name="Warehouse campus", is_deleted=False)

        plc_type = EquipmentType(
            name="PLC-01",
            nomenclature_number="PLC-01",
            manufacturer=manufacturer,
            equipment_category=category,
            is_channel_forming=True,
            ai_count=2,
            di_count=1,
            ao_count=0,
            do_count=1,
            is_deleted=False,
        )
        passive_type = EquipmentType(
            name="Relay",
            nomenclature_number="RLY-01",
            manufacturer=manufacturer,
            equipment_category=category,
            is_channel_forming=False,
            ai_count=0,
            di_count=0,
            ao_count=0,
            do_count=0,
            is_deleted=False,
        )

        plc_cabinet = Cabinet(name="PLC cabinet", location=child_with_plc, is_deleted=False)
        passive_cabinet = Cabinet(name="Passive cabinet", location=child_without_plc, is_deleted=False)

        db.add_all(
            [
                role,
                user,
                manufacturer,
                category,
                root,
                child_without_plc,
                child_with_plc,
                empty_root,
                plc_type,
                passive_type,
                plc_cabinet,
                passive_cabinet,
            ]
        )
        db.flush()

        db.add_all(
            [
                CabinetItem(cabinet=plc_cabinet, equipment_type=plc_type, quantity=1, is_deleted=False),
                CabinetItem(cabinet=passive_cabinet, equipment_type=passive_type, quantity=1, is_deleted=False),
            ]
        )
        db.commit()

        app = FastAPI()
        app.include_router(io_tree_router.router, prefix="/api/v1")

        def _get_db():
            try:
                yield db
            finally:
                pass

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = lambda: user

        client = TestClient(app)
        response = client.get("/api/v1/io-tree")

        assert response.status_code == 200
        payload = response.json()

        assert [location["name"] for location in payload["locations"]] == ["Plant"]

        root_node = payload["locations"][0]
        assert root_node["cabinets"] == []
        assert [location["name"] for location in root_node["children"]] == ["Boiler room"]

        child_node = root_node["children"][0]
        assert [cabinet["name"] for cabinet in child_node["cabinets"]] == ["PLC cabinet"]
        assert child_node["children"] == []

        cabinet_node = child_node["cabinets"][0]
        assert [device["equipment_name"] for device in cabinet_node["channel_devices"]] == ["PLC-01"]
    finally:
        db.close()
        Base.metadata.drop_all(engine)
