"""add equipment categories and link to equipment types

Revision ID: 0004_add_equipment_category_to_equipment_types
Revises: 0003_add_to_warehouse_movement
Create Date: 2025-12-26 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_add_equipment_category_to_equipment_types"
down_revision = "0003_add_to_warehouse_movement"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "equipment_categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"], name="fk_equipment_categories_deleted_by_id_users"),
    )
    op.create_index(
        "ix_equipment_categories_name_active_unique",
        "equipment_categories",
        ["name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.add_column(
        "equipment_types",
        sa.Column("equipment_category_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_equipment_types_equipment_category_id",
        "equipment_types",
        ["equipment_category_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_equipment_types_equipment_category_id",
        "equipment_types",
        "equipment_categories",
        ["equipment_category_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint("fk_equipment_types_equipment_category_id", "equipment_types", type_="foreignkey")
    op.drop_index("ix_equipment_types_equipment_category_id", table_name="equipment_types")
    op.drop_column("equipment_types", "equipment_category_id")

    op.drop_index("ix_equipment_categories_name_active_unique", table_name="equipment_categories")
    op.drop_table("equipment_categories")
