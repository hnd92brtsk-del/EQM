from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import MIN_JWT_SECRET_LENGTH, Settings
from app.core.security import hash_password, verify_password
from app.db.base import Base
from app.models.security import RoleDefinition, User, UserRole
from scripts import seed as seed_script


def build_settings(monkeypatch: pytest.MonkeyPatch, **overrides) -> Settings:
    base = {
        "ENV": "production",
        "JWT_SECRET": "x" * MIN_JWT_SECRET_LENGTH,
        "DB_PASSWORD": "strong-db-password",
        "POSTGRES_SUPERUSER_PASSWORD": "strong-postgres-password",
        "SEED_ADMIN_PASSWORD": "y" * MIN_JWT_SECRET_LENGTH,
        "LM_STUDIO_BASE_URL": "http://localhost:1234",
        "LLM_ALLOWED_HOSTS": "",
    }
    base.update(overrides)
    for key, value in base.items():
        monkeypatch.setenv(key, value)
    return Settings()


def test_production_config_rejects_default_jwt_secret(monkeypatch: pytest.MonkeyPatch):
    with pytest.raises(ValidationError):
        build_settings(monkeypatch, JWT_SECRET="change_me")


def test_production_config_rejects_weak_jwt_secret(monkeypatch: pytest.MonkeyPatch):
    with pytest.raises(ValidationError):
        build_settings(monkeypatch, JWT_SECRET="short-secret")


def test_production_config_rejects_default_seed_password(monkeypatch: pytest.MonkeyPatch):
    with pytest.raises(ValidationError):
        build_settings(monkeypatch, SEED_ADMIN_PASSWORD="admin12345")


def test_development_config_allows_local_defaults(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ENV", "development")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("DB_PASSWORD", raising=False)
    monkeypatch.delenv("POSTGRES_SUPERUSER_PASSWORD", raising=False)
    monkeypatch.delenv("SEED_ADMIN_PASSWORD", raising=False)

    settings = Settings()

    assert settings.env == "development"
    assert settings.jwt_secret
    assert settings.seed_admin_password


def test_production_accepts_localhost_llm_url(monkeypatch: pytest.MonkeyPatch):
    settings = build_settings(monkeypatch, LM_STUDIO_BASE_URL="http://localhost:1234")

    assert str(settings.lm_studio_base_url) == "http://localhost:1234/"


def test_production_accepts_allowlisted_llm_host(monkeypatch: pytest.MonkeyPatch):
    settings = build_settings(
        monkeypatch,
        LM_STUDIO_BASE_URL="https://llm.corp.example/v1",
        LLM_ALLOWED_HOSTS="llm.corp.example",
    )

    assert settings.llm_allowed_host_list == ["llm.corp.example"]


def test_production_rejects_public_llm_url(monkeypatch: pytest.MonkeyPatch):
    with pytest.raises(ValidationError):
        build_settings(monkeypatch, LM_STUDIO_BASE_URL="https://api.external-llm.example")


def test_production_rejects_invalid_llm_url(monkeypatch: pytest.MonkeyPatch):
    with pytest.raises(ValidationError):
        build_settings(monkeypatch, LM_STUDIO_BASE_URL="not-a-url")


def test_seed_does_not_reset_existing_admin_password_in_production_without_explicit_flag(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(engine, tables=[RoleDefinition.__table__, User.__table__])

    db = SessionLocal()
    try:
        db.add(RoleDefinition(key=UserRole.admin.value, label="Administrator", is_system=True))
        admin = User(username="admin", password_hash=hash_password("old-password"), role=UserRole.admin.value)
        db.add(admin)
        db.commit()
        db.refresh(admin)

        monkeypatch.setattr(seed_script, "settings", SimpleNamespace(is_production=True))
        monkeypatch.delenv("ALLOW_ADMIN_PASSWORD_RESET", raising=False)

        seed_script.seed_admin_user(db, "admin", "z" * MIN_JWT_SECRET_LENGTH)
        db.commit()
        db.refresh(admin)

        assert verify_password("old-password", admin.password_hash)
        assert not verify_password("z" * MIN_JWT_SECRET_LENGTH, admin.password_hash)
    finally:
        db.close()
        Base.metadata.drop_all(engine, tables=[User.__table__, RoleDefinition.__table__])
