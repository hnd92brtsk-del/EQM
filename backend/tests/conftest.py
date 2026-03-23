import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.security import User, UserRole
from app.models.core import (
    Personnel,
    PersonnelCompetency,
    PersonnelScheduleTemplate,
    PersonnelTraining,
    PersonnelYearlyScheduleAssignment,
    PersonnelYearlyScheduleEvent,
)
from app.routers import personnel as personnel_router


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
            User.__table__,
            PersonnelScheduleTemplate.__table__,
            Personnel.__table__,
            PersonnelCompetency.__table__,
            PersonnelTraining.__table__,
            PersonnelYearlyScheduleAssignment.__table__,
            PersonnelYearlyScheduleEvent.__table__,
        ],
    )

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(
            engine,
            tables=[
                PersonnelYearlyScheduleEvent.__table__,
                PersonnelYearlyScheduleAssignment.__table__,
                PersonnelTraining.__table__,
                PersonnelCompetency.__table__,
                Personnel.__table__,
                PersonnelScheduleTemplate.__table__,
                User.__table__,
            ],
        )


@pytest.fixture()
def users(db_session):
    admin = User(username="admin", password_hash="x", role=UserRole.admin)
    viewer = User(username="viewer", password_hash="x", role=UserRole.viewer)
    db_session.add_all([admin, viewer])
    db_session.commit()
    db_session.refresh(admin)
    db_session.refresh(viewer)
    return {"admin": admin, "viewer": viewer}


def make_app(db_session, user):
    app = FastAPI()
    app.include_router(personnel_router.router, prefix="/personnel")

    def _get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: user

    def _require_admin():
        if user.role != UserRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    app.dependency_overrides[require_admin] = _require_admin
    return app


@pytest.fixture()
def admin_client(db_session, users, monkeypatch):
    monkeypatch.setattr(personnel_router, "add_audit_log", lambda *args, **kwargs: None)
    app = make_app(db_session, users["admin"])
    return TestClient(app)


@pytest.fixture()
def viewer_client(db_session, users, monkeypatch):
    monkeypatch.setattr(personnel_router, "add_audit_log", lambda *args, **kwargs: None)
    app = make_app(db_session, users["viewer"])
    return TestClient(app)
