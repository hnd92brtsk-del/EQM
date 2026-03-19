"""remove subnet prefix restriction

Revision ID: 0033_remove_subnet_prefix_restriction
Revises: 0032_expand_ipam_for_calculator_and_equipment_tree
Create Date: 2026-03-19 11:20:00
"""

from alembic import op


revision = "0033_remove_subnet_prefix_restriction"
down_revision = "0032_expand_ipam_for_calculator_and_equipment_tree"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_subnets_prefix_allowed", "subnets", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        "ck_subnets_prefix_allowed",
        "subnets",
        "prefix IN (16, 20, 24)",
    )
