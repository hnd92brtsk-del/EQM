from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.operations import CabinetItem
from app.models.io import IOSignal, SignalType


def ensure_io_signals_for_equipment_in_operation(
    db, equipment_in_operation_id: int, prune: bool = False
) -> dict:
    item = db.scalar(
        select(CabinetItem)
        .options(selectinload(CabinetItem.equipment_type))
        .where(CabinetItem.id == equipment_in_operation_id)
    )
    if not item or item.is_deleted:
        raise ValueError("Equipment in operation not found")

    equipment = item.equipment_type
    if not equipment or not equipment.is_channel_forming:
        raise ValueError("Equipment type is not channel-forming")

    counts = {
        SignalType.AI: equipment.ai_count,
        SignalType.DI: equipment.di_count,
        SignalType.AO: equipment.ao_count,
        SignalType.DO: equipment.do_count,
    }

    existing = db.scalars(
        select(IOSignal).where(IOSignal.equipment_in_operation_id == equipment_in_operation_id)
    ).all()
    existing_map = {(signal.signal_type, signal.channel_index): signal for signal in existing}

    created = 0
    restored = 0
    pruned = 0

    for signal_type, count in counts.items():
        for index in range(1, count + 1):
            key = (signal_type, index)
            signal = existing_map.get(key)
            if signal:
                if signal.is_deleted:
                    signal.is_deleted = False
                    signal.deleted_at = None
                    signal.deleted_by_id = None
                    restored += 1
            else:
                db.add(
                    IOSignal(
                        equipment_in_operation_id=equipment_in_operation_id,
                        signal_type=signal_type,
                        channel_index=index,
                    )
                )
                created += 1

        if prune:
            for signal in existing:
                if (
                    signal.signal_type == signal_type
                    and signal.channel_index > count
                    and not signal.is_deleted
                ):
                    signal.is_deleted = True
                    signal.deleted_at = datetime.utcnow()
                    signal.deleted_by_id = None
                    pruned += 1

    return {"created": created, "restored": restored, "pruned": pruned}
