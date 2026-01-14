"""add assembly movement types and target column

Revision ID: 0011_add_assembly_movements
Revises: 0010_add_channel_and_network_fields
Create Date: 2026-01-21 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_add_assembly_movements"
down_revision = "0010_add_channel_and_network_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'to_assembly'")
    op.execute("ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'direct_to_assembly'")
    op.add_column("equipment_movements", sa.Column("to_assembly_id", sa.Integer(), nullable=True))
    op.create_index(
        "ix_equipment_movements_to_assembly_id",
        "equipment_movements",
        ["to_assembly_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_equipment_movements_to_assembly_id_assemblies",
        "equipment_movements",
        "assemblies",
        ["to_assembly_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint(
        "fk_equipment_movements_to_assembly_id_assemblies",
        "equipment_movements",
        type_="foreignkey",
    )
    op.drop_index("ix_equipment_movements_to_assembly_id", table_name="equipment_movements")
    op.drop_column("equipment_movements", "to_assembly_id")
    # Postgres does not support removing enum values.
    pass
