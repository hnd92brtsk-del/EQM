"""add cabinet fields and files table

Revision ID: 0012_add_cabinet_fields_and_files
Revises: 0011_add_assembly_movements
Create Date: 2026-01-22 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_add_cabinet_fields_and_files"
down_revision = "0011_add_assembly_movements"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("cabinets", sa.Column("factory_number", sa.String(length=100), nullable=True))
    op.add_column("cabinets", sa.Column("nomenclature_number", sa.String(length=100), nullable=True))

    op.create_table(
        "cabinet_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cabinet_id", sa.Integer(), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("stored_name", sa.String(length=255), nullable=False),
        sa.Column("ext", sa.String(length=20), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("mime", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
    )
    op.create_index("ix_cabinet_files_cabinet_id", "cabinet_files", ["cabinet_id"], unique=False)
    op.create_index("ix_cabinet_files_created_by_id", "cabinet_files", ["created_by_id"], unique=False)
    op.create_index("ix_cabinet_files_is_deleted", "cabinet_files", ["is_deleted"], unique=False)


def downgrade():
    op.drop_index("ix_cabinet_files_is_deleted", table_name="cabinet_files")
    op.drop_index("ix_cabinet_files_created_by_id", table_name="cabinet_files")
    op.drop_index("ix_cabinet_files_cabinet_id", table_name="cabinet_files")
    op.drop_table("cabinet_files")

    op.drop_column("cabinets", "nomenclature_number")
    op.drop_column("cabinets", "factory_number")
