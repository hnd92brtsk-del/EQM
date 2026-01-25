from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, case

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.audit import add_audit_log, model_to_dict
from app.models.io import IOSignal, SignalType
from app.models.core import MeasurementUnit, SignalTypeDictionary
from app.models.operations import CabinetItem
from app.models.security import User
from app.schemas.io_signals import IOSignalOut, IOSignalUpdate
from app.services.io_signals import ensure_io_signals_for_equipment_in_operation

router = APIRouter()


def build_measurement_unit_full_path(
    unit_id: int | None, units_map: dict[int, MeasurementUnit]
) -> str | None:
    if not unit_id or unit_id not in units_map:
        return None
    parts: list[str] = []
    current_id: int | None = unit_id
    seen: set[int] = set()
    while current_id and current_id in units_map and current_id not in seen:
        unit = units_map[current_id]
        parts.append(unit.name)
        seen.add(current_id)
        current_id = unit.parent_id
    return " / ".join(reversed(parts))


def attach_measurement_unit_full_path(items: list[IOSignal], db) -> None:
    units = db.scalars(select(MeasurementUnit)).all()
    units_map = {unit.id: unit for unit in units}
    for item in items:
        item.measurement_unit_full_path = build_measurement_unit_full_path(
            item.measurement_unit_id, units_map
        )


@router.post("/rebuild")
def rebuild_signals(
    equipment_in_operation_id: int = Query(..., ge=1),
    prune: bool = False,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    try:
        result = ensure_io_signals_for_equipment_in_operation(
            db, equipment_in_operation_id, prune=prune
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    return {"status": "ok", **result}


@router.get("/", response_model=list[IOSignalOut])
def list_signals(
    equipment_in_operation_id: int = Query(..., ge=1),
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    item = db.scalar(
        select(CabinetItem).where(CabinetItem.id == equipment_in_operation_id, CabinetItem.is_deleted == False)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Equipment in operation not found")

    ordering = case(
        (IOSignal.signal_type == SignalType.AI, 1),
        (IOSignal.signal_type == SignalType.DI, 2),
        (IOSignal.signal_type == SignalType.AO, 3),
        (IOSignal.signal_type == SignalType.DO, 4),
        else_=5,
    )
    query = select(IOSignal).where(IOSignal.equipment_in_operation_id == equipment_in_operation_id)
    if not include_deleted:
        query = query.where(IOSignal.is_deleted == False)
    query = query.order_by(ordering, IOSignal.channel_index)
    items = db.scalars(query).all()
    attach_measurement_unit_full_path(items, db)
    return items


@router.put("/{signal_id}", response_model=IOSignalOut)
def update_signal(
    signal_id: int,
    payload: IOSignalUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    signal = db.scalar(select(IOSignal).where(IOSignal.id == signal_id))
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    before = model_to_dict(signal)
    data = payload.model_dump(exclude_unset=True)

    if "measurement_unit_id" in data and data["measurement_unit_id"] is not None:
        unit = db.scalar(
            select(MeasurementUnit).where(
                MeasurementUnit.id == data["measurement_unit_id"],
                MeasurementUnit.is_deleted == False,
            )
        )
        if not unit:
            raise HTTPException(status_code=404, detail="Measurement unit not found")

    if "signal_kind_id" in data and data["signal_kind_id"] is not None:
        signal_kind = db.scalar(
            select(SignalTypeDictionary).where(
                SignalTypeDictionary.id == data["signal_kind_id"],
                SignalTypeDictionary.is_deleted == False,
            )
        )
        if not signal_kind:
            raise HTTPException(status_code=404, detail="Signal type not found")
        child = db.scalar(
            select(SignalTypeDictionary.id).where(
                SignalTypeDictionary.parent_id == data["signal_kind_id"],
                SignalTypeDictionary.is_deleted == False,
            )
        )
        if child:
            raise HTTPException(status_code=400, detail="Signal type must be a leaf")

    for field, value in data.items():
        setattr(signal, field, value)

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="io_signals",
        entity_id=signal.id,
        before=before,
        after=model_to_dict(signal),
    )

    db.commit()
    db.refresh(signal)
    attach_measurement_unit_full_path([signal], db)
    return signal


@router.patch("/{signal_id}", response_model=IOSignalOut)
def update_signal_legacy(
    signal_id: int,
    payload: IOSignalUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_signal(signal_id, payload, db, current_user)
