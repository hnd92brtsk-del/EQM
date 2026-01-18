"""add equipment type media fields

Revision ID: 0020_add_equipment_type_media_fields
Revises: 0019_add_assembly_numbers
Create Date: 2026-01-24 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0020_add_equipment_type_media_fields"
down_revision = "0019_add_assembly_numbers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipment_types", sa.Column("photo_filename", sa.String(length=255), nullable=True))
    op.add_column("equipment_types", sa.Column("photo_mime", sa.String(length=100), nullable=True))
    op.add_column("equipment_types", sa.Column("datasheet_filename", sa.String(length=255), nullable=True))
    op.add_column("equipment_types", sa.Column("datasheet_mime", sa.String(length=100), nullable=True))
    op.add_column("equipment_types", sa.Column("datasheet_original_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("equipment_types", "datasheet_original_name")
    op.drop_column("equipment_types", "datasheet_mime")
    op.drop_column("equipment_types", "datasheet_filename")
    op.drop_column("equipment_types", "photo_mime")
    op.drop_column("equipment_types", "photo_filename")
