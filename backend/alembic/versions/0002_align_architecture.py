"""align architecture jsonb and constraints

Revision ID: 0002_align_architecture
Revises: 0001_initial
Create Date: 2025-12-20 22:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_align_architecture"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "equipment_types",
        "meta_data",
        type_=postgresql.JSONB(),
        postgresql_using="meta_data::jsonb",
    )
    op.alter_column(
        "warehouses",
        "meta_data",
        type_=postgresql.JSONB(),
        postgresql_using="meta_data::jsonb",
    )
    op.alter_column(
        "cabinets",
        "meta_data",
        type_=postgresql.JSONB(),
        postgresql_using="meta_data::jsonb",
    )
    op.alter_column(
        "audit_logs",
        "before",
        type_=postgresql.JSONB(),
        postgresql_using="before::jsonb",
    )
    op.alter_column(
        "audit_logs",
        "after",
        type_=postgresql.JSONB(),
        postgresql_using="after::jsonb",
    )
    op.alter_column(
        "audit_logs",
        "meta",
        type_=postgresql.JSONB(),
        postgresql_using="meta::jsonb",
    )

    op.drop_index("ix_users_username", table_name="users")
    op.create_index("ix_users_username", "users", ["username"], unique=False)

    op.create_foreign_key(
        "fk_users_deleted_by_id_users", "users", "users", ["deleted_by_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_manufacturers_deleted_by_id_users",
        "manufacturers",
        "users",
        ["deleted_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_locations_deleted_by_id_users",
        "locations",
        "users",
        ["deleted_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_equipment_types_deleted_by_id_users",
        "equipment_types",
        "users",
        ["deleted_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_warehouses_deleted_by_id_users",
        "warehouses",
        "users",
        ["deleted_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_cabinets_deleted_by_id_users",
        "cabinets",
        "users",
        ["deleted_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_warehouse_items_deleted_by_id_users",
        "warehouse_items",
        "users",
        ["deleted_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_cabinet_items_deleted_by_id_users",
        "cabinet_items",
        "users",
        ["deleted_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_io_signals_deleted_by_id_users",
        "io_signals",
        "users",
        ["deleted_by_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_attachments_deleted_by_id_users",
        "attachments",
        "users",
        ["deleted_by_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint("fk_attachments_deleted_by_id_users", "attachments", type_="foreignkey")
    op.drop_constraint("fk_io_signals_deleted_by_id_users", "io_signals", type_="foreignkey")
    op.drop_constraint("fk_cabinet_items_deleted_by_id_users", "cabinet_items", type_="foreignkey")
    op.drop_constraint("fk_warehouse_items_deleted_by_id_users", "warehouse_items", type_="foreignkey")
    op.drop_constraint("fk_cabinets_deleted_by_id_users", "cabinets", type_="foreignkey")
    op.drop_constraint("fk_warehouses_deleted_by_id_users", "warehouses", type_="foreignkey")
    op.drop_constraint("fk_equipment_types_deleted_by_id_users", "equipment_types", type_="foreignkey")
    op.drop_constraint("fk_locations_deleted_by_id_users", "locations", type_="foreignkey")
    op.drop_constraint("fk_manufacturers_deleted_by_id_users", "manufacturers", type_="foreignkey")
    op.drop_constraint("fk_users_deleted_by_id_users", "users", type_="foreignkey")

    op.drop_index("ix_users_username", table_name="users")
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.alter_column(
        "audit_logs",
        "meta",
        type_=sa.JSON(),
        postgresql_using="meta::json",
    )
    op.alter_column(
        "audit_logs",
        "after",
        type_=sa.JSON(),
        postgresql_using="after::json",
    )
    op.alter_column(
        "audit_logs",
        "before",
        type_=sa.JSON(),
        postgresql_using="before::json",
    )
    op.alter_column(
        "cabinets",
        "meta_data",
        type_=sa.JSON(),
        postgresql_using="meta_data::json",
    )
    op.alter_column(
        "warehouses",
        "meta_data",
        type_=sa.JSON(),
        postgresql_using="meta_data::json",
    )
    op.alter_column(
        "equipment_types",
        "meta_data",
        type_=sa.JSON(),
        postgresql_using="meta_data::json",
    )
