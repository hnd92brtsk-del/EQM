"""add rbac permissions and personnel role

Revision ID: 0041_add_rbac_permissions_and_personnel_role
Revises: 0040_add_role_based_power_attributes
Create Date: 2026-03-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0041_add_rbac_permissions_and_personnel_role"
down_revision = "0040_add_role_based_power_attributes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    personnel_columns = {column["name"] for column in inspector.get_columns("personnel")}
    if "role" not in personnel_columns:
        op.add_column("personnel", sa.Column("role", sa.String(length=200), nullable=True))

    existing_tables = set(inspector.get_table_names())
    if "access_spaces" not in existing_tables:
        op.create_table(
            "access_spaces",
            sa.Column("key", sa.String(length=64), primary_key=True, nullable=False),
            sa.Column("label", sa.String(length=120), nullable=False),
            sa.Column("is_admin_space", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )

    if "role_space_permissions" not in existing_tables:
        op.create_table(
            "role_space_permissions",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("role", sa.String(length=32), nullable=False),
            sa.Column("space_key", sa.String(length=64), sa.ForeignKey("access_spaces.key"), nullable=False),
            sa.Column("can_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("can_write", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("can_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.UniqueConstraint("role", "space_key", name="uq_role_space_permissions_role_space"),
        )
        op.create_index("ix_role_space_permissions_role", "role_space_permissions", ["role"])
        op.create_index("ix_role_space_permissions_space_key", "role_space_permissions", ["space_key"])

    access_space_count = bind.execute(sa.text("SELECT COUNT(*) FROM access_spaces")).scalar_one()
    if access_space_count == 0:
        op.bulk_insert(
            sa.table(
                "access_spaces",
                sa.column("key", sa.String()),
                sa.column("label", sa.String()),
                sa.column("is_admin_space", sa.Boolean()),
            ),
            [
                {"key": "overview", "label": "Overview", "is_admin_space": False},
                {"key": "personnel", "label": "Personnel", "is_admin_space": False},
                {"key": "equipment", "label": "Equipment", "is_admin_space": False},
                {"key": "cabinets", "label": "Cabinets", "is_admin_space": False},
                {"key": "engineering", "label": "Engineering", "is_admin_space": False},
                {"key": "dictionaries", "label": "Dictionaries", "is_admin_space": False},
                {"key": "admin_users", "label": "Admin Users", "is_admin_space": True},
                {"key": "admin_sessions", "label": "Admin Sessions", "is_admin_space": True},
                {"key": "admin_audit", "label": "Admin Audit", "is_admin_space": True},
                {"key": "admin_diagnostics", "label": "Admin Diagnostics", "is_admin_space": True},
            ],
        )

    permission_table = sa.table(
        "role_space_permissions",
        sa.column("role", sa.String()),
        sa.column("space_key", sa.String()),
        sa.column("can_read", sa.Boolean()),
        sa.column("can_write", sa.Boolean()),
        sa.column("can_admin", sa.Boolean()),
    )
    permission_count = bind.execute(sa.text("SELECT COUNT(*) FROM role_space_permissions")).scalar_one()
    if permission_count == 0:
        op.bulk_insert(
            permission_table,
            [
                {"role": "admin", "space_key": "overview", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "admin", "space_key": "personnel", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "admin", "space_key": "equipment", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "admin", "space_key": "cabinets", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "admin", "space_key": "engineering", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "admin", "space_key": "dictionaries", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "admin", "space_key": "admin_users", "can_read": True, "can_write": True, "can_admin": True},
                {"role": "admin", "space_key": "admin_sessions", "can_read": True, "can_write": True, "can_admin": True},
                {"role": "admin", "space_key": "admin_audit", "can_read": True, "can_write": True, "can_admin": True},
                {"role": "admin", "space_key": "admin_diagnostics", "can_read": True, "can_write": True, "can_admin": True},
                {"role": "engineer", "space_key": "overview", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "engineer", "space_key": "personnel", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "engineer", "space_key": "equipment", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "engineer", "space_key": "cabinets", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "engineer", "space_key": "engineering", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "engineer", "space_key": "dictionaries", "can_read": True, "can_write": True, "can_admin": False},
                {"role": "engineer", "space_key": "admin_users", "can_read": False, "can_write": False, "can_admin": False},
                {"role": "engineer", "space_key": "admin_sessions", "can_read": False, "can_write": False, "can_admin": False},
                {"role": "engineer", "space_key": "admin_audit", "can_read": False, "can_write": False, "can_admin": False},
                {"role": "engineer", "space_key": "admin_diagnostics", "can_read": False, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "overview", "can_read": True, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "personnel", "can_read": True, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "equipment", "can_read": True, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "cabinets", "can_read": True, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "engineering", "can_read": True, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "dictionaries", "can_read": True, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "admin_users", "can_read": False, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "admin_sessions", "can_read": False, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "admin_audit", "can_read": False, "can_write": False, "can_admin": False},
                {"role": "viewer", "space_key": "admin_diagnostics", "can_read": False, "can_write": False, "can_admin": False},
            ],
        )


def downgrade() -> None:
    op.drop_index("ix_role_space_permissions_space_key", table_name="role_space_permissions")
    op.drop_index("ix_role_space_permissions_role", table_name="role_space_permissions")
    op.drop_table("role_space_permissions")
    op.drop_table("access_spaces")
    op.drop_column("personnel", "role")
