"""add plc address and range fields to io_signals

Revision ID: 0043_add_io_signal_plc_range_fields
Revises: 0042_add_dynamic_roles_catalog
Create Date: 2026-03-29 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0043_add_io_signal_plc_range_fields"
down_revision = "0042_add_dynamic_roles_catalog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("io_signals", sa.Column("plc_absolute_address", sa.String(length=255), nullable=True))
    op.add_column("io_signals", sa.Column("range_from", sa.String(length=255), nullable=True))
    op.add_column("io_signals", sa.Column("range_to", sa.String(length=255), nullable=True))
    op.add_column("io_signals", sa.Column("full_range", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("io_signals", "full_range")
    op.drop_column("io_signals", "range_to")
    op.drop_column("io_signals", "range_from")
    op.drop_column("io_signals", "plc_absolute_address")
