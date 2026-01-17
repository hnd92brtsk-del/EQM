"""add article and serial ports to equipment types

Revision ID: 0016_add_equipment_type_article_and_serial_ports
Revises: 0014_add_measurement_units_row_version
Create Date: 2026-01-22 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0016_add_equipment_type_article_and_serial_ports"
down_revision = "0014_add_measurement_units_row_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "equipment_types",
        sa.Column("article", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "equipment_types",
        sa.Column("has_serial_interfaces", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "equipment_types",
        sa.Column(
            "serial_ports",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("equipment_types", "serial_ports")
    op.drop_column("equipment_types", "has_serial_interfaces")
    op.drop_column("equipment_types", "article")
