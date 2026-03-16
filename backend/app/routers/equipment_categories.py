from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_date_filters, apply_search, apply_sort
from app.models.core import EquipmentCategory
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.equipment_categories import (
    EquipmentCategoryCreate,
    EquipmentCategoryOut,
    EquipmentCategoryTreeNode,
    EquipmentCategoryUpdate,
)

router = APIRouter()
MAX_DEPTH = 3


def build_tree(items: list[EquipmentCategory]) -> list[EquipmentCategoryTreeNode]:
    nodes = {
        item.id: EquipmentCategoryTreeNode(
            id=item.id,
            name=item.name,
            parent_id=item.parent_id,
            full_path=item.full_path,
            is_deleted=item.is_deleted,
            children=[],
        )
        for item in items
    }
    roots: list[EquipmentCategoryTreeNode] = []
    for item in items:
        if item.parent_id and item.parent_id in nodes:
            nodes[item.parent_id].children.append(nodes[item.id])
        else:
            roots.append(nodes[item.id])
    return roots


def ensure_unique_name(db, name: str, parent_id: int | None, exclude_id: int | None = None) -> None:
    query = select(EquipmentCategory).where(
        EquipmentCategory.name == name,
        EquipmentCategory.parent_id == parent_id,
        EquipmentCategory.is_deleted == False,
    )
    if exclude_id is not None:
        query = query.where(EquipmentCategory.id != exclude_id)
    if db.scalar(query):
        raise HTTPException(status_code=400, detail="Equipment category already exists")


def compute_depth(parent: EquipmentCategory | None) -> int:
    depth = 1
    current = parent
    seen: set[int] = set()
    while current is not None:
        if current.id in seen:
            raise HTTPException(status_code=400, detail="Parent cycle detected")
        seen.add(current.id)
        current = current.parent
        depth += 1
    return depth


def resolve_parent(db, parent_id: int | None, node_id: int | None = None) -> EquipmentCategory | None:
    if parent_id is None:
        return None
    parent = db.scalar(
        select(EquipmentCategory)
        .options(selectinload(EquipmentCategory.parent))
        .where(EquipmentCategory.id == parent_id, EquipmentCategory.is_deleted == False)
    )
    if not parent:
        raise HTTPException(status_code=404, detail="Parent equipment category not found")
    if node_id is not None and parent.id == node_id:
        raise HTTPException(status_code=400, detail="Node cannot be its own parent")

    current = parent
    seen: set[int] = set()
    while current is not None:
        if current.id in seen or (node_id is not None and current.id == node_id):
            raise HTTPException(status_code=400, detail="Parent cycle detected")
        seen.add(current.id)
        current = current.parent

    if compute_depth(parent) > MAX_DEPTH:
        raise HTTPException(status_code=400, detail="Equipment category depth exceeds limit")
    return parent


def collect_subtree_ids(db, root_id: int) -> list[int]:
    items = db.scalars(select(EquipmentCategory)).all()
    children_map: dict[int | None, list[int]] = {}
    for item in items:
        children_map.setdefault(item.parent_id, []).append(item.id)

    result: list[int] = []
    stack = [root_id]
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(children_map.get(current, []))
    return result


