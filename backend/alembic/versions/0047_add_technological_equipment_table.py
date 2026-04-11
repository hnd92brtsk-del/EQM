"""add technological equipment table

Revision ID: 0047_add_technological_equipment_table
Revises: 0046_add_maintenance_module
Create Date: 2026-04-11 15:45:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0047_add_technological_equipment_table"
down_revision = "0046_add_maintenance_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "technological_equipment",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("main_equipment_id", sa.Integer(), nullable=False),
        sa.Column("tag", sa.String(length=120), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.ForeignKeyConstraint(["main_equipment_id"], ["main_equipment.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_technological_equipment_name",
        "technological_equipment",
        ["name"],
        unique=False,
    )
    op.create_index(
        "ix_technological_equipment_main_equipment_id",
        "technological_equipment",
        ["main_equipment_id"],
        unique=False,
    )
    op.create_index(
        "ix_technological_equipment_tag",
        "technological_equipment",
        ["tag"],
        unique=False,
    )
    op.create_index(
        "ix_technological_equipment_location_id",
        "technological_equipment",
        ["location_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_technological_equipment_location_id", table_name="technological_equipment")
    op.drop_index("ix_technological_equipment_tag", table_name="technological_equipment")
    op.drop_index("ix_technological_equipment_main_equipment_id", table_name="technological_equipment")
    op.drop_index("ix_technological_equipment_name", table_name="technological_equipment")
    op.drop_table("technological_equipment")
