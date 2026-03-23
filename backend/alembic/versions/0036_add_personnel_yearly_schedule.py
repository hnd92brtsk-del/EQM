"""add personnel yearly schedule

Revision ID: 0036_add_personnel_yearly_schedule
Revises: 0035_add_performance_indexes
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa


revision = "0036_add_personnel_yearly_schedule"
down_revision = "0035_add_performance_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "personnel_schedule_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("number", sa.String(length=50), nullable=True),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_index(
        "ix_personnel_schedule_templates_label_active_unique",
        "personnel_schedule_templates",
        ["label"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )

    op.add_column("personnel", sa.Column("schedule_template_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_personnel_schedule_template_id",
        "personnel",
        "personnel_schedule_templates",
        ["schedule_template_id"],
        ["id"],
    )
    op.create_index("ix_personnel_schedule_template_id", "personnel", ["schedule_template_id"], unique=False)

    op.create_table(
        "personnel_yearly_schedule_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personnel_id", sa.Integer(), sa.ForeignKey("personnel.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_index(
        "ix_personnel_yearly_schedule_assignments_person_date_unique",
        "personnel_yearly_schedule_assignments",
        ["personnel_id", "work_date"],
        unique=True,
    )
    op.create_index(
        op.f("ix_personnel_yearly_schedule_assignments_personnel_id"),
        "personnel_yearly_schedule_assignments",
        ["personnel_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_personnel_yearly_schedule_assignments_work_date"),
        "personnel_yearly_schedule_assignments",
        ["work_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_personnel_yearly_schedule_assignments_year"),
        "personnel_yearly_schedule_assignments",
        ["year"],
        unique=False,
    )

    op.create_table(
        "personnel_yearly_schedule_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personnel_id", sa.Integer(), sa.ForeignKey("personnel.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_index(
        "ix_personnel_yearly_schedule_events_person_date_unique",
        "personnel_yearly_schedule_events",
        ["personnel_id", "work_date"],
        unique=True,
    )
    op.create_index(
        op.f("ix_personnel_yearly_schedule_events_personnel_id"),
        "personnel_yearly_schedule_events",
        ["personnel_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_personnel_yearly_schedule_events_work_date"),
        "personnel_yearly_schedule_events",
        ["work_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_personnel_yearly_schedule_events_year"),
        "personnel_yearly_schedule_events",
        ["year"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_personnel_yearly_schedule_events_year"), table_name="personnel_yearly_schedule_events")
    op.drop_index(op.f("ix_personnel_yearly_schedule_events_work_date"), table_name="personnel_yearly_schedule_events")
    op.drop_index(op.f("ix_personnel_yearly_schedule_events_personnel_id"), table_name="personnel_yearly_schedule_events")
    op.drop_index("ix_personnel_yearly_schedule_events_person_date_unique", table_name="personnel_yearly_schedule_events")
    op.drop_table("personnel_yearly_schedule_events")

    op.drop_index(op.f("ix_personnel_yearly_schedule_assignments_year"), table_name="personnel_yearly_schedule_assignments")
    op.drop_index(op.f("ix_personnel_yearly_schedule_assignments_work_date"), table_name="personnel_yearly_schedule_assignments")
    op.drop_index(op.f("ix_personnel_yearly_schedule_assignments_personnel_id"), table_name="personnel_yearly_schedule_assignments")
    op.drop_index(
        "ix_personnel_yearly_schedule_assignments_person_date_unique",
        table_name="personnel_yearly_schedule_assignments",
    )
    op.drop_table("personnel_yearly_schedule_assignments")

    op.drop_index("ix_personnel_schedule_template_id", table_name="personnel")
    op.drop_constraint("fk_personnel_schedule_template_id", "personnel", type_="foreignkey")
    op.drop_column("personnel", "schedule_template_id")

    op.drop_index("ix_personnel_schedule_templates_label_active_unique", table_name="personnel_schedule_templates")
    op.drop_table("personnel_schedule_templates")
