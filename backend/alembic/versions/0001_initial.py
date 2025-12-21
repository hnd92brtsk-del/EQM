"""initial

Revision ID: 0001_initial
Revises: 
Create Date: 2025-12-20 21:40:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("admin", "engineer", "viewer", name="user_role"), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=False)
    op.create_index("ix_users_role", "users", ["role"], unique=False)
    op.create_index(
        "ix_users_username_active_unique",
        "users",
        ["username"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("session_token_hash", sa.String(length=255), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("end_reason", sa.String(length=32)),
        sa.Column("ip_address", sa.String(length=64)),
        sa.Column("user_agent", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"], unique=False)
    op.create_index("ix_user_sessions_session_token_hash", "user_sessions", ["session_token_hash"], unique=True)

    op.create_table(
        "manufacturers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_manufacturers_name_active_unique",
        "manufacturers",
        ["name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "locations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["locations.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_locations_parent_id", "locations", ["parent_id"], unique=False)

    op.create_table(
        "equipment_types",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("nomenclature_number", sa.String(length=100), nullable=False),
        sa.Column("manufacturer_id", sa.Integer(), nullable=False),
        sa.Column("is_channel_forming", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("channel_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("meta_data", sa.JSON()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["manufacturer_id"], ["manufacturers.id"]),
    )
    op.create_index("ix_equipment_types_manufacturer_id", "equipment_types", ["manufacturer_id"], unique=False)
    op.create_index(
        "ix_equipment_types_nomenclature_active_unique",
        "equipment_types",
        ["nomenclature_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "warehouses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("meta_data", sa.JSON()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_warehouses_location_id", "warehouses", ["location_id"], unique=False)

    op.create_table(
        "cabinets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("meta_data", sa.JSON()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_cabinets_location_id", "cabinets", ["location_id"], unique=False)

    op.create_table(
        "warehouse_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("warehouse_id", sa.Integer(), nullable=False),
        sa.Column("equipment_type_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["equipment_type_id"], ["equipment_types.id"]),
        sa.UniqueConstraint("warehouse_id", "equipment_type_id", name="uq_warehouse_items_wh_eqtype"),
    )
    op.create_index("ix_warehouse_items_warehouse_id", "warehouse_items", ["warehouse_id"], unique=False)
    op.create_index("ix_warehouse_items_equipment_type_id", "warehouse_items", ["equipment_type_id"], unique=False)

    op.create_table(
        "cabinet_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("cabinet_id", sa.Integer(), nullable=False),
        sa.Column("equipment_type_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"]),
        sa.ForeignKeyConstraint(["equipment_type_id"], ["equipment_types.id"]),
        sa.UniqueConstraint("cabinet_id", "equipment_type_id", name="uq_cabinet_items_cb_eqtype"),
    )
    op.create_index("ix_cabinet_items_cabinet_id", "cabinet_items", ["cabinet_id"], unique=False)
    op.create_index("ix_cabinet_items_equipment_type_id", "cabinet_items", ["equipment_type_id"], unique=False)

    op.create_table(
        "io_signals",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("cabinet_component_id", sa.Integer(), nullable=False),
        sa.Column("tag_name", sa.String(length=200)),
        sa.Column("signal_name", sa.String(length=500)),
        sa.Column("plc_channel_address", sa.String(length=100)),
        sa.Column("signal_type", sa.Enum("AI", "AO", "DI", "DO", name="signal_type"), nullable=False),
        sa.Column("measurement_type", sa.Enum("4-20mA", "0-10V", "other", name="measurement_type"), nullable=False),
        sa.Column("terminal_connection", sa.String(length=100)),
        sa.Column("sensor_range", sa.String(length=100)),
        sa.Column("engineering_units", sa.String(length=50)),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cabinet_component_id"], ["cabinet_items.id"]),
    )
    op.create_index("ix_io_signals_cabinet_component_id", "io_signals", ["cabinet_component_id"], unique=False)

    op.create_table(
        "equipment_movements",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "movement_type",
            sa.Enum(
                "inbound",
                "transfer",
                "to_cabinet",
                "from_cabinet",
                "direct_to_cabinet",
                "writeoff",
                "adjustment",
                name="movement_type",
            ),
            nullable=False,
        ),
        sa.Column("equipment_type_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("from_warehouse_id", sa.Integer()),
        sa.Column("to_warehouse_id", sa.Integer()),
        sa.Column("from_cabinet_id", sa.Integer()),
        sa.Column("to_cabinet_id", sa.Integer()),
        sa.Column("reference", sa.String(length=200)),
        sa.Column("comment", sa.String(length=1000)),
        sa.Column("performed_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_equipment_movements_qty_positive"),
        sa.ForeignKeyConstraint(["equipment_type_id"], ["equipment_types.id"]),
        sa.ForeignKeyConstraint(["from_warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["to_warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["from_cabinet_id"], ["cabinets.id"]),
        sa.ForeignKeyConstraint(["to_cabinet_id"], ["cabinets.id"]),
        sa.ForeignKeyConstraint(["performed_by_id"], ["users.id"]),
    )
    op.create_index("ix_equipment_movements_movement_type", "equipment_movements", ["movement_type"], unique=False)
    op.create_index("ix_equipment_movements_equipment_type_id", "equipment_movements", ["equipment_type_id"], unique=False)
    op.create_index("ix_equipment_movements_from_warehouse_id", "equipment_movements", ["from_warehouse_id"], unique=False)
    op.create_index("ix_equipment_movements_to_warehouse_id", "equipment_movements", ["to_warehouse_id"], unique=False)
    op.create_index("ix_equipment_movements_from_cabinet_id", "equipment_movements", ["from_cabinet_id"], unique=False)
    op.create_index("ix_equipment_movements_to_cabinet_id", "equipment_movements", ["to_cabinet_id"], unique=False)
    op.create_index("ix_equipment_movements_performed_by_id", "equipment_movements", ["performed_by_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("entity", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.Integer()),
        sa.Column("before", sa.JSON()),
        sa.Column("after", sa.JSON()),
        sa.Column("meta", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"], unique=False)
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity"], unique=False)
    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"], unique=False)

    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entity", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
    )
    op.create_index("ix_attachments_entity", "attachments", ["entity"], unique=False)
    op.create_index("ix_attachments_entity_id", "attachments", ["entity_id"], unique=False)
    op.create_index("ix_attachments_uploaded_by_id", "attachments", ["uploaded_by_id"], unique=False)


def downgrade():
    op.drop_index("ix_attachments_uploaded_by_id", table_name="attachments")
    op.drop_index("ix_attachments_entity_id", table_name="attachments")
    op.drop_index("ix_attachments_entity", table_name="attachments")
    op.drop_table("attachments")

    op.drop_index("ix_audit_logs_entity_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_equipment_movements_performed_by_id", table_name="equipment_movements")
    op.drop_index("ix_equipment_movements_to_cabinet_id", table_name="equipment_movements")
    op.drop_index("ix_equipment_movements_from_cabinet_id", table_name="equipment_movements")
    op.drop_index("ix_equipment_movements_to_warehouse_id", table_name="equipment_movements")
    op.drop_index("ix_equipment_movements_from_warehouse_id", table_name="equipment_movements")
    op.drop_index("ix_equipment_movements_equipment_type_id", table_name="equipment_movements")
    op.drop_index("ix_equipment_movements_movement_type", table_name="equipment_movements")
    op.drop_table("equipment_movements")

    op.drop_index("ix_io_signals_cabinet_component_id", table_name="io_signals")
    op.drop_table("io_signals")

    op.drop_index("ix_cabinet_items_equipment_type_id", table_name="cabinet_items")
    op.drop_index("ix_cabinet_items_cabinet_id", table_name="cabinet_items")
    op.drop_table("cabinet_items")

    op.drop_index("ix_warehouse_items_equipment_type_id", table_name="warehouse_items")
    op.drop_index("ix_warehouse_items_warehouse_id", table_name="warehouse_items")
    op.drop_table("warehouse_items")

    op.drop_index("ix_cabinets_location_id", table_name="cabinets")
    op.drop_table("cabinets")

    op.drop_index("ix_warehouses_location_id", table_name="warehouses")
    op.drop_table("warehouses")

    op.drop_index("ix_equipment_types_nomenclature_active_unique", table_name="equipment_types")
    op.drop_index("ix_equipment_types_manufacturer_id", table_name="equipment_types")
    op.drop_table("equipment_types")

    op.drop_index("ix_locations_parent_id", table_name="locations")
    op.drop_table("locations")

    op.drop_index("ix_manufacturers_name_active_unique", table_name="manufacturers")
    op.drop_table("manufacturers")

    op.drop_index("ix_user_sessions_session_token_hash", table_name="user_sessions")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")

    op.drop_index("ix_users_username_active_unique", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")

    sa.Enum(name="movement_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="measurement_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="signal_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
