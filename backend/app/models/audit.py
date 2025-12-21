from sqlalchemy import String, JSON, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    entity: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, index=True)
    before: Mapped[dict | None] = mapped_column(JSON)
    after: Mapped[dict | None] = mapped_column(JSON)
    meta: Mapped[dict | None] = mapped_column(JSON)
