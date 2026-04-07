from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.access import SpaceKey, require_space_access
from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort
from app.models.core import Cabinet
from app.models.maintenance import MntPlan, MntActivityType
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.maintenance import PlanCreate, PlanOut, PlanUpdate

router = APIRouter()

_read = require_space_access(SpaceKey.maintenance, "read")
_write = require_space_access(SpaceKey.maintenance, "write")


def _enrich(plan, db):
    if plan.cabinet_id:
        cab = db.scalar(select(Cabinet).where(Cabinet.id == plan.cabinet_id))
        plan.cabinet_name = cab.name if cab else None
    else:
        plan.cabinet_name = None
    if plan.activity_type_id:
        at = db.scalar(select(MntActivityType).where(MntActivityType.id == plan.activity_type_id))
        plan.activity_type_name = at.name if at else None
    else:
        plan.activity_type_name = None
    return plan


@router.get("/", response_model=Pagination[PlanOut])
def list_plans(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    include_deleted: bool = False,
    cabinet_id: int | None = None,
    db=Depends(get_db),
    user: User = Depends(_read),
):
    query = select(MntPlan)
    if not include_deleted:
        query = query.where(MntPlan.is_deleted == False)
    if cabinet_id is not None:
        query = query.where(MntPlan.cabinet_id == cabinet_id)
    query = apply_search(query, q, [MntPlan.name])
    query = apply_sort(query, MntPlan, sort) if sort else query.order_by(MntPlan.id)
    total, items = paginate(query, db, page, page_size)
    for item in items:
        _enrich(item, db)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: int, db=Depends(get_db), user: User = Depends(_read)):
    plan = db.scalar(select(MntPlan).where(MntPlan.id == plan_id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _enrich(plan, db)


@router.post("/", response_model=PlanOut)
def create_plan(payload: PlanCreate, db=Depends(get_db), user: User = Depends(_write)):
    plan = MntPlan(**payload.model_dump())
    db.add(plan)
    db.flush()
    add_audit_log(db, actor_id=user.id, action="CREATE", entity="mnt_plans", entity_id=plan.id, after=model_to_dict(plan))
    db.commit()
    db.refresh(plan)
    return _enrich(plan, db)


@router.patch("/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, payload: PlanUpdate, db=Depends(get_db), user: User = Depends(_write)):
    plan = db.scalar(select(MntPlan).where(MntPlan.id == plan_id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    before = model_to_dict(plan)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(plan, k, v)
    add_audit_log(db, actor_id=user.id, action="UPDATE", entity="mnt_plans", entity_id=plan.id, before=before, after=model_to_dict(plan))
    db.commit()
    db.refresh(plan)
    return _enrich(plan, db)


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db=Depends(get_db), user: User = Depends(_write)):
    plan = db.scalar(select(MntPlan).where(MntPlan.id == plan_id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    before = model_to_dict(plan)
    plan.is_deleted = True
    plan.deleted_at = datetime.utcnow()
    plan.deleted_by_id = user.id
    add_audit_log(db, actor_id=user.id, action="DELETE", entity="mnt_plans", entity_id=plan.id, before=before, after=model_to_dict(plan))
    db.commit()
    return {"status": "ok"}


@router.post("/{plan_id}/restore", response_model=PlanOut)
def restore_plan(plan_id: int, db=Depends(get_db), user: User = Depends(_write)):
    plan = db.scalar(select(MntPlan).where(MntPlan.id == plan_id))
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    before = model_to_dict(plan)
    plan.is_deleted = False
    plan.deleted_at = None
    plan.deleted_by_id = None
    add_audit_log(db, actor_id=user.id, action="RESTORE", entity="mnt_plans", entity_id=plan.id, before=before, after=model_to_dict(plan))
    db.commit()
    db.refresh(plan)
    return _enrich(plan, db)
