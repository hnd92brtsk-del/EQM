"""add dynamic roles catalog

Revision ID: 0042_add_dynamic_roles_catalog
Revises: 0041_add_rbac_permissions_and_personnel_role
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa


revision = "0042_add_dynamic_roles_catalog"
down_revision = "0041_add_rbac_permissions_and_personnel_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "role_definitions" not in existing_tables:
        op.create_table(
            "role_definitions",
            sa.Column("key", sa.String(length=64), primary_key=True, nullable=False),
            sa.Column("label", sa.String(length=120), nullable=False),
            sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )

    role_count = bind.execute(sa.text("SELECT COUNT(*) FROM role_definitions")).scalar_one()
    if role_count == 0:
        op.bulk_insert(
            sa.table(
                "role_definitions",
                sa.column("key", sa.String()),
                sa.column("label", sa.String()),
                sa.column("is_system", sa.Boolean()),
            ),
            [
                {"key": "admin", "label": "Administrator", "is_system": True},
                {"key": "engineer", "label": "Engineer", "is_system": True},
                {"key": "viewer", "label": "Viewer", "is_system": True},
            ],
        )

    user_foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("users")}
    permission_foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("role_space_permissions")}

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(64) USING role::text")
    else:
        op.alter_column("users", "role", existing_type=sa.String(length=32), type_=sa.String(length=64))

    op.alter_column("role_space_permissions", "role", existing_type=sa.String(length=32), type_=sa.String(length=64))

    if "users_role_fkey" not in user_foreign_keys:
        op.create_foreign_key("users_role_fkey", "users", "role_definitions", ["role"], ["key"])
    if "role_space_permissions_role_fkey" not in permission_foreign_keys:
        op.create_foreign_key(
            "role_space_permissions_role_fkey",
            "role_space_permissions",
            "role_definitions",
            ["role"],
            ["key"],
        )

    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS user_role")


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_constraint("role_space_permissions_role_fkey", "role_space_permissions", type_="foreignkey")
    op.drop_constraint("users_role_fkey", "users", type_="foreignkey")
    op.drop_table("role_definitions")

    if bind.dialect.name == "postgresql":
        op.execute("CREATE TYPE user_role AS ENUM ('admin', 'engineer', 'viewer')")
        op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role")
    else:
        op.alter_column("users", "role", existing_type=sa.String(length=64), type_=sa.String(length=32))

    op.alter_column("role_space_permissions", "role", existing_type=sa.String(length=64), type_=sa.String(length=32))
