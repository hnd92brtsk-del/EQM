"""add channel and network fields to equipment types

Revision ID: 0010_add_channel_and_network_fields
Revises: 0009_add_assembly_items_table
Create Date: 2026-01-20 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0010_add_channel_and_network_fields"
down_revision = "0009_add_assembly_items_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "equipment_types",
        sa.Column("ai_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "equipment_types",
        sa.Column("di_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "equipment_types",
        sa.Column("ao_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "equipment_types",
        sa.Column("do_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "equipment_types",
        sa.Column("is_network", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "equipment_types",
        sa.Column("network_ports", postgresql.JSONB(), nullable=True),
    )
    op.execute(
        "UPDATE equipment_types SET ai_count = channel_count "
        "WHERE is_channel_forming = true AND channel_count IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("equipment_types", "network_ports")
    op.drop_column("equipment_types", "is_network")
    op.drop_column("equipment_types", "do_count")
    op.drop_column("equipment_types", "ao_count")
    op.drop_column("equipment_types", "di_count")
    op.drop_column("equipment_types", "ai_count")
