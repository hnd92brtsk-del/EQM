"""add io_signals v2

Revision ID: 0021_add_io_signals_v2
Revises: 0020_add_equipment_type_media_fields
Create Date: 2026-01-24 22:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0021_add_io_signals_v2"
down_revision = "0020_add_equipment_type_media_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table("io_signals", "io_signals_legacy")
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM pg_class c
            WHERE c.relkind = 'i'
              AND c.relname = 'ix_io_signals_cabinet_component_id'
        ) THEN
            EXECUTE 'ALTER INDEX ix_io_signals_cabinet_component_id RENAME TO ix_io_signals_legacy_cabinet_component_id';
        END IF;
    END $$;
    """)

    op.create_table(
        "io_signals",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("equipment_in_operation_id", sa.Integer(), nullable=False),
        sa.Column(
            "signal_type",
            postgresql.ENUM("AI", "AO", "DI", "DO", name="signal_type", create_type=False),
            nullable=False,
        ),
        sa.Column("channel_index", sa.Integer(), nullable=False),
        sa.Column("tag", sa.String(length=200)),
        sa.Column("signal", sa.String(length=500)),
        sa.Column("signal_kind_id", sa.Integer()),
        sa.Column(
            "measurement_type",
            postgresql.ENUM(
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
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("measurement_unit_id", sa.Integer()),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_id", sa.Integer()),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["equipment_in_operation_id"], ["cabinet_items.id"]),
        sa.ForeignKeyConstraint(["signal_kind_id"], ["signal_types.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["measurement_unit_id"], ["measurement_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_id"], ["users.id"]),
        sa.UniqueConstraint(
            "equipment_in_operation_id",
            "signal_type",
            "channel_index",
            name="uq_io_signals_eio_type_channel",
        ),
    )
    op.create_index(
        "ix_io_signals_equipment_in_operation_id",
        "io_signals",
        ["equipment_in_operation_id"],
        unique=False,
    )
    op.create_index(
        "ix_io_signals_equipment_in_operation_type",
        "io_signals",
        ["equipment_in_operation_id", "signal_type"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_io_signals_equipment_in_operation_type", table_name="io_signals")
    op.drop_index("ix_io_signals_equipment_in_operation_id", table_name="io_signals")
    op.drop_table("io_signals")

    op.rename_table("io_signals_legacy", "io_signals")
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM pg_class c
            WHERE c.relkind = 'i'
              AND c.relname = 'ix_io_signals_legacy_cabinet_component_id'
        ) THEN
            EXECUTE 'ALTER INDEX ix_io_signals_legacy_cabinet_component_id RENAME TO ix_io_signals_cabinet_component_id';
        END IF;
    END $$;
    """)
