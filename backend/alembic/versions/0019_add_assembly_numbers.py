"""add assembly numbers

Revision ID: 0019_add_assembly_numbers
Revises: 0018_seed_signal_types_base_tree
Create Date: 2026-01-22 14:25:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0019_add_assembly_numbers"
down_revision = "0018_seed_signal_types_base_tree"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("assemblies", sa.Column("factory_number", sa.String(length=100), nullable=True))
    op.add_column("assemblies", sa.Column("nomenclature_number", sa.String(length=100), nullable=True))


def downgrade():
    op.drop_column("assemblies", "nomenclature_number")
    op.drop_column("assemblies", "factory_number")
