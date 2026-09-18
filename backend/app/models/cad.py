from sqlalchemy import JSON, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, VersionMixin


class CadDocument(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "cad_documents"
    __table_args__ = (
        Index("ix_cad_documents_active_profile", "is_deleted", "profile"),
        Index("ix_cad_documents_active_location", "is_deleted", "location_id"),
        Index("ix_cad_documents_owner", "owner_type", "owner_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    profile: Mapped[str] = mapped_column(String(64), nullable=False, server_default="generic")
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), index=True)
    owner_type: Mapped[str | None] = mapped_column(String(64))
    owner_id: Mapped[int | None] = mapped_column(Integer)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    document_json: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)


class CadEntityBinding(Base, TimestampMixin):
    __tablename__ = "cad_entity_bindings"
    __table_args__ = (
        Index("ix_cad_entity_bindings_document_element", "document_id", "element_id"),
        Index("ix_cad_entity_bindings_entity", "entity_type", "entity_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("cad_documents.id", ondelete="CASCADE"), nullable=False)
    element_id: Mapped[str] = mapped_column(String(128), nullable=False)
    binding_id: Mapped[str] = mapped_column(String(128), nullable=False)
    binding_role: Mapped[str] = mapped_column(String(64), nullable=False, server_default="primary")
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False)
    snapshot_name: Mapped[str | None] = mapped_column(String(255))
