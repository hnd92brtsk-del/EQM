from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import FieldEquipment
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.field_equipments import (
    FieldEquipmentOut,
    FieldEquipmentCreate,
    FieldEquipmentUpdate,
    FieldEquipmentTreeNode,
)

router = APIRouter()


def build_tree(items):
    nodes = {item.id: FieldEquipmentTreeNode(id=item.id, name=item.name, children=[]) for item in items}
    roots = []
    for item in items:
        if item.parent_id and item.parent_id in nodes:
            nodes[item.parent_id].children.append(nodes[item.id])
        else:
            roots.append(nodes[item.id])
    return roots


@router.get("/tree", response_model=list[FieldEquipmentTreeNode])
def get_field_equipment_tree(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(FieldEquipment)
    if not include_deleted:
        query = query.where(FieldEquipment.is_deleted == False)
    items = db.scalars(query.order_by(FieldEquipment.id)).all()
    return build_tree(items)


@router.get("/", response_model=Pagination[FieldEquipmentOut])
def list_field_equipments(
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
    query = select(FieldEquipment)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(FieldEquipment.is_deleted == False)
    else:
        query = query.where(FieldEquipment.is_deleted == is_deleted)
    if parent_id is not None:
        query = query.where(FieldEquipment.parent_id == parent_id)

    query = apply_search(query, q, [FieldEquipment.name])
    query = apply_date_filters(
        query, FieldEquipment, created_at_from, created_at_to, updated_at_from, updated_at_to
    )
    query = apply_sort(query, FieldEquipment, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{item_id}", response_model=FieldEquipmentOut)
def get_field_equipment(
    item_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(FieldEquipment).where(FieldEquipment.id == item_id)
    if not include_deleted:
        query = query.where(FieldEquipment.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="Field equipment not found")
    return item


@router.post("/", response_model=FieldEquipmentOut)
def create_field_equipment(
    payload: FieldEquipmentCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = FieldEquipment(name=payload.name, parent_id=payload.parent_id)
    db.add(item)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="field_equipments",
        entity_id=item.id,
        before=None,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=FieldEquipmentOut)
def update_field_equipment(
    item_id: int,
    payload: FieldEquipmentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(FieldEquipment).where(FieldEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Field equipment not found")

    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        item.name = payload.name
    if "parent_id" in data:
        item.parent_id = data["parent_id"]

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="field_equipments",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=FieldEquipmentOut)
def update_field_equipment_legacy(
    item_id: int,
    payload: FieldEquipmentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_field_equipment(item_id, payload, db, current_user)


@router.delete("/{item_id}")
def delete_field_equipment(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(FieldEquipment).where(FieldEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Field equipment not found")

    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="field_equipments",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{item_id}/restore", response_model=FieldEquipmentOut)
def restore_field_equipment(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(FieldEquipment).where(FieldEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Field equipment not found")

    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="field_equipments",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item
