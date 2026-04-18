"""add equipment category to io signals

Revision ID: 0048_add_equipment_category_to_io_signals
Revises: 0047_add_technological_equipment_table
Create Date: 2026-04-11 18:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0048_add_equipment_category_to_io_signals"
down_revision = "0047_add_technological_equipment_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("io_signals", sa.Column("equipment_category_id", sa.Integer(), nullable=True))
    op.create_index(
        "ix_io_signals_equipment_category_id",
        "io_signals",
        ["equipment_category_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_io_signals_equipment_category_id",
        "io_signals",
        "equipment_categories",
        ["equipment_category_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        """
        WITH matching_categories AS (
            SELECT
                fe.id AS field_equipment_id,
                MIN(ec.id) AS equipment_category_id
            FROM field_equipments fe
            JOIN equipment_categories ec
              ON lower(trim(fe.name)) = lower(trim(ec.name))
             AND ec.is_deleted = false
            WHERE fe.is_deleted = false
            GROUP BY fe.id
        )
        UPDATE io_signals ios
        SET equipment_category_id = mc.equipment_category_id
        FROM matching_categories mc
        WHERE ios.field_equipment_id = mc.field_equipment_id
          AND ios.equipment_category_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_io_signals_equipment_category_id", "io_signals", type_="foreignkey")
    op.drop_index("ix_io_signals_equipment_category_id", table_name="io_signals")
    op.drop_column("io_signals", "equipment_category_id")
