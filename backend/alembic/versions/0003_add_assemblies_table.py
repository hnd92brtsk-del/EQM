"""add assemblies table

Revision ID: 0003_add_assemblies_table
Revises: 0002_align_architecture
Create Date: 2025-12-21 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_add_assemblies_table"
down_revision = "0002_align_architecture"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "assemblies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("meta_data", postgresql.JSONB()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index("ix_assemblies_location_id", "assemblies", ["location_id"], unique=False)
    op.create_index(
        "ix_assemblies_name_active_unique",
        "assemblies",
        ["name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade():
    op.drop_index("ix_assemblies_name_active_unique", table_name="assemblies")
    op.drop_index("ix_assemblies_location_id", table_name="assemblies")
    op.drop_table("assemblies")
