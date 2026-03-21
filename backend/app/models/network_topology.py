from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, VersionMixin


class NetworkTopologyDocument(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "network_topology_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    scope: Mapped[str | None] = mapped_column(String(64), index=True)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), index=True)
    source_context: Mapped[dict | None] = mapped_column(JSONB)
    document_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
