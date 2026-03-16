"""add ipam module

Revision ID: 0031_add_ipam_module
Revises: 0030_add_hierarchies_for_categories_and_manufacturers
Create Date: 2026-03-16 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0031_add_ipam_module"
down_revision = "0030_add_hierarchies_for_categories_and_manufacturers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vlans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vlan_number", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("purpose", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index("ix_vlans_location_id", "vlans", ["location_id"])
    op.create_index("ix_vlans_name", "vlans", ["name"])
    op.create_index(
        "ix_vlans_vlan_number_active_unique",
        "vlans",
        ["vlan_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "subnets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vlan_id", sa.Integer(), nullable=True),
        sa.Column("cidr", sa.String(length=64), nullable=False),
        sa.Column("prefix", sa.Integer(), nullable=False),
        sa.Column("network_address", sa.String(length=64), nullable=False),
        sa.Column("gateway_ip", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("vrf", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["vlan_id"], ["vlans.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.CheckConstraint("prefix IN (16, 20, 24)", name="ck_subnets_prefix_allowed"),
    )
    op.create_index("ix_subnets_vlan_id", "subnets", ["vlan_id"])
    op.create_index("ix_subnets_location_id", "subnets", ["location_id"])
    op.create_index("ix_subnets_name", "subnets", ["name"])
    op.create_index(
        "ix_subnets_cidr_active_unique",
        "subnets",
        ["cidr"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "equipment_network_interfaces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("equipment_instance_id", sa.Integer(), nullable=False),
        sa.Column("interface_name", sa.String(length=255), nullable=False),
        sa.Column("interface_index", sa.Integer(), nullable=True),
        sa.Column("interface_type", sa.String(length=100), nullable=True),
        sa.Column("connector_spec", sa.String(length=100), nullable=True),
        sa.Column("mac_address", sa.String(length=100), nullable=True),
        sa.Column("is_management", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["equipment_instance_id"], ["cabinet_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.UniqueConstraint(
            "equipment_instance_id",
            "interface_name",
            "interface_index",
            name="uq_equipment_network_interfaces_identity",
        ),
    )
    op.create_index("ix_equipment_network_interfaces_equipment_instance_id", "equipment_network_interfaces", ["equipment_instance_id"])

    op.create_table(
        "ip_addresses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("subnet_id", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=False),
        sa.Column("ip_offset", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("hostname", sa.String(length=255), nullable=True),
        sa.Column("dns_name", sa.String(length=255), nullable=True),
        sa.Column("mac_address", sa.String(length=100), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("equipment_instance_id", sa.Integer(), nullable=True),
        sa.Column("equipment_interface_id", sa.Integer(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("source", sa.String(length=32), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["subnet_id"], ["subnets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["equipment_instance_id"], ["cabinet_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["equipment_interface_id"], ["equipment_network_interfaces.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.UniqueConstraint("subnet_id", "ip_offset", name="uq_ip_addresses_subnet_offset"),
        sa.CheckConstraint(
            "status IN ('free','used','reserved','gateway','broadcast','network')",
            name="ck_ip_addresses_status_allowed",
        ),
    )
    op.create_index("ix_ip_addresses_subnet_id", "ip_addresses", ["subnet_id"])
    op.create_index("ix_ip_addresses_status", "ip_addresses", ["status"])
    op.create_index("ix_ip_addresses_hostname", "ip_addresses", ["hostname"])
    op.create_index("ix_ip_addresses_equipment_instance_id", "ip_addresses", ["equipment_instance_id"])
    op.create_index("ix_ip_addresses_equipment_interface_id", "ip_addresses", ["equipment_interface_id"])
    op.create_index(
        "ix_ip_addresses_ip_address_active_unique",
        "ip_addresses",
        ["ip_address"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "ip_address_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ip_address_id", sa.Integer(), nullable=True),
        sa.Column("subnet_id", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("old_status", sa.String(length=32), nullable=True),
        sa.Column("new_status", sa.String(length=32), nullable=True),
        sa.Column("old_hostname", sa.String(length=255), nullable=True),
        sa.Column("new_hostname", sa.String(length=255), nullable=True),
        sa.Column("old_equipment_instance_id", sa.Integer(), nullable=True),
        sa.Column("new_equipment_instance_id", sa.Integer(), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ip_address_id"], ["ip_addresses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subnet_id"], ["subnets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_ip_address_audit_logs_subnet_id", "ip_address_audit_logs", ["subnet_id"])
    op.create_index("ix_ip_address_audit_logs_ip_address", "ip_address_audit_logs", ["ip_address"])
    op.create_index("ix_ip_address_audit_logs_action", "ip_address_audit_logs", ["action"])
    op.create_index("ix_ip_address_audit_logs_actor_user_id", "ip_address_audit_logs", ["actor_user_id"])
    op.create_index("ix_ip_address_audit_logs_created_at", "ip_address_audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_ip_address_audit_logs_created_at", table_name="ip_address_audit_logs")
    op.drop_index("ix_ip_address_audit_logs_actor_user_id", table_name="ip_address_audit_logs")
    op.drop_index("ix_ip_address_audit_logs_action", table_name="ip_address_audit_logs")
    op.drop_index("ix_ip_address_audit_logs_ip_address", table_name="ip_address_audit_logs")
    op.drop_index("ix_ip_address_audit_logs_subnet_id", table_name="ip_address_audit_logs")
    op.drop_table("ip_address_audit_logs")
    op.drop_index("ix_ip_addresses_ip_address_active_unique", table_name="ip_addresses")
    op.drop_index("ix_ip_addresses_equipment_interface_id", table_name="ip_addresses")
    op.drop_index("ix_ip_addresses_equipment_instance_id", table_name="ip_addresses")
    op.drop_index("ix_ip_addresses_hostname", table_name="ip_addresses")
    op.drop_index("ix_ip_addresses_status", table_name="ip_addresses")
    op.drop_index("ix_ip_addresses_subnet_id", table_name="ip_addresses")
    op.drop_table("ip_addresses")
    op.drop_index("ix_equipment_network_interfaces_equipment_instance_id", table_name="equipment_network_interfaces")
    op.drop_table("equipment_network_interfaces")
    op.drop_index("ix_subnets_cidr_active_unique", table_name="subnets")
    op.drop_index("ix_subnets_name", table_name="subnets")
    op.drop_index("ix_subnets_location_id", table_name="subnets")
    op.drop_index("ix_subnets_vlan_id", table_name="subnets")
    op.drop_table("subnets")
    op.drop_index("ix_vlans_vlan_number_active_unique", table_name="vlans")
    op.drop_index("ix_vlans_name", table_name="vlans")
    op.drop_index("ix_vlans_location_id", table_name="vlans")
    op.drop_table("vlans")
