"""update io_signals data type and equipment fields

Revision ID: 0029_update_io_signals_data_type_fields
Revises: 0028_backfill_unique_equipment_instances
Create Date: 2026-03-15 14:20:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0029_update_io_signals_data_type_fields"
down_revision = "0028_backfill_unique_equipment_instances"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("io_signals", sa.Column("data_type_id", sa.Integer(), nullable=True))
    op.add_column("io_signals", sa.Column("field_equipment_id", sa.Integer(), nullable=True))
    op.add_column("io_signals", sa.Column("connection_point", sa.String(length=255), nullable=True))

    op.create_index("ix_io_signals_data_type_id", "io_signals", ["data_type_id"], unique=False)
    op.create_index(
        "ix_io_signals_field_equipment_id", "io_signals", ["field_equipment_id"], unique=False
    )
    op.create_foreign_key(
        "fk_io_signals_data_type_id",
        "io_signals",
        "data_types",
        ["data_type_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_io_signals_field_equipment_id",
        "io_signals",
        "field_equipments",
        ["field_equipment_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_column("io_signals", "measurement_type")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                WHERE t.typname = 'measurement_type'
            ) AND NOT EXISTS (
                SELECT 1
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_type t ON t.oid = a.atttypid
                WHERE t.typname = 'measurement_type'
                  AND a.attnum > 0
                  AND NOT a.attisdropped
            ) THEN
                DROP TYPE measurement_type;
            END IF;
        END $$;
        """
    )


def downgrade():
    measurement_type = postgresql.ENUM(
        "4-20mA (AI)",
        "0-20mA (AI)",
        "0-10V (AI)",
        "Pt100 (RTD AI)",
        "Pt1000 (RTD AI)",
        "M50 (RTD AI)",
        "24V (DI)",
        "220V (DI)",
        "8-16mA (DI)",
        name="measurement_type",
    )
    measurement_type.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "io_signals",
        sa.Column("measurement_type", measurement_type, nullable=True),
    )

    op.drop_constraint("fk_io_signals_field_equipment_id", "io_signals", type_="foreignkey")
    op.drop_constraint("fk_io_signals_data_type_id", "io_signals", type_="foreignkey")
    op.drop_index("ix_io_signals_field_equipment_id", table_name="io_signals")
    op.drop_index("ix_io_signals_data_type_id", table_name="io_signals")
    op.drop_column("io_signals", "connection_point")
    op.drop_column("io_signals", "field_equipment_id")
    op.drop_column("io_signals", "data_type_id")
