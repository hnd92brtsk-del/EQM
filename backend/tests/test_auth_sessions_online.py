from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user, get_db
from app.core.security import create_access_token, hash_token
from app.db.base import Base
from app.models.core import Personnel
from app.models.security import AccessSpace, RoleDefinition, RoleSpacePermission, User, UserRole
from app.models.sessions import UserSession
from app.routers import auth as auth_router
from app.routers import sessions as sessions_router
from app.schemas.auth import LoginIn


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
            RoleDefinition.__table__,
            AccessSpace.__table__,
            RoleSpacePermission.__table__,
            UserSession.__table__,
            Personnel.__table__,
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
                Personnel.__table__,
                UserSession.__table__,
                RoleSpacePermission.__table__,
                AccessSpace.__table__,
                RoleDefinition.__table__,
                User.__table__,
            ],
        )


@pytest.fixture()
def admin_user(db_session):
    db_session.add(RoleDefinition(key=UserRole.admin.value, label="Administrator", is_system=True))
    user = User(username="admin", password_hash="hash", role=UserRole.admin.value, is_deleted=False)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    db_session.add(
        Personnel(
            user_id=user.id,
            first_name="Ivan",
            last_name="Petrov",
            position="Operator",
        )
    )
    db_session.commit()
    return user


def make_client(db_session, monkeypatch):
    app = FastAPI()
    app.include_router(auth_router.router, prefix="/auth")
    app.include_router(sessions_router.router, prefix="/sessions")

    @app.get("/protected")
    def protected(_user=Depends(get_current_user)):
        return {"status": "ok"}

    def _get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db
    monkeypatch.setattr(auth_router, "add_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(auth_router, "enforce_table_row_limit", lambda *args, **kwargs: None)
    return TestClient(app)


def test_login_creates_last_seen_and_session_token(db_session, admin_user, monkeypatch):
    monkeypatch.setattr(auth_router, "verify_password", lambda plain, hashed: True)
    monkeypatch.setattr(auth_router, "add_audit_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(auth_router, "enforce_table_row_limit", lambda *args, **kwargs: None)

    request = SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        headers={"user-agent": "pytest"}
    )

    result = auth_router.login(LoginIn(username="admin", password="secret"), request, db_session)
    session = db_session.scalar(select(UserSession).where(UserSession.user_id == admin_user.id))

    assert result.access_token
    assert session is not None
    assert session.last_seen_at is not None
    assert session.session_token_hash == hash_token(result.access_token)


def test_heartbeat_refreshes_online_status_and_logout_removes_it(db_session, admin_user, monkeypatch):
    client = make_client(db_session, monkeypatch)
    session = UserSession(
        user_id=admin_user.id,
        session_token_hash="pending",
        last_seen_at=datetime.utcnow() - timedelta(minutes=3),
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    token = create_access_token(admin_user.username, admin_user.id, admin_user.role, session.id)
    session.session_token_hash = hash_token(token)
    db_session.commit()
    headers = {"Authorization": f"Bearer {token}"}

    stale_online = client.get("/sessions/online", headers=headers)
    assert stale_online.status_code == 200
    assert stale_online.json() == []

    heartbeat = client.post("/auth/heartbeat", headers=headers)
    assert heartbeat.status_code == 200

    db_session.refresh(session)
    assert session.last_seen_at is not None
    assert session.last_seen_at > datetime.utcnow() - timedelta(minutes=2)

    online = client.get("/sessions/online", headers=headers)
    assert online.status_code == 200
    payload = online.json()
    assert len(payload) == 1
    assert payload[0]["user_id"] == admin_user.id
    assert payload[0]["system_role"] == UserRole.admin.value
    assert payload[0]["personnel_full_name"] == "Petrov Ivan"

    logout = client.post("/auth/logout", headers=headers)
    assert logout.status_code == 200

    db_session.refresh(session)
    assert session.ended_at is not None

    after_logout_me = client.get("/auth/me", headers=headers)
    assert after_logout_me.status_code == 401

    after_logout_protected = client.get("/protected", headers=headers)
    assert after_logout_protected.status_code == 401

    after_logout_online = client.get("/sessions/online", headers=headers)
    assert after_logout_online.status_code == 401


def test_me_rejects_token_with_missing_session(db_session, admin_user, monkeypatch):
    client = make_client(db_session, monkeypatch)
    token = create_access_token(admin_user.username, admin_user.id, admin_user.role, 999999)

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_me_rejects_token_with_foreign_session(db_session, admin_user, monkeypatch):
    client = make_client(db_session, monkeypatch)
    db_session.add(RoleDefinition(key=UserRole.viewer.value, label="Viewer", is_system=True))
    other_user = User(username="viewer", password_hash="hash", role=UserRole.viewer.value, is_deleted=False)
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    foreign_session = UserSession(
        user_id=other_user.id,
        session_token_hash="pending",
        last_seen_at=datetime.utcnow(),
    )
    db_session.add(foreign_session)
    db_session.commit()
    db_session.refresh(foreign_session)

    token = create_access_token(admin_user.username, admin_user.id, admin_user.role, foreign_session.id)
    foreign_session.session_token_hash = hash_token("different-token")
    db_session.commit()

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_me_rejects_token_with_session_hash_mismatch(db_session, admin_user, monkeypatch):
    client = make_client(db_session, monkeypatch)
    session = UserSession(
        user_id=admin_user.id,
        session_token_hash="pending",
        last_seen_at=datetime.utcnow(),
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    token = create_access_token(admin_user.username, admin_user.id, admin_user.role, session.id)
    session.session_token_hash = hash_token("other-token")
    db_session.commit()

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
