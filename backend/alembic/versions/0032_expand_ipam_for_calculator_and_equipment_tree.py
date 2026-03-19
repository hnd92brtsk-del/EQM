"""expand ipam for calculator and equipment tree

Revision ID: 0032_expand_ipam_for_calculator_and_equipment_tree
Revises: 0031_add_ipam_module
Create Date: 2026-03-19 09:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0032_expand_ipam_for_calculator_and_equipment_tree"
down_revision = "0032_add_cabinet_info_field"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipment_network_interfaces", sa.Column("equipment_item_source", sa.String(length=32), nullable=True))
    op.add_column("equipment_network_interfaces", sa.Column("equipment_item_id", sa.Integer(), nullable=True))
    op.create_index(
        "ix_equipment_network_interfaces_equipment_item_source",
        "equipment_network_interfaces",
        ["equipment_item_source"],
        unique=False,
    )
    op.create_index(
        "ix_equipment_network_interfaces_equipment_item_id",
        "equipment_network_interfaces",
        ["equipment_item_id"],
        unique=False,
    )
    op.alter_column("equipment_network_interfaces", "equipment_instance_id", existing_type=sa.Integer(), nullable=True)
    op.execute(
        """
        UPDATE equipment_network_interfaces
        SET equipment_item_source = 'cabinet',
            equipment_item_id = equipment_instance_id
        WHERE equipment_instance_id IS NOT NULL
        """
    )
    op.create_unique_constraint(
        "uq_equipment_network_interfaces_target_identity",
        "equipment_network_interfaces",
        ["equipment_item_source", "equipment_item_id", "interface_name", "interface_index"],
    )

    op.add_column("ip_addresses", sa.Column("equipment_item_source", sa.String(length=32), nullable=True))
    op.add_column("ip_addresses", sa.Column("equipment_item_id", sa.Integer(), nullable=True))
    op.create_index("ix_ip_addresses_equipment_item_source", "ip_addresses", ["equipment_item_source"], unique=False)
    op.create_index("ix_ip_addresses_equipment_item_id", "ip_addresses", ["equipment_item_id"], unique=False)
    op.execute(
        """
        UPDATE ip_addresses
        SET equipment_item_source = 'cabinet',
            equipment_item_id = equipment_instance_id
        WHERE equipment_instance_id IS NOT NULL
        """
    )
    op.drop_constraint("ck_ip_addresses_status_allowed", "ip_addresses", type_="check")
    op.create_check_constraint(
        "ck_ip_addresses_status_allowed",
        "ip_addresses",
        "status IN ('free','used','reserved','service','gateway','broadcast','network')",
    )

    op.add_column("ip_address_audit_logs", sa.Column("old_equipment_item_source", sa.String(length=32), nullable=True))
    op.add_column("ip_address_audit_logs", sa.Column("new_equipment_item_source", sa.String(length=32), nullable=True))
    op.add_column("ip_address_audit_logs", sa.Column("old_equipment_item_id", sa.Integer(), nullable=True))
    op.add_column("ip_address_audit_logs", sa.Column("new_equipment_item_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE ip_address_audit_logs
        SET old_equipment_item_source = CASE WHEN old_equipment_instance_id IS NOT NULL THEN 'cabinet' ELSE NULL END,
            new_equipment_item_source = CASE WHEN new_equipment_instance_id IS NOT NULL THEN 'cabinet' ELSE NULL END,
            old_equipment_item_id = old_equipment_instance_id,
            new_equipment_item_id = new_equipment_instance_id
        """
    )


def downgrade() -> None:
    op.drop_column("ip_address_audit_logs", "new_equipment_item_id")
    op.drop_column("ip_address_audit_logs", "old_equipment_item_id")
    op.drop_column("ip_address_audit_logs", "new_equipment_item_source")
    op.drop_column("ip_address_audit_logs", "old_equipment_item_source")

    op.drop_constraint("ck_ip_addresses_status_allowed", "ip_addresses", type_="check")
    op.create_check_constraint(
        "ck_ip_addresses_status_allowed",
        "ip_addresses",
        "status IN ('free','used','reserved','gateway','broadcast','network')",
    )
    op.drop_index("ix_ip_addresses_equipment_item_id", table_name="ip_addresses")
    op.drop_index("ix_ip_addresses_equipment_item_source", table_name="ip_addresses")
    op.drop_column("ip_addresses", "equipment_item_id")
    op.drop_column("ip_addresses", "equipment_item_source")

    op.drop_constraint(
        "uq_equipment_network_interfaces_target_identity",
        "equipment_network_interfaces",
        type_="unique",
    )
    op.alter_column("equipment_network_interfaces", "equipment_instance_id", existing_type=sa.Integer(), nullable=False)
    op.drop_index(
        "ix_equipment_network_interfaces_equipment_item_id",
        table_name="equipment_network_interfaces",
    )
    op.drop_index(
        "ix_equipment_network_interfaces_equipment_item_source",
        table_name="equipment_network_interfaces",
    )
    op.drop_column("equipment_network_interfaces", "equipment_item_id")
    op.drop_column("equipment_network_interfaces", "equipment_item_source")
