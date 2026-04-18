"""add drive type to technological equipment

Revision ID: 0050_add_main_equipment_drive_to_technological_equipment
Revises: 0049_remove_field_equipments_legacy
Create Date: 2026-04-11 21:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0050_add_main_equipment_drive_to_technological_equipment"
down_revision = "0049_remove_field_equipments_legacy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "technological_equipment",
        sa.Column("main_equipment_drive_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_technological_equipment_main_equipment_drive_id",
        "technological_equipment",
        "main_equipment",
        ["main_equipment_drive_id"],
        ["id"],
    )
    op.create_index(
        "ix_technological_equipment_main_equipment_drive_id",
        "technological_equipment",
        ["main_equipment_drive_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_technological_equipment_main_equipment_drive_id",
        table_name="technological_equipment",
    )
    op.drop_constraint(
        "fk_technological_equipment_main_equipment_drive_id",
        "technological_equipment",
        type_="foreignkey",
    )
    op.drop_column("technological_equipment", "main_equipment_drive_id")
