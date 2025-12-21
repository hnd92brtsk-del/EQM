import enum
from sqlalchemy import String, Enum, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, SoftDeleteMixin, VersionMixin


class UserRole(enum.Enum):
    admin = "admin"
    engineer = "engineer"
    viewer = "viewer"


class User(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False, index=True)
    last_login_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))


Index(
    "ix_users_username_active_unique",
    User.username,
    unique=True,
    postgresql_where=(User.is_deleted == False),
)
