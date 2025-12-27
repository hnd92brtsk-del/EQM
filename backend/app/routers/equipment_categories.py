from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import EquipmentCategory
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.equipment_categories import (
    EquipmentCategoryOut,
    EquipmentCategoryCreate,
    EquipmentCategoryUpdate,
)

router = APIRouter()


@router.get("/", response_model=Pagination[EquipmentCategoryOut])
def list_equipment_categories(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(EquipmentCategory)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(EquipmentCategory.is_deleted == False)
    else:
        query = query.where(EquipmentCategory.is_deleted == is_deleted)

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
    query = select(EquipmentCategory).where(EquipmentCategory.id == category_id)
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
    existing = db.scalar(
        select(EquipmentCategory).where(
            EquipmentCategory.name == payload.name, EquipmentCategory.is_deleted == False
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Equipment category already exists")

    category = EquipmentCategory(name=payload.name)
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
    category = db.scalar(select(EquipmentCategory).where(EquipmentCategory.id == category_id))
    if not category:
        raise HTTPException(status_code=404, detail="Equipment category not found")

    before = model_to_dict(category)

    if payload.name is not None:
        category.name = payload.name

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

    before = model_to_dict(category)
    category.is_deleted = True
    category.deleted_at = datetime.utcnow()
    category.deleted_by_id = current_user.id

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
    category = db.scalar(select(EquipmentCategory).where(EquipmentCategory.id == category_id))
    if not category:
        raise HTTPException(status_code=404, detail="Equipment category not found")

    before = model_to_dict(category)
    category.is_deleted = False
    category.deleted_at = None
    category.deleted_by_id = None

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
