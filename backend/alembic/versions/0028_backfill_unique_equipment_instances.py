"""backfill unique equipment instances

Revision ID: 0028_backfill_unique_equipment_instances
Revises: 0027_split_unique_equipment_items
Create Date: 2026-03-14 20:05:00.000000
"""

from collections import defaultdict

from alembic import op
import sqlalchemy as sa


revision = "0028_backfill_unique_equipment_instances"
down_revision = "0027_split_unique_equipment_items"
branch_labels = None
depends_on = None


equipment_types = sa.table(
    "equipment_types",
    sa.column("id", sa.Integer),
    sa.column("is_channel_forming", sa.Boolean),
    sa.column("ai_count", sa.Integer),
    sa.column("di_count", sa.Integer),
    sa.column("ao_count", sa.Integer),
    sa.column("do_count", sa.Integer),
    sa.column("is_network", sa.Boolean),
    sa.column("has_serial_interfaces", sa.Boolean),
)

cabinet_items = sa.table(
    "cabinet_items",
    sa.column("id", sa.Integer),
    sa.column("cabinet_id", sa.Integer),
    sa.column("equipment_type_id", sa.Integer),
    sa.column("quantity", sa.Integer),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
    sa.column("is_deleted", sa.Boolean),
    sa.column("deleted_at", sa.DateTime(timezone=True)),
    sa.column("deleted_by_id", sa.Integer),
    sa.column("row_version", sa.Integer),
)

assembly_items = sa.table(
    "assembly_items",
    sa.column("id", sa.Integer),
    sa.column("assembly_id", sa.Integer),
    sa.column("equipment_type_id", sa.Integer),
    sa.column("quantity", sa.Integer),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
    sa.column("is_deleted", sa.Boolean),
    sa.column("deleted_at", sa.DateTime(timezone=True)),
    sa.column("deleted_by_id", sa.Integer),
    sa.column("row_version", sa.Integer),
)

io_signals = sa.table(
    "io_signals",
    sa.column("id", sa.Integer),
    sa.column("equipment_in_operation_id", sa.Integer),
    sa.column("signal_type", sa.String),
    sa.column("channel_index", sa.Integer),
    sa.column("tag", sa.String),
    sa.column("signal", sa.String),
    sa.column("signal_kind_id", sa.Integer),
    sa.column("measurement_type", sa.String),
    sa.column("measurement_unit_id", sa.Integer),
    sa.column("is_active", sa.Boolean),
    sa.column("is_deleted", sa.Boolean),
    sa.column("deleted_at", sa.DateTime(timezone=True)),
    sa.column("deleted_by_id", sa.Integer),
    sa.column("row_version", sa.Integer),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def _unique_equipment_map(connection):
    rows = connection.execute(
        sa.select(
            equipment_types.c.id,
            equipment_types.c.is_channel_forming,
            equipment_types.c.ai_count,
            equipment_types.c.di_count,
            equipment_types.c.ao_count,
            equipment_types.c.do_count,
        ).where(
            sa.or_(
                equipment_types.c.is_channel_forming == sa.true(),
                equipment_types.c.is_network == sa.true(),
                equipment_types.c.has_serial_interfaces == sa.true(),
            )
        )
    ).mappings().all()
    return {row["id"]: row for row in rows}


def _signal_type_rows(equipment_row):
    return [
        ("AI", equipment_row["ai_count"] or 0),
        ("DI", equipment_row["di_count"] or 0),
        ("AO", equipment_row["ao_count"] or 0),
        ("DO", equipment_row["do_count"] or 0),
    ]


def _create_io_signals_for_item(connection, item_id: int, equipment_row):
    if not equipment_row["is_channel_forming"]:
        return
    payload = []
    for signal_type, count in _signal_type_rows(equipment_row):
        for channel_index in range(1, count + 1):
            payload.append(
                {
                    "equipment_in_operation_id": item_id,
                    "signal_type": signal_type,
                    "channel_index": channel_index,
                    "tag": None,
                    "signal": None,
                    "signal_kind_id": None,
                    "measurement_type": None,
                    "measurement_unit_id": None,
                    "is_active": True,
                    "is_deleted": False,
                    "deleted_at": None,
                    "deleted_by_id": None,
                    "row_version": 1,
                }
            )
    if payload:
        connection.execute(sa.insert(io_signals), payload)


def _split_cabinet_items(connection, unique_equipment):
    rows = connection.execute(
        sa.select(cabinet_items).where(
            cabinet_items.c.quantity > 1,
            cabinet_items.c.equipment_type_id.in_(list(unique_equipment.keys())),
        )
    ).mappings().all()
    if not rows:
        return

    signal_counts = defaultdict(int)
    io_rows = connection.execute(
        sa.select(io_signals.c.equipment_in_operation_id, sa.func.count(io_signals.c.id)).group_by(
            io_signals.c.equipment_in_operation_id
        )
    ).all()
    for item_id, count in io_rows:
        signal_counts[item_id] = count

    for row in rows:
        equipment_row = unique_equipment[row["equipment_type_id"]]
        connection.execute(
            sa.update(cabinet_items)
            .where(cabinet_items.c.id == row["id"])
            .values(quantity=1)
        )
        if equipment_row["is_channel_forming"] and signal_counts.get(row["id"], 0) == 0:
            _create_io_signals_for_item(connection, row["id"], equipment_row)

        for _ in range(row["quantity"] - 1):
            new_item_id = connection.execute(
                sa.insert(cabinet_items)
                .values(
                    cabinet_id=row["cabinet_id"],
                    equipment_type_id=row["equipment_type_id"],
                    quantity=1,
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                    is_deleted=row["is_deleted"],
                    deleted_at=row["deleted_at"],
                    deleted_by_id=row["deleted_by_id"],
                    row_version=row["row_version"],
                )
                .returning(cabinet_items.c.id)
            ).scalar_one()
            _create_io_signals_for_item(connection, new_item_id, equipment_row)


def _split_assembly_items(connection, unique_equipment):
    rows = connection.execute(
        sa.select(assembly_items).where(
            assembly_items.c.quantity > 1,
            assembly_items.c.equipment_type_id.in_(list(unique_equipment.keys())),
        )
    ).mappings().all()
    for row in rows:
        connection.execute(
            sa.update(assembly_items)
            .where(assembly_items.c.id == row["id"])
            .values(quantity=1)
        )
        for _ in range(row["quantity"] - 1):
            connection.execute(
                sa.insert(assembly_items).values(
                    assembly_id=row["assembly_id"],
                    equipment_type_id=row["equipment_type_id"],
                    quantity=1,
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                    is_deleted=row["is_deleted"],
                    deleted_at=row["deleted_at"],
                    deleted_by_id=row["deleted_by_id"],
                    row_version=row["row_version"],
                )
            )


def upgrade():
    connection = op.get_bind()
    unique_equipment = _unique_equipment_map(connection)
    if not unique_equipment:
        return
    _split_cabinet_items(connection, unique_equipment)
    _split_assembly_items(connection, unique_equipment)


def downgrade():
    pass
