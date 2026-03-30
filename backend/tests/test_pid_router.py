from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user, get_db
from app.db.base import Base
from app.models.core import Location
from app.models.pid import PidProcess
from app.models.security import RoleDefinition, User, UserRole
from app.routers import pid as pid_router


def test_pid_process_can_be_created_and_soft_deleted(monkeypatch):
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
            User.__table__,
            Location.__table__,
            PidProcess.__table__,
        ],
    )

    db = SessionLocal()
    try:
        db.add(RoleDefinition(key=UserRole.engineer.value, label="Engineer", is_system=True))
        db.add(User(id=1, username="engineer", password_hash="x", role=UserRole.engineer.value, is_deleted=False))
        db.add(Location(id=1, name="Plant", is_deleted=False))
        db.commit()

        current_user = db.get(User, 1)

        app = FastAPI()
        app.include_router(pid_router.router, prefix="/pid")

        def _get_db():
            try:
                yield db
            finally:
                pass

        app.dependency_overrides[get_db] = _get_db
        app.dependency_overrides[get_current_user] = lambda: current_user
        monkeypatch.setattr(pid_router, "add_audit_log", lambda *args, **kwargs: None)

        client = TestClient(app)

        process = PidProcess(location_id=1, name="Test PID", description="draft", is_deleted=False)
        db.add(process)
        db.commit()
        db.refresh(process)
        process_id = process.id

        deleted = client.delete(f"/pid/processes/{process_id}")
        assert deleted.status_code == 200, deleted.text

        listed = client.get("/pid/1/processes")
        assert listed.status_code == 200, listed.text
        assert listed.json() == []

        stored = db.get(PidProcess, process_id)
        assert stored is not None
        assert stored.is_deleted is True
    finally:
        db.close()
        Base.metadata.drop_all(
            engine,
            tables=[
                PidProcess.__table__,
                Location.__table__,
                User.__table__,
                RoleDefinition.__table__,
            ],
        )
