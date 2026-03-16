"""add hierarchies for categories and manufacturers

Revision ID: 0030_add_hierarchies_for_categories_and_manufacturers
Revises: 0029_update_io_signals_data_type_fields
Create Date: 2026-03-15 16:55:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0030_add_hierarchies_for_categories_and_manufacturers"
down_revision = "0029_update_io_signals_data_type_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipment_categories", sa.Column("parent_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_equipment_categories_parent_id_equipment_categories",
        "equipment_categories",
        "equipment_categories",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_equipment_categories_parent_id", "equipment_categories", ["parent_id"], unique=False)
    op.drop_index("ix_equipment_categories_name_active_unique", table_name="equipment_categories")
    op.create_index(
        "ix_equipment_categories_parent_name_active_unique",
        "equipment_categories",
        ["parent_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.add_column("manufacturers", sa.Column("parent_id", sa.Integer(), nullable=True))
    op.add_column("manufacturers", sa.Column("flag", sa.String(length=16), nullable=True))
    op.add_column("manufacturers", sa.Column("founded_year", sa.Integer(), nullable=True))
    op.add_column("manufacturers", sa.Column("segment", sa.String(length=255), nullable=True))
    op.add_column("manufacturers", sa.Column("specialization", sa.Text(), nullable=True))
    op.add_column("manufacturers", sa.Column("website", sa.String(length=255), nullable=True))
    op.create_foreign_key(
        "fk_manufacturers_parent_id_manufacturers",
        "manufacturers",
        "manufacturers",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_manufacturers_parent_id", "manufacturers", ["parent_id"], unique=False)
    op.drop_index("ix_manufacturers_name_active_unique", table_name="manufacturers")
    op.create_index(
        "ix_manufacturers_parent_name_active_unique",
        "manufacturers",
        ["parent_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade() -> None:
    op.drop_index("ix_manufacturers_parent_name_active_unique", table_name="manufacturers")
    op.create_index(
        "ix_manufacturers_name_active_unique",
        "manufacturers",
        ["name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )
    op.drop_index("ix_manufacturers_parent_id", table_name="manufacturers")
    op.drop_constraint("fk_manufacturers_parent_id_manufacturers", "manufacturers", type_="foreignkey")
    op.drop_column("manufacturers", "website")
    op.drop_column("manufacturers", "specialization")
    op.drop_column("manufacturers", "segment")
    op.drop_column("manufacturers", "founded_year")
    op.drop_column("manufacturers", "flag")
    op.drop_column("manufacturers", "parent_id")

    op.drop_index("ix_equipment_categories_parent_name_active_unique", table_name="equipment_categories")
    op.create_index(
        "ix_equipment_categories_name_active_unique",
        "equipment_categories",
        ["name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )
    op.drop_index("ix_equipment_categories_parent_id", table_name="equipment_categories")
    op.drop_constraint(
        "fk_equipment_categories_parent_id_equipment_categories",
        "equipment_categories",
        type_="foreignkey",
    )
    op.drop_column("equipment_categories", "parent_id")
