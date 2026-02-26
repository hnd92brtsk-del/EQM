"""add data types dictionary

Revision ID: 0025_add_data_types_dictionary
Revises: 0024_add_field_equipments_dictionary
Create Date: 2026-02-26 15:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0025_add_data_types_dictionary"
down_revision = "0024_add_field_equipments_dictionary"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "data_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("tooltip", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["data_types.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index("ix_data_types_parent_id", "data_types", ["parent_id"], unique=False)
    op.create_index(
        "ix_data_types_parent_name_active_unique",
        "data_types",
        ["parent_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade():
    op.drop_index("ix_data_types_parent_name_active_unique", table_name="data_types")
    op.drop_index("ix_data_types_parent_id", table_name="data_types")
    op.drop_table("data_types")
