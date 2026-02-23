import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_date_filters, apply_search, apply_sort
from app.models.core import MainEquipment
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.main_equipment import (
    MainEquipmentCreate,
    MainEquipmentOut,
    MainEquipmentTreeNode,
    MainEquipmentUpdate,
)

router = APIRouter()

CODE_RE = re.compile(r"^\d+(?:\.\d+)*$")


def build_tree(items: list[MainEquipment]) -> list[MainEquipmentTreeNode]:
    nodes = {
        item.id: MainEquipmentTreeNode(
            id=item.id,
            name=item.name,
            level=item.level,
            code=item.code,
            children=[],
        )
        for item in items
    }
    roots: list[MainEquipmentTreeNode] = []
    for item in items:
        if item.parent_id and item.parent_id in nodes:
            nodes[item.parent_id].children.append(nodes[item.id])
        else:
            roots.append(nodes[item.id])
    return roots


def normalize_code(raw: str | None) -> str | None:
    if raw is None:
        return None
    code = raw.strip()
    if not code:
        return None
    if not CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Invalid code format")
    return code


def ensure_unique_code(db, code: str, exclude_id: int | None = None) -> None:
    query = select(MainEquipment).where(
        MainEquipment.code == code,
        MainEquipment.is_deleted == False,
    )
    if exclude_id is not None:
        query = query.where(MainEquipment.id != exclude_id)
    existing = db.scalar(query)
    if existing:
        raise HTTPException(status_code=400, detail="Code already exists")


def resolve_parent(db, parent_id: int | None, node_id: int | None = None) -> MainEquipment | None:
    if parent_id is None:
        return None
    parent = db.scalar(
        select(MainEquipment).where(
            MainEquipment.id == parent_id,
            MainEquipment.is_deleted == False,
        )
    )
    if not parent:
        raise HTTPException(status_code=404, detail="Parent main equipment not found")
    if node_id is not None and parent.id == node_id:
        raise HTTPException(status_code=400, detail="Node cannot be its own parent")

    seen: set[int] = set()
    current = parent
    while current is not None:
        if current.id in seen:
            raise HTTPException(status_code=400, detail="Parent cycle detected")
        seen.add(current.id)
        if node_id is not None and current.id == node_id:
            raise HTTPException(status_code=400, detail="Parent cycle detected")
        if current.parent_id is None:
            break
        current = db.scalar(select(MainEquipment).where(MainEquipment.id == current.parent_id))

    return parent


def compute_level(parent: MainEquipment | None) -> int:
    return 1 if parent is None else parent.level + 1


def generate_code(db, parent: MainEquipment | None, level: int, exclude_id: int | None = None) -> str:
    siblings_query = select(MainEquipment).where(MainEquipment.parent_id == (parent.id if parent else None))
    if exclude_id is not None:
        siblings_query = siblings_query.where(MainEquipment.id != exclude_id)
    siblings = db.scalars(siblings_query).all()

    max_suffix = 0
    for sibling in siblings:
        if not sibling.code or not CODE_RE.match(sibling.code):
            continue
        parts = sibling.code.split(".")
        if len(parts) != level:
            continue
        if parent is not None and not sibling.code.startswith(f"{parent.code}."):
            continue
        try:
            max_suffix = max(max_suffix, int(parts[-1]))
        except ValueError:
            continue

    next_suffix = max_suffix + 1
    if parent is None:
        return str(next_suffix)
    return f"{parent.code}.{next_suffix}"


def build_children_map(items: list[MainEquipment]) -> dict[int | None, list[MainEquipment]]:
    children: dict[int | None, list[MainEquipment]] = {}
    for item in items:
        children.setdefault(item.parent_id, []).append(item)
    return children


