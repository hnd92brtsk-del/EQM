from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles, get_current_user
from app.core.pagination import paginate
from app.core.audit import add_audit_log, model_to_dict
from app.models.io import IOSignal
from app.models.operations import CabinetItem
from app.models.core import EquipmentType
from app.models.security import User, UserRole
from app.schemas.common import Pagination
from app.schemas.io_signals import IOSignalOut, IOSignalCreate, IOSignalUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[IOSignalOut])
def list_signals(
    page: int = 1,
    page_size: int = 50,
    cabinet_component_id: int | None = None,
    cabinet_id: int | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(IOSignal)
    if not include_deleted:
        query = query.where(IOSignal.is_deleted == False)
    if cabinet_component_id:
        query = query.where(IOSignal.cabinet_component_id == cabinet_component_id)
    if cabinet_id:
        query = query.join(CabinetItem).where(CabinetItem.cabinet_id == cabinet_id)

    total, items = paginate(query.order_by(IOSignal.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=IOSignalOut)
def create_signal(
    payload: IOSignalCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
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
    return signal


@router.put("/{signal_id}", response_model=IOSignalOut)
def update_signal(
    signal_id: int,
    payload: IOSignalUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin, UserRole.engineer])),
):
    signal = db.scalar(select(IOSignal).where(IOSignal.id == signal_id))
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    before = model_to_dict(signal)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(signal, field, value)

    if payload.is_deleted is not None:
        signal.is_deleted = payload.is_deleted
        signal.deleted_at = datetime.utcnow() if payload.is_deleted else None
        signal.deleted_by_id = current_user.id if payload.is_deleted else None

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
    return signal
