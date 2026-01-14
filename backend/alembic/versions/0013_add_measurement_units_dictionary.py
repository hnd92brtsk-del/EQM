"""add measurement units dictionary

Revision ID: 0013_add_measurement_units_dictionary
Revises: 0012_add_cabinet_fields_and_files
Create Date: 2026-01-22 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_add_measurement_units_dictionary"
down_revision = "0012_add_cabinet_fields_and_files"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "measurement_units",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["parent_id"], ["measurement_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index("ix_measurement_units_parent_id", "measurement_units", ["parent_id"], unique=False)
    op.create_index(
        "ix_measurement_units_parent_name_active_unique",
        "measurement_units",
        ["parent_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.add_column("io_signals", sa.Column("measurement_unit_id", sa.Integer(), nullable=True))
    op.create_index("ix_io_signals_measurement_unit_id", "io_signals", ["measurement_unit_id"], unique=False)
    op.create_foreign_key(
        "fk_io_signals_measurement_unit_id_measurement_units",
        "io_signals",
        "measurement_units",
        ["measurement_unit_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint(
        "fk_io_signals_measurement_unit_id_measurement_units",
        "io_signals",
        type_="foreignkey",
    )
    op.drop_index("ix_io_signals_measurement_unit_id", table_name="io_signals")
    op.drop_column("io_signals", "measurement_unit_id")

    op.drop_index("ix_measurement_units_parent_name_active_unique", table_name="measurement_units")
    op.drop_index("ix_measurement_units_parent_id", table_name="measurement_units")
    op.drop_table("measurement_units")
