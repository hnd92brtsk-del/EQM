"""add personnel tables

Revision ID: 0007_add_personnel_tables
Revises: 0006_add_measurement_types
Create Date: 2026-01-06 10:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_add_personnel_tables"
down_revision = "0006_add_measurement_types"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "personnel",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("middle_name", sa.String(length=100)),
        sa.Column("position", sa.String(length=200), nullable=False),
        sa.Column("personnel_number", sa.String(length=50)),
        sa.Column("service", sa.String(length=200)),
        sa.Column("shop", sa.String(length=200)),
        sa.Column("department", sa.String(length=200)),
        sa.Column("division", sa.String(length=200)),
        sa.Column("birth_date", sa.Date()),
        sa.Column("hire_date", sa.Date()),
        sa.Column("organisation", sa.String(length=200)),
        sa.Column("email", sa.String(length=200)),
        sa.Column("phone", sa.String(length=50)),
        sa.Column("notes", sa.Text()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index("ix_personnel_user_id", "personnel", ["user_id"], unique=False)
    op.create_index(
        "ix_personnel_personnel_number_active_unique",
        "personnel",
        ["personnel_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.create_table(
        "personnel_competencies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("personnel_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("organisation", sa.String(length=200)),
        sa.Column("city", sa.String(length=200)),
        sa.Column("completion_date", sa.Date()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["personnel_id"], ["personnel.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index(
        "ix_personnel_competencies_personnel_id",
        "personnel_competencies",
        ["personnel_id"],
        unique=False,
    )

    op.create_table(
        "personnel_trainings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("personnel_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("completion_date", sa.Date()),
        sa.Column("next_due_date", sa.Date()),
        sa.Column("reminder_offset_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["personnel_id"], ["personnel.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index(
        "ix_personnel_trainings_personnel_id",
        "personnel_trainings",
        ["personnel_id"],
        unique=False,
    )
    op.create_index(
        "ix_personnel_trainings_next_due_date",
        "personnel_trainings",
        ["next_due_date"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_personnel_trainings_next_due_date", table_name="personnel_trainings")
    op.drop_index("ix_personnel_trainings_personnel_id", table_name="personnel_trainings")
    op.drop_table("personnel_trainings")

    op.drop_index("ix_personnel_competencies_personnel_id", table_name="personnel_competencies")
    op.drop_table("personnel_competencies")

    op.drop_index("ix_personnel_personnel_number_active_unique", table_name="personnel")
    op.drop_index("ix_personnel_user_id", table_name="personnel")
    op.drop_table("personnel")
