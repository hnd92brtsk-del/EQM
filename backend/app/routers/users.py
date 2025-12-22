from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_admin
from app.core.security import hash_password
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.security import User, UserRole
from app.schemas.common import Pagination
from app.schemas.users import UserOut, UserCreate, UserUpdate

router = APIRouter()


@router.get("/", response_model=Pagination[UserOut])
def list_users(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    role: UserRole | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    query = select(User)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(User.is_deleted == False)
    else:
        query = query.where(User.is_deleted == is_deleted)
    if role:
        query = query.where(User.role == role)

    query = apply_search(query, q, [User.username])
    query = apply_date_filters(query, User, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, User, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    query = select(User).where(User.id == user_id)
    if not include_deleted:
        query = query.where(User.is_deleted == False)
    user = db.scalar(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing and not existing.is_deleted:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=UserRole(payload.role),
    )
    db.add(user)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="users",
        entity_id=user.id,
        before=None,
        after=model_to_dict(user),
    )

    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before = model_to_dict(user)

    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.role:
        user.role = UserRole(payload.role)

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="users",
        entity_id=user.id,
        before=before,
        after=model_to_dict(user),
    )

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before = model_to_dict(user)
    user.is_deleted = True
    user.deleted_at = datetime.utcnow()
    user.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="users",
        entity_id=user.id,
        before=before,
        after=model_to_dict(user),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{user_id}/restore", response_model=UserOut)
def restore_user(
    user_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before = model_to_dict(user)
    user.is_deleted = False
    user.deleted_at = None
    user.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="users",
        entity_id=user.id,
        before=before,
        after=model_to_dict(user),
    )

    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user_legacy(
    user_id: int,
    payload: UserUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    return update_user(user_id, payload, db, current_user)
