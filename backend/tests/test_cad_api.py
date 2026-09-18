from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.access import ensure_space_permissions_seeded
from app.core.dependencies import get_current_user
from app.core.dependencies import get_db
from app.db.base import Base
from app.models.cad import CadDocument, CadEntityBinding
from app.models.security import AccessSpace, RoleDefinition, RoleSpacePermission, User
from app.routers import cad as cad_router
from app.services.cad import documents as cad_documents


def make_client():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[User.__table__, CadDocument.__table__, CadEntityBinding.__table__])
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    user = User(username="cad-engineer", password_hash="x", role="engineer")
    session.add(user)
    session.commit()
    app = FastAPI()
    app.include_router(cad_router.router, prefix="/cad")
    def override_db():
        yield session
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[cad_router.read_engineering] = lambda: user
    app.dependency_overrides[cad_router.write_engineering] = lambda: user
    audit_events = []

    def capture_audit(_db, _actor_id, action, _entity, _entity_id, before=None, after=None, **_kwargs):
        audit_events.append({"action": action, "before": before, "after": after})

    cad_documents.add_audit_log = capture_audit
    return TestClient(app), session, audit_events


def make_rbac_client():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(
        engine,
        tables=[
            User.__table__, RoleDefinition.__table__, AccessSpace.__table__, RoleSpacePermission.__table__,
            CadDocument.__table__, CadEntityBinding.__table__,
        ],
    )
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    engineer = User(username="cad-engineer", password_hash="x", role="engineer")
    viewer = User(username="cad-viewer", password_hash="x", role="viewer")
    session.add_all([engineer, viewer])
    ensure_space_permissions_seeded(session)
    session.commit()

    active_user = {"value": engineer}
    app = FastAPI()
    app.include_router(cad_router.router, prefix="/cad")

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: active_user["value"]
    cad_documents.add_audit_log = lambda *args, **kwargs: None
    return TestClient(app), active_user, engineer, viewer


def document():
    return {"schemaVersion": 1, "pages": [], "layers": [], "elements": [], "styles": {}, "profileState": {}, "extensions": {}}


def test_cad_document_create_and_true_optimistic_locking():
    client, _session, _audit_events = make_client()
    created = client.post("/cad/documents", json={"name": "Foundation", "document": document()})
    assert created.status_code == 201
    item = created.json()
    assert item["row_version"] == 1

    updated = client.patch(f"/cad/documents/{item['id']}", json={"expectedVersion": 1, "name": "Changed"})
    assert updated.status_code == 200
    assert updated.json()["row_version"] == 2

    stale = client.patch(f"/cad/documents/{item['id']}", json={"expectedVersion": 1, "name": "Lost update"})
    assert stale.status_code == 409
    assert client.get(f"/cad/documents/{item['id']}").json()["name"] == "Changed"


def test_cad_rejects_unsupported_document_schema():
    client, _session, _audit_events = make_client()
    invalid = document()
    invalid["schemaVersion"] = 2
    response = client.post("/cad/documents", json={"name": "Bad schema", "document": invalid})
    assert response.status_code == 422


def test_cad_restore_is_versioned_and_audited():
    client, session, audit_events = make_client()
    created = client.post("/cad/documents", json={"name": "Foundation", "document": document()}).json()

    deleted = client.request("DELETE", f"/cad/documents/{created['id']}", json={"expectedVersion": 1})
    assert deleted.status_code == 204
    deleted_item = session.get(CadDocument, created["id"])
    assert deleted_item.is_deleted is True
    assert deleted_item.deleted_at is not None
    assert deleted_item.deleted_by_id is not None
    assert deleted_item.row_version == 2

    restored = client.post(f"/cad/documents/{created['id']}/restore", json={"expectedVersion": 2})
    assert restored.status_code == 200
    assert restored.json()["row_version"] == 3
    restored_item = session.get(CadDocument, created["id"])
    assert restored_item.is_deleted is False
    assert restored_item.deleted_at is None
    assert restored_item.deleted_by_id is None
    assert restored_item.row_version == 3

    stale = client.post(f"/cad/documents/{created['id']}/restore", json={"expectedVersion": 2})
    assert stale.status_code == 409
    assert session.get(CadDocument, created["id"]).row_version == 3
    restore_audit = next(event for event in audit_events if event["action"] == "RESTORE")
    assert restore_audit["before"]["row_version"] == 2
    assert restore_audit["after"]["row_version"] == 3


def test_cad_router_enforces_engineering_read_and_write_permissions():
    client, active_user, engineer, viewer = make_rbac_client()
    created = client.post("/cad/documents", json={"name": "Foundation", "document": document()})
    assert created.status_code == 201
    document_id = created.json()["id"]

    active_user["value"] = viewer
    assert client.get(f"/cad/documents/{document_id}").status_code == 200
    assert client.patch(f"/cad/documents/{document_id}", json={"expectedVersion": 1, "name": "Blocked"}).status_code == 403

    active_user["value"] = engineer
    assert client.get(f"/cad/documents/{document_id}").status_code == 200
    assert client.patch(f"/cad/documents/{document_id}", json={"expectedVersion": 1, "name": "Allowed"}).status_code == 200
