"""add CAD foundation aggregate

Revision ID: 0051_add_cad_foundation
Revises: 0050_add_main_equipment_drive_to_technological_equipment
Create Date: 2026-09-18 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0051_add_cad_foundation"
down_revision = "0050_add_main_equipment_drive_to_technological_equipment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cad_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=1000)),
        sa.Column("profile", sa.String(length=64), nullable=False, server_default="generic"),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id")),
        sa.Column("owner_type", sa.String(length=64)),
        sa.Column("owner_id", sa.Integer()),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("document_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_cad_documents_active_profile", "cad_documents", ["is_deleted", "profile"])
    op.create_index("ix_cad_documents_active_location", "cad_documents", ["is_deleted", "location_id"])
    op.create_index("ix_cad_documents_owner", "cad_documents", ["owner_type", "owner_id"])
    op.create_index("ix_cad_documents_updated_at", "cad_documents", ["updated_at"])
    op.create_table(
        "cad_entity_bindings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("cad_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("element_id", sa.String(length=128), nullable=False),
        sa.Column("binding_id", sa.String(length=128), nullable=False),
        sa.Column("binding_role", sa.String(length=64), nullable=False, server_default="primary"),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=128), nullable=False),
        sa.Column("snapshot_name", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_cad_entity_bindings_document_element", "cad_entity_bindings", ["document_id", "element_id"])
    op.create_index("ix_cad_entity_bindings_entity", "cad_entity_bindings", ["entity_type", "entity_id"])


def downgrade() -> None:
    op.drop_table("cad_entity_bindings")
    op.drop_table("cad_documents")
