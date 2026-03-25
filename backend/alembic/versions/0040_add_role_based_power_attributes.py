"""add role-based power attributes to equipment types

Revision ID: 0040_add_role_based_power_attributes
Revises: 0039_convert_serial_map_documents_to_single_scheme
Create Date: 2026-03-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0040_add_role_based_power_attributes"
down_revision = "0039_convert_serial_map_documents_to_single_scheme"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipment_types", sa.Column("role_in_power_chain", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("top_current_type", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("top_supply_voltage", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("bottom_current_type", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("bottom_supply_voltage", sa.String(length=32), nullable=True))
    op.add_column("equipment_types", sa.Column("current_value_a", sa.Float(), nullable=True))

    op.execute(
        """
        UPDATE equipment_types
        SET role_in_power_chain = COALESCE(power_role, role_in_power_chain)
        WHERE power_role IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE equipment_types
        SET role_in_power_chain = 'consumer'
        WHERE role_in_power_chain IS NULL
          AND (current_type IS NOT NULL OR supply_voltage IS NOT NULL OR current_consumption_a IS NOT NULL)
        """
    )
    op.execute(
        """
        UPDATE equipment_types
        SET role_in_power_chain = 'passive'
        WHERE role_in_power_chain IS NULL
        """
    )
    op.execute(
        """
        UPDATE equipment_types
        SET current_value_a = COALESCE(current_consumption_a, max_output_current_a, current_value_a)
        WHERE current_value_a IS NULL
        """
    )
    op.execute(
        """
        UPDATE equipment_types
        SET top_current_type = current_type,
            top_supply_voltage = supply_voltage,
            bottom_current_type = COALESCE(output_voltage, bottom_current_type),
            bottom_supply_voltage = COALESCE(output_voltage, bottom_supply_voltage)
        WHERE role_in_power_chain = 'converter'
        """
    )


def downgrade() -> None:
    op.drop_column("equipment_types", "current_value_a")
    op.drop_column("equipment_types", "bottom_supply_voltage")
    op.drop_column("equipment_types", "bottom_current_type")
    op.drop_column("equipment_types", "top_supply_voltage")
    op.drop_column("equipment_types", "top_current_type")
    op.drop_column("equipment_types", "role_in_power_chain")