def relevel_and_recode_subtree(
    db,
    node: MainEquipment,
    old_level: int,
    new_level: int,
    old_code: str,
    new_code: str,
) -> None:
    level_delta = new_level - old_level
    all_items = db.scalars(select(MainEquipment)).all()
    children_map = build_children_map(all_items)

    stack = list(children_map.get(node.id, []))
    while stack:
        child = stack.pop()
        if child.code and child.code.startswith(f"{old_code}."):
            child.code = f"{new_code}{child.code[len(old_code):]}"
        child.level = child.level + level_delta
        stack.extend(children_map.get(child.id, []))


@router.get("/tree", response_model=list[MainEquipmentTreeNode])
def get_main_equipment_tree(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(MainEquipment)
    if not include_deleted:
        query = query.where(MainEquipment.is_deleted == False)
    items = db.scalars(query.order_by(MainEquipment.code, MainEquipment.id)).all()
    return build_tree(items)


@router.get("/", response_model=Pagination[MainEquipmentOut])
def list_main_equipment(
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
    query = select(MainEquipment)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(MainEquipment.is_deleted == False)
    else:
        query = query.where(MainEquipment.is_deleted == is_deleted)
    if parent_id is not None:
        query = query.where(MainEquipment.parent_id == parent_id)

    query = apply_search(query, q, [MainEquipment.name, MainEquipment.code])
    query = apply_date_filters(
        query,
        MainEquipment,
        created_at_from,
        created_at_to,
        updated_at_from,
        updated_at_to,
    )
    query = apply_sort(query, MainEquipment, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{item_id}", response_model=MainEquipmentOut)
def get_main_equipment(
    item_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(MainEquipment).where(MainEquipment.id == item_id)
    if not include_deleted:
        query = query.where(MainEquipment.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="Main equipment not found")
    return item


@router.post("/", response_model=MainEquipmentOut)
def create_main_equipment(
    payload: MainEquipmentCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    parent = resolve_parent(db, payload.parent_id)
    level = compute_level(parent)

    code = normalize_code(payload.code)
    if code is None:
        code = generate_code(db, parent, level)
    ensure_unique_code(db, code)

    item = MainEquipment(
        name=payload.name,
        parent_id=payload.parent_id,
        level=level,
        code=code,
        meta_data=payload.meta_data,
    )
    db.add(item)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="main_equipment",
        entity_id=item.id,
        before=None,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=MainEquipmentOut)
def update_main_equipment(
    item_id: int,
    payload: MainEquipmentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(MainEquipment).where(MainEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Main equipment not found")

    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)

    old_level = item.level
    old_code = item.code
    old_parent_id = item.parent_id

    if payload.name is not None:
        item.name = payload.name

    if "parent_id" in data:
        parent = resolve_parent(db, data["parent_id"], node_id=item_id)
        item.parent_id = data["parent_id"]
        item.level = compute_level(parent)
        if payload.code is None and data["parent_id"] != old_parent_id:
            item.code = generate_code(db, parent, item.level, exclude_id=item_id)

    if "code" in data:
        normalized_code = normalize_code(data["code"])
        if normalized_code is None:
            parent = resolve_parent(db, item.parent_id, node_id=item_id)
            item.code = generate_code(db, parent, item.level, exclude_id=item_id)
        else:
            item.code = normalized_code

    if payload.meta_data is not None or ("meta_data" in data and data["meta_data"] is None):
        item.meta_data = data.get("meta_data")

    ensure_unique_code(db, item.code, exclude_id=item_id)

    if item.level != old_level or item.code != old_code:
        relevel_and_recode_subtree(db, item, old_level, item.level, old_code, item.code)

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="main_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=MainEquipmentOut)
def update_main_equipment_legacy(
    item_id: int,
    payload: MainEquipmentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_main_equipment(item_id, payload, db, current_user)


@router.delete("/{item_id}")
def delete_main_equipment(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(MainEquipment).where(MainEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Main equipment not found")

    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="main_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{item_id}/restore", response_model=MainEquipmentOut)
def restore_main_equipment(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = db.scalar(select(MainEquipment).where(MainEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Main equipment not found")

    ensure_unique_code(db, item.code, exclude_id=item.id)

    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="main_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    db.refresh(item)
    return item

