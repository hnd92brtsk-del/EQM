from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.access import build_user_permissions, require_space_access
from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db
from app.core.identity import user_out_with_permissions
from app.core.pagination import paginate
from app.core.query import apply_alphabet_filter, apply_date_filters, apply_search, apply_sort, apply_text_filter
from app.core.security import hash_password
from app.models.security import SpaceKey, User, UserRole
from app.schemas.common import Pagination
from app.schemas.users import UserCreate, UserOut, UserUpdate

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
    username: str | None = None,
    username_alphabet: str | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    query = select(User)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(User.is_deleted == False)
    else:
        query = query.where(User.is_deleted == is_deleted)
    if role:
        query = query.where(User.role == role)
    query = apply_text_filter(query, User.username, username)
    query = apply_alphabet_filter(query, User.username, username_alphabet)
    query = apply_search(query, q, [User.username])
    query = apply_date_filters(query, User, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, User, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(
        items=[user_out_with_permissions(item, build_user_permissions(db, item)) for item in items],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    query = select(User).where(User.id == user_id)
    if not include_deleted:
        query = query.where(User.is_deleted == False)
    user = db.scalar(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_out_with_permissions(user, build_user_permissions(db, user))


@router.post("/", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
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
    return user_out_with_permissions(user, build_user_permissions(db, user))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
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
    return user_out_with_permissions(user, build_user_permissions(db, user))


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
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
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
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
    return user_out_with_permissions(user, build_user_permissions(db, user))


@router.put("/{user_id}", response_model=UserOut)
def update_user_legacy(
    user_id: int,
    payload: UserUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    return update_user(user_id, payload, db, current_user)
