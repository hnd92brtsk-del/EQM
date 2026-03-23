"""add digital twins and equipment type power fields

Revision ID: 0037_add_digital_twins_and_equipment_type_power_fields
Revises: 0036_add_personnel_yearly_schedule
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0037_add_digital_twins_and_equipment_type_power_fields"
down_revision = "0036_add_personnel_yearly_schedule"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipment_types", sa.Column("current_type", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("supply_voltage", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("current_consumption_a", sa.Float(), nullable=True))
    op.add_column("equipment_types", sa.Column("mount_type", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("mount_width_mm", sa.Integer(), nullable=True))
    op.add_column("equipment_types", sa.Column("power_role", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("output_voltage", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("max_output_current_a", sa.Float(), nullable=True))

    op.create_table(
        "digital_twin_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_digital_twin_documents_created_by_id"), "digital_twin_documents", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_digital_twin_documents_scope"), "digital_twin_documents", ["scope"], unique=False)
    op.create_index(op.f("ix_digital_twin_documents_source_id"), "digital_twin_documents", ["source_id"], unique=False)
    op.create_index(op.f("ix_digital_twin_documents_updated_by_id"), "digital_twin_documents", ["updated_by_id"], unique=False)
    op.create_index(
        "ix_digital_twin_documents_scope_source_active_unique",
        "digital_twin_documents",
        ["scope", "source_id"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade() -> None:
    op.drop_index("ix_digital_twin_documents_scope_source_active_unique", table_name="digital_twin_documents")
    op.drop_index(op.f("ix_digital_twin_documents_updated_by_id"), table_name="digital_twin_documents")
    op.drop_index(op.f("ix_digital_twin_documents_source_id"), table_name="digital_twin_documents")
    op.drop_index(op.f("ix_digital_twin_documents_scope"), table_name="digital_twin_documents")
    op.drop_index(op.f("ix_digital_twin_documents_created_by_id"), table_name="digital_twin_documents")
    op.drop_table("digital_twin_documents")

    op.drop_column("equipment_types", "max_output_current_a")
    op.drop_column("equipment_types", "output_voltage")
    op.drop_column("equipment_types", "power_role")
    op.drop_column("equipment_types", "mount_width_mm")
    op.drop_column("equipment_types", "mount_type")
    op.drop_column("equipment_types", "current_consumption_a")
    op.drop_column("equipment_types", "supply_voltage")
    op.drop_column("equipment_types", "current_type")
