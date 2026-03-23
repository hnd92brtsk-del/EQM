"""add serial map documents

Revision ID: 0038_add_serial_map_documents
Revises: 0037_add_digital_twins_and_equipment_type_power_fields
Create Date: 2026-03-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0038_add_serial_map_documents"
down_revision = "0037_add_digital_twins_and_equipment_type_power_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "serial_map_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("scope", sa.String(length=64), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("source_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("document_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_serial_map_documents_created_by_id"), "serial_map_documents", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_serial_map_documents_location_id"), "serial_map_documents", ["location_id"], unique=False)
    op.create_index(op.f("ix_serial_map_documents_scope"), "serial_map_documents", ["scope"], unique=False)
    op.create_index(op.f("ix_serial_map_documents_updated_by_id"), "serial_map_documents", ["updated_by_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_serial_map_documents_updated_by_id"), table_name="serial_map_documents")
    op.drop_index(op.f("ix_serial_map_documents_scope"), table_name="serial_map_documents")
    op.drop_index(op.f("ix_serial_map_documents_location_id"), table_name="serial_map_documents")
    op.drop_index(op.f("ix_serial_map_documents_created_by_id"), table_name="serial_map_documents")
    op.drop_table("serial_map_documents")
