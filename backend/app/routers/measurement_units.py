from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import MeasurementUnit
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.measurement_units import (
    MeasurementUnitOut,
    MeasurementUnitCreate,
    MeasurementUnitUpdate,
    MeasurementUnitTreeNode,
)

router = APIRouter()


def build_tree(units):
    nodes = {unit.id: MeasurementUnitTreeNode(id=unit.id, name=unit.name, children=[]) for unit in units}
    roots = []
    for unit in units:
        if unit.parent_id and unit.parent_id in nodes:
            nodes[unit.parent_id].children.append(nodes[unit.id])
        else:
            roots.append(nodes[unit.id])
    return roots


@router.get("/tree", response_model=list[MeasurementUnitTreeNode])
def get_measurement_units_tree(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(MeasurementUnit)
    if not include_deleted:
        query = query.where(MeasurementUnit.is_deleted == False)
    units = db.scalars(query.order_by(MeasurementUnit.id)).all()
    return build_tree(units)


@router.get("/", response_model=Pagination[MeasurementUnitOut])
def list_measurement_units(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    parent_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(MeasurementUnit)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(MeasurementUnit.is_deleted == False)
    else:
        query = query.where(MeasurementUnit.is_deleted == is_deleted)
    if parent_id is not None:
        query = query.where(MeasurementUnit.parent_id == parent_id)

    query = apply_search(query, q, [MeasurementUnit.name])
    query = apply_date_filters(
        query, MeasurementUnit, created_at_from, created_at_to, updated_at_from, updated_at_to
    )
    query = apply_sort(query, MeasurementUnit, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{unit_id}", response_model=MeasurementUnitOut)
def get_measurement_unit(
    unit_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(MeasurementUnit).where(MeasurementUnit.id == unit_id)
    if not include_deleted:
        query = query.where(MeasurementUnit.is_deleted == False)
    unit = db.scalar(query)
    if not unit:
        raise HTTPException(status_code=404, detail="Measurement unit not found")
    return unit


@router.post("/", response_model=MeasurementUnitOut)
def create_measurement_unit(
    payload: MeasurementUnitCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    if payload.parent_id is not None:
        parent = db.scalar(
            select(MeasurementUnit).where(
                MeasurementUnit.id == payload.parent_id, MeasurementUnit.is_deleted == False
            )
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent unit not found")

    unit = MeasurementUnit(
        name=payload.name,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
    )
    db.add(unit)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="measurement_units",
        entity_id=unit.id,
        before=None,
        after=model_to_dict(unit),
    )

    db.commit()
    db.refresh(unit)
    return unit


@router.patch("/{unit_id}", response_model=MeasurementUnitOut)
def update_measurement_unit(
    unit_id: int,
    payload: MeasurementUnitUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    unit = db.scalar(select(MeasurementUnit).where(MeasurementUnit.id == unit_id))
    if not unit:
        raise HTTPException(status_code=404, detail="Measurement unit not found")

    before = model_to_dict(unit)
    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        unit.name = payload.name
    if "parent_id" in data:
        if data["parent_id"] is not None:
            parent = db.scalar(
                select(MeasurementUnit).where(
                    MeasurementUnit.id == data["parent_id"], MeasurementUnit.is_deleted == False
                )
            )
            if not parent:
                raise HTTPException(status_code=404, detail="Parent unit not found")
        unit.parent_id = data["parent_id"]
    if payload.sort_order is not None:
        unit.sort_order = payload.sort_order

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="measurement_units",
        entity_id=unit.id,
        before=before,
        after=model_to_dict(unit),
    )

    db.commit()
    db.refresh(unit)
    return unit


@router.put("/{unit_id}", response_model=MeasurementUnitOut)
def update_measurement_unit_legacy(
    unit_id: int,
    payload: MeasurementUnitUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_measurement_unit(unit_id, payload, db, current_user)


@router.delete("/{unit_id}")
def delete_measurement_unit(
    unit_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    unit = db.scalar(select(MeasurementUnit).where(MeasurementUnit.id == unit_id))
    if not unit:
        raise HTTPException(status_code=404, detail="Measurement unit not found")

    before = model_to_dict(unit)
    unit.is_deleted = True
    unit.deleted_at = datetime.utcnow()
    unit.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="measurement_units",
        entity_id=unit.id,
        before=before,
        after=model_to_dict(unit),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{unit_id}/restore", response_model=MeasurementUnitOut)
def restore_measurement_unit(
    unit_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    unit = db.scalar(select(MeasurementUnit).where(MeasurementUnit.id == unit_id))
    if not unit:
        raise HTTPException(status_code=404, detail="Measurement unit not found")

    before = model_to_dict(unit)
    unit.is_deleted = False
    unit.deleted_at = None
    unit.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="measurement_units",
        entity_id=unit.id,
        before=before,
        after=model_to_dict(unit),
    )

    db.commit()
    db.refresh(unit)
    return unit
