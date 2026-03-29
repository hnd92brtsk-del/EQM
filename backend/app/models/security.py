import enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, VersionMixin


class UserRole(str, enum.Enum):
    admin = "admin"
    engineer = "engineer"
    viewer = "viewer"


class SpaceKey(enum.Enum):
    overview = "overview"
    personnel = "personnel"
    equipment = "equipment"
    cabinets = "cabinets"
    engineering = "engineering"
    dictionaries = "dictionaries"
    admin_users = "admin_users"
    admin_sessions = "admin_sessions"
    admin_audit = "admin_audit"
    admin_diagnostics = "admin_diagnostics"


class User(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(64), ForeignKey("role_definitions.key"), nullable=False, index=True)
    last_login_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))


class RoleDefinition(Base):
    __tablename__ = "role_definitions"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)


class AccessSpace(Base):
    __tablename__ = "access_spaces"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    is_admin_space: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)


class RoleSpacePermission(Base):
    __tablename__ = "role_space_permissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(64), ForeignKey("role_definitions.key"), nullable=False, index=True)
    space_key: Mapped[str] = mapped_column(String(64), ForeignKey("access_spaces.key"), nullable=False, index=True)
    can_read: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    can_write: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    can_admin: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)

    __table_args__ = (
        UniqueConstraint("role", "space_key", name="uq_role_space_permissions_role_space"),
    )


Index(
    "ix_users_username_active_unique",
    User.username,
    unique=True,
    postgresql_where=(User.is_deleted == False),
)
