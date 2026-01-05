"""add measurement types

Revision ID: 0006_add_measurement_types
Revises: 0005_add_is_accounted_to_warehouse_items
Create Date: 2026-01-05 16:30:00.000000
"""

from alembic import op

revision = "0006_add_measurement_types"
down_revision = "0005_add_is_accounted_to_warehouse_items"
branch_labels = None
depends_on = None


def upgrade():
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS '4-20mA (AI)'")
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS '0-20mA (AI)'")
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS '0-10V (AI)'")
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS 'Pt100 (RTD AI)'")
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS 'Pt1000 (RTD AI)'")
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS 'M50 (RTD AI)'")
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS '24V (DI)'")
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS '220V (DI)'")
        op.execute("ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS '8-16mA (DI)'")

    op.execute("UPDATE io_signals SET measurement_type = '4-20mA (AI)' WHERE measurement_type = '4-20mA'")
    op.execute("UPDATE io_signals SET measurement_type = '0-10V (AI)' WHERE measurement_type = '0-10V'")
    op.execute("DELETE FROM io_signals WHERE measurement_type = 'other'")


def downgrade():
    pass
