"""add is_accounted to warehouse_items

Revision ID: 0005_add_is_accounted_to_warehouse_items
Revises: 0004_add_equipment_category_to_equipment_types
Create Date: 2025-12-28 10:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_add_is_accounted_to_warehouse_items"
down_revision = "0004_add_equipment_category_to_equipment_types"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "warehouse_items",
        sa.Column("is_accounted", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.execute("UPDATE warehouse_items SET is_accounted = true WHERE is_accounted IS NULL")


def downgrade():
    op.drop_column("warehouse_items", "is_accounted")
