from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_date_filters, apply_search, apply_sort
from app.models.core import DataType
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.data_types import DataTypeCreate, DataTypeOut, DataTypeTreeNode, DataTypeUpdate

router = APIRouter()


def build_tree(items):
    nodes = {
        item.id: DataTypeTreeNode(id=item.id, name=item.name, tooltip=item.tooltip, children=[])
        for item in items
    }
    roots = []
    for item in items:
        if item.parent_id and item.parent_id in nodes:
            nodes[item.parent_id].children.append(nodes[item.id])
        else:
            roots.append(nodes[item.id])
    return roots


@router.get("/tree", response_model=list[DataTypeTreeNode])
def get_data_types_tree(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(DataType)
    if not include_deleted:
        query = query.where(DataType.is_deleted == False)
    items = db.scalars(query.order_by(DataType.id)).all()
    return build_tree(items)


@router.get("/", response_model=Pagination[DataTypeOut])
def list_data_types(
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
    query = select(DataType)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(DataType.is_deleted == False)
    else:
        query = query.where(DataType.is_deleted == is_deleted)
    if parent_id is not None:
        query = query.where(DataType.parent_id == parent_id)

    query = apply_search(query, q, [DataType.name, DataType.tooltip])
    query = apply_date_filters(query, DataType, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, DataType, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{data_type_id}", response_model=DataTypeOut)
def get_data_type(
    data_type_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(DataType).where(DataType.id == data_type_id)
    if not include_deleted:
        query = query.where(DataType.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="Data type not found")
    return item


@router.post("/", response_model=DataTypeOut)
def create_data_type(
    payload: DataTypeCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    if payload.parent_id is not None:
        parent = db.scalar(
            select(DataType).where(DataType.id == payload.parent_id, DataType.is_deleted == False)
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent data type not found")

    item = DataType(
        name=payload.name,
        parent_id=payload.parent_id,
        tooltip=payload.tooltip,
    )
    db.add(item)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="data_types",
        entity_id=item.id,
        before=None,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{data_type_id}", response_model=DataTypeOut)
def update_data_type(
    data_type_id: int,
    payload: DataTypeUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(DataType).where(DataType.id == data_type_id))
    if not item:
        raise HTTPException(status_code=404, detail="Data type not found")

    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        item.name = payload.name
    if "parent_id" in data:
        if data["parent_id"] is not None:
            parent = db.scalar(
                select(DataType).where(DataType.id == data["parent_id"], DataType.is_deleted == False)
            )
            if not parent:
                raise HTTPException(status_code=404, detail="Parent data type not found")
        item.parent_id = data["parent_id"]
    if "tooltip" in data:
        item.tooltip = data["tooltip"]

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="data_types",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.put("/{data_type_id}", response_model=DataTypeOut)
def update_data_type_legacy(
    data_type_id: int,
    payload: DataTypeUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_data_type(data_type_id, payload, db, current_user)


@router.delete("/{data_type_id}")
def delete_data_type(
    data_type_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(DataType).where(DataType.id == data_type_id))
    if not item:
        raise HTTPException(status_code=404, detail="Data type not found")

    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="data_types",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{data_type_id}/restore", response_model=DataTypeOut)
def restore_data_type(
    data_type_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(DataType).where(DataType.id == data_type_id))
    if not item:
        raise HTTPException(status_code=404, detail="Data type not found")

    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="data_types",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item
