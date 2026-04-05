"""add cabinet media fields

Revision ID: 0044_add_cabinet_media_fields
Revises: 0043_add_io_signal_plc_range_fields
Create Date: 2026-04-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0044_add_cabinet_media_fields"
down_revision = "0043_add_io_signal_plc_range_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cabinets", sa.Column("photo_filename", sa.String(length=255), nullable=True))
    op.add_column("cabinets", sa.Column("photo_mime", sa.String(length=100), nullable=True))
    op.add_column("cabinets", sa.Column("datasheet_filename", sa.String(length=255), nullable=True))
    op.add_column("cabinets", sa.Column("datasheet_mime", sa.String(length=100), nullable=True))
    op.add_column("cabinets", sa.Column("datasheet_original_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("cabinets", "datasheet_original_name")
    op.drop_column("cabinets", "datasheet_mime")
    op.drop_column("cabinets", "datasheet_filename")
    op.drop_column("cabinets", "photo_mime")
    op.drop_column("cabinets", "photo_filename")
