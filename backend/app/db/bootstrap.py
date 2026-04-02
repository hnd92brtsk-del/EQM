from __future__ import annotations

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.security import User, UserRole


def ensure_alembic_version_table() -> None:
    settings = get_settings()
    engine = create_engine(settings.database_url, future=True)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS alembic_version (
                    version_num VARCHAR(255) NOT NULL PRIMARY KEY
                )
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE alembic_version
                ALTER COLUMN version_num TYPE VARCHAR(255)
                """
            )
        )


def ensure_admin_account() -> None:
    settings = get_settings()
    engine = create_engine(settings.database_url, future=True)
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "users" not in existing_tables:
        return

    with Session(engine) as session:
        admin_user = session.scalar(select(User).where(User.username == settings.seed_admin_username))
        if admin_user is None:
            admin_user = User(
                username=settings.seed_admin_username,
                password_hash=hash_password(settings.seed_admin_password),
                role=UserRole.admin.value,
            )
            session.add(admin_user)
            session.commit()
            return

        if admin_user.role != UserRole.admin.value:
            admin_user.role = UserRole.admin.value

        if not verify_password(settings.seed_admin_password, admin_user.password_hash):
            admin_user.password_hash = hash_password(settings.seed_admin_password)

        if admin_user.is_deleted:
            admin_user.is_deleted = False
            admin_user.deleted_at = None
            admin_user.deleted_by_id = None
        session.commit()


def bootstrap_database() -> None:
    ensure_alembic_version_table()
    ensure_admin_account()


if __name__ == "__main__":
    bootstrap_database()
