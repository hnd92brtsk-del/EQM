"""add assembly items table

Revision ID: 0009_add_assembly_items_table
Revises: 0008_merge_heads
Create Date: 2026-01-12 18:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0009_add_assembly_items_table"
down_revision = "0008_merge_heads"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "assembly_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("assembly_id", sa.Integer(), nullable=False),
        sa.Column("equipment_type_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assembly_id"], ["assemblies.id"]),
        sa.ForeignKeyConstraint(["equipment_type_id"], ["equipment_types.id"]),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.UniqueConstraint("assembly_id", "equipment_type_id", name="uq_assembly_items_as_eqtype"),
    )
    op.create_index("ix_assembly_items_assembly_id", "assembly_items", ["assembly_id"], unique=False)
    op.create_index("ix_assembly_items_equipment_type_id", "assembly_items", ["equipment_type_id"], unique=False)


def downgrade():
    op.drop_index("ix_assembly_items_equipment_type_id", table_name="assembly_items")
    op.drop_index("ix_assembly_items_assembly_id", table_name="assembly_items")
    op.drop_table("assembly_items")
