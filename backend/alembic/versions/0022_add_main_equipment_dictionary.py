"""add main equipment dictionary

Revision ID: 0022_add_main_equipment_dictionary
Revises: 0021_add_io_signals_v2
Create Date: 2026-02-22 03:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0022_add_main_equipment_dictionary"
down_revision = "0021_add_io_signals_v2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "main_equipment",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("meta_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.CheckConstraint("level IN (1, 2, 3)", name="ck_main_equipment_level_valid"),
        sa.ForeignKeyConstraint(["parent_id"], ["main_equipment.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )

    op.create_index("ix_main_equipment_parent_id", "main_equipment", ["parent_id"], unique=False)
    op.create_index(
        "ix_main_equipment_code_active_unique",
        "main_equipment",
        ["code"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade():
    op.drop_index("ix_main_equipment_code_active_unique", table_name="main_equipment")
    op.drop_index("ix_main_equipment_parent_id", table_name="main_equipment")
    op.drop_table("main_equipment")

