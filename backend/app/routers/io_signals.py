from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.io import IOSignal
from app.models.core import MeasurementUnit
from app.models.operations import CabinetItem
from app.models.core import EquipmentType
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.io_signals import IOSignalOut, IOSignalCreate, IOSignalUpdate

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


@router.get("/", response_model=Pagination[IOSignalOut])
def list_signals(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    cabinet_component_id: int | None = None,
    cabinet_id: int | None = None,
    signal_type: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(IOSignal)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(IOSignal.is_deleted == False)
    else:
        query = query.where(IOSignal.is_deleted == is_deleted)
    if cabinet_component_id:
        query = query.where(IOSignal.cabinet_component_id == cabinet_component_id)
    if cabinet_id:
        query = query.join(CabinetItem).where(CabinetItem.cabinet_id == cabinet_id)
    if signal_type:
        query = query.where(IOSignal.signal_type == signal_type)

    query = apply_search(query, q, [IOSignal.tag_name, IOSignal.signal_name, IOSignal.plc_channel_address])
    query = apply_date_filters(query, IOSignal, None, None, None, None)
    query = apply_sort(query, IOSignal, sort)

    total, items = paginate(query, db, page, page_size)
    attach_measurement_unit_full_path(items, db)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{signal_id}", response_model=IOSignalOut)
def get_signal(
    signal_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(IOSignal).where(IOSignal.id == signal_id)
    if not include_deleted:
        query = query.where(IOSignal.is_deleted == False)
    signal = db.scalar(query)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    attach_measurement_unit_full_path([signal], db)
    return signal


@router.post("/", response_model=IOSignalOut)
def create_signal(
    payload: IOSignalCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    cabinet_item = db.scalar(
        select(CabinetItem).where(
            CabinetItem.id == payload.cabinet_component_id,
            CabinetItem.is_deleted == False,
        )
    )
    if not cabinet_item:
        raise HTTPException(status_code=404, detail="Cabinet item not found")

    equipment_type = db.scalar(
        select(EquipmentType).where(EquipmentType.id == cabinet_item.equipment_type_id)
    )
    if not equipment_type or not equipment_type.is_channel_forming:
        raise HTTPException(status_code=400, detail="Equipment type is not channel-forming")

    if payload.measurement_unit_id is not None:
        unit = db.scalar(
            select(MeasurementUnit).where(
                MeasurementUnit.id == payload.measurement_unit_id,
                MeasurementUnit.is_deleted == False,
            )
        )
        if not unit:
            raise HTTPException(status_code=404, detail="Measurement unit not found")

    signal = IOSignal(**payload.model_dump())
    db.add(signal)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="io_signals",
        entity_id=signal.id,
        before=None,
        after=model_to_dict(signal),
    )

    db.commit()
    db.refresh(signal)
    attach_measurement_unit_full_path([signal], db)
    return signal


@router.patch("/{signal_id}", response_model=IOSignalOut)
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


@router.put("/{signal_id}", response_model=IOSignalOut)
def update_signal_legacy(
    signal_id: int,
    payload: IOSignalUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_signal(signal_id, payload, db, current_user)


@router.delete("/{signal_id}")
def delete_signal(
    signal_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    signal = db.scalar(select(IOSignal).where(IOSignal.id == signal_id))
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    before = model_to_dict(signal)
    signal.is_deleted = True
    signal.deleted_at = datetime.utcnow()
    signal.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="io_signals",
        entity_id=signal.id,
        before=before,
        after=model_to_dict(signal),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{signal_id}/restore", response_model=IOSignalOut)
def restore_signal(
    signal_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    signal = db.scalar(select(IOSignal).where(IOSignal.id == signal_id))
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    before = model_to_dict(signal)
    signal.is_deleted = False
    signal.deleted_at = None
    signal.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="io_signals",
        entity_id=signal.id,
        before=before,
        after=model_to_dict(signal),
    )

    db.commit()
    db.refresh(signal)
    attach_measurement_unit_full_path([signal], db)
    return signal
