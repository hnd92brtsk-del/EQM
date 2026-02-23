"""drop main equipment level depth constraint

Revision ID: 0023_drop_main_equipment_level_constraint
Revises: 0022_add_main_equipment_dictionary
Create Date: 2026-02-22 04:05:00.000000
"""

from alembic import op


revision = "0023_drop_main_equipment_level_constraint"
down_revision = "0022_add_main_equipment_dictionary"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("ck_main_equipment_level_valid", "main_equipment", type_="check")


def downgrade():
    op.create_check_constraint(
        "ck_main_equipment_level_valid",
        "main_equipment",
        "level IN (1, 2, 3)",
    )
