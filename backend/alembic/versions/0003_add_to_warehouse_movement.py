"""add to_warehouse movement type

Revision ID: 0003_add_to_warehouse_movement
Revises: 0002_align_architecture
Create Date: 2025-12-20 23:10:00.000000
"""

from alembic import op

revision = "0003_add_to_warehouse_movement"
down_revision = "0002_align_architecture"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'to_warehouse'")


def downgrade():
    # Postgres does not support removing enum values.
    pass
