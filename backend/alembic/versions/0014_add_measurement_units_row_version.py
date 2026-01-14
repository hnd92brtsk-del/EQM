"""add row_version to measurement units

Revision ID: 0014_add_measurement_units_row_version
Revises: 0013_add_measurement_units_dictionary
Create Date: 2026-01-22 12:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0014_add_measurement_units_row_version"
down_revision = "0013_add_measurement_units_dictionary"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "measurement_units",
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
    )


def downgrade():
    op.drop_column("measurement_units", "row_version")
