from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_roles
from app.core.security import hash_password
from app.core.pagination import paginate
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
    include_deleted: bool = False,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin])),
):
    query = select(User)
    if not include_deleted:
        query = query.where(User.is_deleted == False)
    if q:
        query = query.where(User.username.ilike(f"%{q}%"))

    total, items = paginate(query.order_by(User.id), db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin])),
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


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin])),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before = model_to_dict(user)

    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.role:
        user.role = UserRole(payload.role)
    if payload.is_deleted is not None:
        user.is_deleted = payload.is_deleted
        user.deleted_at = datetime.utcnow() if payload.is_deleted else None
        user.deleted_by_id = current_user.id if payload.is_deleted else None

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
