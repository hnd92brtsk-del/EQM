"""create pid processes table

Revision ID: 0026_create_pid_process
Revises: 0025_add_data_types_dictionary
Create Date: 2026-02-26 18:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0026_create_pid_process"
down_revision = "0025_add_data_types_dictionary"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pid_processes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index("ix_pid_processes_location_id", "pid_processes", ["location_id"], unique=False)
    op.create_index(
        "ix_pid_processes_location_name_active_unique",
        "pid_processes",
        ["location_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade():
    op.drop_index("ix_pid_processes_location_name_active_unique", table_name="pid_processes")
    op.drop_index("ix_pid_processes_location_id", table_name="pid_processes")
    op.drop_table("pid_processes")
