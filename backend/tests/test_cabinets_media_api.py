from io import BytesIO

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user, get_db
from app.db.base import Base
from app.models.core import Cabinet, Location
from app.models.security import AccessSpace, RoleDefinition, RoleSpacePermission, User, UserRole
from app.routers import cabinets as cabinets_router


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, compiler, **kw):
    return "JSON"


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    Base.metadata.create_all(
        engine,
        tables=[
            RoleDefinition.__table__,
            AccessSpace.__table__,
            RoleSpacePermission.__table__,
            User.__table__,
            Location.__table__,
            Cabinet.__table__,
        ],
    )

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def admin_user(db_session):
    db_session.add(RoleDefinition(key=UserRole.admin.value, label="Administrator", is_system=True))
    admin = User(username="admin", password_hash="x", role=UserRole.admin.value)
    location = Location(name="Root")
    db_session.add_all([admin, location])
    db_session.flush()
    db_session.add(Cabinet(name="CAB-01", location_id=location.id))
    db_session.commit()
    db_session.refresh(admin)
    return admin


def _save_upload_for_test(file, target_dir):
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = file.filename or "upload.bin"
    path = target_dir / filename
    path.write_bytes(file.file.read())
    return type(
        "StoredFile",
        (),
        {
            "filename": filename,
            "mime": file.content_type or "application/octet-stream",
            "original_name": filename,
            "path": path,
        },
    )()


@pytest.fixture()
def client(db_session, admin_user, tmp_path, monkeypatch):
    app = FastAPI()
    app.include_router(cabinets_router.router, prefix="/cabinets")

    def _get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: admin_user
    monkeypatch.setattr(cabinets_router, "add_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(cabinets_router, "get_storage_dir", lambda kind: tmp_path / kind)
    monkeypatch.setattr(
        cabinets_router,
        "save_upload",
        lambda file, kind: _save_upload_for_test(file, tmp_path / kind),
    )
    return TestClient(app)


def test_upload_download_and_delete_cabinet_photo(client, db_session):
    cabinet = db_session.query(Cabinet).first()

    response = client.post(
        f"/cabinets/{cabinet.id}/photo",
        files={"file": ("cabinet.jpg", BytesIO(b"photo"), "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json()["photo_url"] == f"/cabinets/{cabinet.id}/photo"

    download = client.get(f"/cabinets/{cabinet.id}/photo")
    assert download.status_code == 200
    assert download.content == b"photo"

    deleted = client.delete(f"/cabinets/{cabinet.id}/photo")
    assert deleted.status_code == 200
    assert deleted.json()["photo_url"] is None


def test_upload_download_and_delete_cabinet_datasheet(client, db_session):
    cabinet = db_session.query(Cabinet).first()

    response = client.post(
        f"/cabinets/{cabinet.id}/datasheet",
        files={"file": ("cabinet.pdf", BytesIO(b"pdf"), "application/pdf")},
    )
    assert response.status_code == 200
    assert response.json()["datasheet_url"] == f"/cabinets/{cabinet.id}/datasheet"
    assert response.json()["datasheet_name"] == "cabinet.pdf"

    download = client.get(f"/cabinets/{cabinet.id}/datasheet")
    assert download.status_code == 200
    assert download.content == b"pdf"

    deleted = client.delete(f"/cabinets/{cabinet.id}/datasheet")
    assert deleted.status_code == 200
    assert deleted.json()["datasheet_url"] is None
