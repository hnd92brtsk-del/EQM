from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import SignalTypeDictionary
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.signal_types import (
    SignalTypeOut,
    SignalTypeCreate,
    SignalTypeUpdate,
    SignalTypeTreeNode,
)

router = APIRouter()


def build_tree(items):
    nodes = {
        item.id: SignalTypeTreeNode(id=item.id, name=item.name, children=[]) for item in items
    }
    roots = []
    for item in items:
        if item.parent_id and item.parent_id in nodes:
            nodes[item.parent_id].children.append(nodes[item.id])
        else:
            roots.append(nodes[item.id])
    return roots


@router.get("/tree", response_model=list[SignalTypeTreeNode])
def get_signal_types_tree(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(SignalTypeDictionary)
    if not include_deleted:
        query = query.where(SignalTypeDictionary.is_deleted == False)
    items = db.scalars(query.order_by(SignalTypeDictionary.id)).all()
    return build_tree(items)


@router.get("/", response_model=Pagination[SignalTypeOut])
def list_signal_types(
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
    query = select(SignalTypeDictionary)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(SignalTypeDictionary.is_deleted == False)
    else:
        query = query.where(SignalTypeDictionary.is_deleted == is_deleted)
    if parent_id is not None:
        query = query.where(SignalTypeDictionary.parent_id == parent_id)

    query = apply_search(query, q, [SignalTypeDictionary.name])
    query = apply_date_filters(
        query, SignalTypeDictionary, created_at_from, created_at_to, updated_at_from, updated_at_to
    )
    query = apply_sort(query, SignalTypeDictionary, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{signal_type_id}", response_model=SignalTypeOut)
def get_signal_type(
    signal_type_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(SignalTypeDictionary).where(SignalTypeDictionary.id == signal_type_id)
    if not include_deleted:
        query = query.where(SignalTypeDictionary.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="Signal type not found")
    return item


@router.post("/", response_model=SignalTypeOut)
def create_signal_type(
    payload: SignalTypeCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    if payload.parent_id is not None:
        parent = db.scalar(
            select(SignalTypeDictionary).where(
                SignalTypeDictionary.id == payload.parent_id, SignalTypeDictionary.is_deleted == False
            )
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent signal type not found")

    item = SignalTypeDictionary(
        name=payload.name,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
    )
    db.add(item)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="signal_types",
        entity_id=item.id,
        before=None,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{signal_type_id}", response_model=SignalTypeOut)
def update_signal_type(
    signal_type_id: int,
    payload: SignalTypeUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(SignalTypeDictionary).where(SignalTypeDictionary.id == signal_type_id))
    if not item:
        raise HTTPException(status_code=404, detail="Signal type not found")

    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        item.name = payload.name
    if "parent_id" in data:
        if data["parent_id"] is not None:
            parent = db.scalar(
                select(SignalTypeDictionary).where(
                    SignalTypeDictionary.id == data["parent_id"],
                    SignalTypeDictionary.is_deleted == False,
                )
            )
            if not parent:
                raise HTTPException(status_code=404, detail="Parent signal type not found")
        item.parent_id = data["parent_id"]
    if payload.sort_order is not None:
        item.sort_order = payload.sort_order

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="signal_types",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.put("/{signal_type_id}", response_model=SignalTypeOut)
def update_signal_type_legacy(
    signal_type_id: int,
    payload: SignalTypeUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_signal_type(signal_type_id, payload, db, current_user)


@router.delete("/{signal_type_id}")
def delete_signal_type(
    signal_type_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(SignalTypeDictionary).where(SignalTypeDictionary.id == signal_type_id))
    if not item:
        raise HTTPException(status_code=404, detail="Signal type not found")

    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="signal_types",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{signal_type_id}/restore", response_model=SignalTypeOut)
def restore_signal_type(
    signal_type_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(SignalTypeDictionary).where(SignalTypeDictionary.id == signal_type_id))
    if not item:
        raise HTTPException(status_code=404, detail="Signal type not found")

    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="signal_types",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item
