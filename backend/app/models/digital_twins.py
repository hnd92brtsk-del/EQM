from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, VersionMixin


class DigitalTwinDocument(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "digital_twin_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    scope: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    source_context: Mapped[dict | None] = mapped_column(JSONB)
    document_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)


Index(
    "ix_digital_twin_documents_scope_source_active_unique",
    DigitalTwinDocument.scope,
    DigitalTwinDocument.source_id,
    unique=True,
    postgresql_where=(DigitalTwinDocument.is_deleted == False),
)
