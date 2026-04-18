"""remove legacy field equipments dictionary

Revision ID: 0049_remove_field_equipments_legacy
Revises: 0048_add_equipment_category_to_io_signals
Create Date: 2026-04-11 19:05:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0049_remove_field_equipments_legacy"
down_revision = "0048_add_equipment_category_to_io_signals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("fk_io_signals_field_equipment_id", "io_signals", type_="foreignkey")
    op.drop_index("ix_io_signals_field_equipment_id", table_name="io_signals")
    op.drop_column("io_signals", "field_equipment_id")

    op.drop_index("ix_field_equipments_parent_name_active_unique", table_name="field_equipments")
    op.drop_index("ix_field_equipments_parent_id", table_name="field_equipments")
    op.drop_table("field_equipments")


def downgrade() -> None:
    op.create_table(
        "field_equipments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["parent_id"], ["field_equipments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_field_equipments_parent_id", "field_equipments", ["parent_id"], unique=False)
    op.create_index(
        "ix_field_equipments_parent_name_active_unique",
        "field_equipments",
        ["parent_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.add_column("io_signals", sa.Column("field_equipment_id", sa.Integer(), nullable=True))
    op.create_index("ix_io_signals_field_equipment_id", "io_signals", ["field_equipment_id"], unique=False)
    op.create_foreign_key(
        "fk_io_signals_field_equipment_id",
        "io_signals",
        "field_equipments",
        ["field_equipment_id"],
        ["id"],
        ondelete="SET NULL",
    )
