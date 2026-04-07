from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.access import SpaceKey, require_space_access
from app.core.dependencies import get_db
from app.core.pagination import paginate
from app.core.query import apply_sort
from app.models.core import Cabinet
from app.models.maintenance import MntOperatingTime
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.maintenance import OperatingTimeCreate, OperatingTimeOut, OperatingTimeUpdate

router = APIRouter()

_read = require_space_access(SpaceKey.maintenance, "read")
_write = require_space_access(SpaceKey.maintenance, "write")


@router.get("/", response_model=Pagination[OperatingTimeOut])
def list_operating_time(
    page: int = 1,
    page_size: int = 50,
    sort: str | None = None,
    cabinet_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db=Depends(get_db),
    user: User = Depends(_read),
):
    query = select(MntOperatingTime).options(joinedload(MntOperatingTime.cabinet))
    if cabinet_id is not None:
        query = query.where(MntOperatingTime.cabinet_id == cabinet_id)
    if date_from:
        query = query.where(MntOperatingTime.recorded_date >= date_from)
    if date_to:
        query = query.where(MntOperatingTime.recorded_date <= date_to)
    query = apply_sort(query, MntOperatingTime, sort) if sort else query.order_by(MntOperatingTime.recorded_date.desc())

    total, items = paginate(query, db, page, page_size)
    for item in items:
        item.cabinet_name = item.cabinet.name if item.cabinet else None
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=OperatingTimeOut)
def create_operating_time(payload: OperatingTimeCreate, db=Depends(get_db), user: User = Depends(_write)):
    cab = db.scalar(select(Cabinet).where(Cabinet.id == payload.cabinet_id, Cabinet.is_deleted == False))
    if not cab:
        raise HTTPException(status_code=404, detail="Cabinet not found")

    existing = db.scalar(
        select(MntOperatingTime).where(
            MntOperatingTime.cabinet_id == payload.cabinet_id,
            MntOperatingTime.recorded_date == payload.recorded_date,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Record already exists for this cabinet and date")

    rec = MntOperatingTime(
        cabinet_id=payload.cabinet_id,
        recorded_date=payload.recorded_date,
        operating_hours=payload.operating_hours,
        standby_hours=payload.standby_hours,
        downtime_hours=payload.downtime_hours,
        notes=payload.notes,
        recorded_by_id=user.id,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    rec.cabinet_name = cab.name
    return rec


@router.patch("/{record_id}", response_model=OperatingTimeOut)
def update_operating_time(record_id: int, payload: OperatingTimeUpdate, db=Depends(get_db), user: User = Depends(_write)):
    rec = db.scalar(select(MntOperatingTime).options(joinedload(MntOperatingTime.cabinet)).where(MntOperatingTime.id == record_id))
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rec, k, v)
    db.commit()
    db.refresh(rec)
    rec.cabinet_name = rec.cabinet.name if rec.cabinet else None
    return rec


@router.delete("/{record_id}")
def delete_operating_time(record_id: int, db=Depends(get_db), user: User = Depends(_write)):
    rec = db.scalar(select(MntOperatingTime).where(MntOperatingTime.id == record_id))
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(rec)
    db.commit()
    return {"status": "ok"}
