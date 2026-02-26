"""add field equipments dictionary

Revision ID: 0024_add_field_equipments_dictionary
Revises: 0023_drop_main_equipment_level_constraint
Create Date: 2026-02-23 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0024_add_field_equipments_dictionary"
down_revision = "0023_drop_main_equipment_level_constraint"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "field_equipments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["field_equipments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )

    op.create_index("ix_field_equipments_parent_id", "field_equipments", ["parent_id"], unique=False)
    op.create_index(
        "ix_field_equipments_parent_name_active_unique",
        "field_equipments",
        ["parent_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade():
    op.drop_index("ix_field_equipments_parent_name_active_unique", table_name="field_equipments")
    op.drop_index("ix_field_equipments_parent_id", table_name="field_equipments")
    op.drop_table("field_equipments")