@router.get("/tree", response_model=list[EquipmentCategoryTreeNode])
def get_equipment_categories_tree(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(EquipmentCategory).options(selectinload(EquipmentCategory.parent))
    if not include_deleted:
        query = query.where(EquipmentCategory.is_deleted == False)
    items = db.scalars(query.order_by(EquipmentCategory.parent_id, EquipmentCategory.name, EquipmentCategory.id)).all()
    return build_tree(items)


@router.get("/", response_model=Pagination[EquipmentCategoryOut])
def list_equipment_categories(
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
    query = select(EquipmentCategory).options(selectinload(EquipmentCategory.parent))
    if is_deleted is None:
        if not include_deleted:
            query = query.where(EquipmentCategory.is_deleted == False)
    else:
        query = query.where(EquipmentCategory.is_deleted == is_deleted)
    if parent_id is not None:
        query = query.where(EquipmentCategory.parent_id == parent_id)

    query = apply_search(query, q, [EquipmentCategory.name])
    query = apply_date_filters(query, EquipmentCategory, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, EquipmentCategory, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{category_id}", response_model=EquipmentCategoryOut)
def get_equipment_category(
    category_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = (
        select(EquipmentCategory)
        .options(selectinload(EquipmentCategory.parent))
        .where(EquipmentCategory.id == category_id)
    )
    if not include_deleted:
        query = query.where(EquipmentCategory.is_deleted == False)
    category = db.scalar(query)
    if not category:
        raise HTTPException(status_code=404, detail="Equipment category not found")
    return category


@router.post("/", response_model=EquipmentCategoryOut)
def create_equipment_category(
    payload: EquipmentCategoryCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    parent = resolve_parent(db, payload.parent_id)
    if parent is not None and compute_depth(parent) + 1 > MAX_DEPTH:
        raise HTTPException(status_code=400, detail="Equipment category depth exceeds limit")
    ensure_unique_name(db, payload.name, payload.parent_id)

    category = EquipmentCategory(name=payload.name, parent_id=payload.parent_id)
    db.add(category)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="equipment_categories",
        entity_id=category.id,
        before=None,
        after=model_to_dict(category),
    )

    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=EquipmentCategoryOut)
def update_equipment_category(
    category_id: int,
    payload: EquipmentCategoryUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    category = db.scalar(
        select(EquipmentCategory).options(selectinload(EquipmentCategory.parent)).where(EquipmentCategory.id == category_id)
    )
    if not category:
        raise HTTPException(status_code=404, detail="Equipment category not found")

    before = model_to_dict(category)
    data = payload.model_dump(exclude_unset=True)

    target_parent_id = category.parent_id
    if "parent_id" in data:
        parent = resolve_parent(db, data["parent_id"], node_id=category_id)
        if parent is not None and compute_depth(parent) + 1 > MAX_DEPTH:
            raise HTTPException(status_code=400, detail="Equipment category depth exceeds limit")
        target_parent_id = data["parent_id"]

    target_name = payload.name if payload.name is not None else category.name
    ensure_unique_name(db, target_name, target_parent_id, exclude_id=category_id)

    if payload.name is not None:
        category.name = payload.name
    if "parent_id" in data:
        category.parent_id = data["parent_id"]

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="equipment_categories",
        entity_id=category.id,
        before=before,
        after=model_to_dict(category),
    )

    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=EquipmentCategoryOut)
def update_equipment_category_legacy(
    category_id: int,
    payload: EquipmentCategoryUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_equipment_category(category_id, payload, db, current_user)


@router.delete("/{category_id}")
def delete_equipment_category(
    category_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    category = db.scalar(select(EquipmentCategory).where(EquipmentCategory.id == category_id))
    if not category:
        raise HTTPException(status_code=404, detail="Equipment category not found")

    subtree_ids = collect_subtree_ids(db, category_id)
    items = db.scalars(select(EquipmentCategory).where(EquipmentCategory.id.in_(subtree_ids))).all()
    before = model_to_dict(category)
    for item in items:
        item.is_deleted = True
        item.deleted_at = datetime.utcnow()
        item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="equipment_categories",
        entity_id=category.id,
        before=before,
        after=model_to_dict(category),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{category_id}/restore", response_model=EquipmentCategoryOut)
def restore_equipment_category(
    category_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    category = db.scalar(
        select(EquipmentCategory).options(selectinload(EquipmentCategory.parent)).where(EquipmentCategory.id == category_id)
    )
    if not category:
        raise HTTPException(status_code=404, detail="Equipment category not found")

    before = model_to_dict(category)
    ancestors: list[EquipmentCategory] = []
    current = category.parent
    while current is not None:
        ancestors.append(current)
        current = current.parent

    for item in reversed(ancestors):
        item.is_deleted = False
        item.deleted_at = None
        item.deleted_by_id = None

    subtree_ids = collect_subtree_ids(db, category_id)
    items = db.scalars(select(EquipmentCategory).where(EquipmentCategory.id.in_(subtree_ids))).all()
    for item in items:
        item.is_deleted = False
        item.deleted_at = None
        item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="equipment_categories",
        entity_id=category.id,
        before=before,
        after=model_to_dict(category),
    )

    db.commit()
    db.refresh(category)
    return category
