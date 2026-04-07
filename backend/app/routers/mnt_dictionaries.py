"""CRUD routers for maintenance dictionaries:
failure modes, failure mechanisms, failure causes, detection methods, activity types.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.access import SpaceKey, require_space_access
from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort
from app.models.maintenance import (
    MntActivityType,
    MntDetectionMethod,
    MntFailureCause,
    MntFailureMechanism,
    MntFailureMode,
)
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.maintenance import (
    ActivityTypeCreate, ActivityTypeOut, ActivityTypeUpdate,
    DetectionMethodCreate, DetectionMethodOut, DetectionMethodUpdate,
    FailureCauseCreate, FailureCauseOut, FailureCauseUpdate,
    FailureMechanismCreate, FailureMechanismOut, FailureMechanismUpdate,
    FailureModeCreate, FailureModeOut, FailureModeUpdate,
)

router = APIRouter()

_read = require_space_access(SpaceKey.maintenance, "read")
_write = require_space_access(SpaceKey.maintenance, "write")


# ---- generic helpers -------------------------------------------------------

def _generic_list(model, out_schema, db, page, page_size, q, sort, include_deleted):
    query = select(model)
    if not include_deleted:
        query = query.where(model.is_deleted == False)
    query = apply_search(query, q, [model.name])
    query = apply_sort(query, model, sort) if sort else query.order_by(model.id)
    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


def _generic_create(model, entity_name, payload, db, user):
    obj = model(**payload.model_dump())
    db.add(obj)
    db.flush()
    add_audit_log(db, actor_id=user.id, action="CREATE", entity=entity_name, entity_id=obj.id, after=model_to_dict(obj))
    db.commit()
    db.refresh(obj)
    return obj


def _generic_update(model, entity_name, obj_id, payload, db, user):
    obj = db.scalar(select(model).where(model.id == obj_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    before = model_to_dict(obj)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    add_audit_log(db, actor_id=user.id, action="UPDATE", entity=entity_name, entity_id=obj.id, before=before, after=model_to_dict(obj))
    db.commit()
    db.refresh(obj)
    return obj


def _generic_delete(model, entity_name, obj_id, db, user):
    obj = db.scalar(select(model).where(model.id == obj_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    before = model_to_dict(obj)
    obj.is_deleted = True
    obj.deleted_at = datetime.utcnow()
    obj.deleted_by_id = user.id
    add_audit_log(db, actor_id=user.id, action="DELETE", entity=entity_name, entity_id=obj.id, before=before, after=model_to_dict(obj))
    db.commit()
    return {"status": "ok"}


def _generic_restore(model, entity_name, obj_id, db, user):
    obj = db.scalar(select(model).where(model.id == obj_id))
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    before = model_to_dict(obj)
    obj.is_deleted = False
    obj.deleted_at = None
    obj.deleted_by_id = None
    add_audit_log(db, actor_id=user.id, action="RESTORE", entity=entity_name, entity_id=obj.id, before=before, after=model_to_dict(obj))
    db.commit()
    db.refresh(obj)
    return obj


# ---- Failure Modes ----------------------------------------------------------

@router.get("/failure-modes", response_model=Pagination[FailureModeOut])
def list_failure_modes(page: int = 1, page_size: int = 50, q: str | None = None, sort: str | None = None,
                       include_deleted: bool = False, equipment_category_id: int | None = None,
                       db=Depends(get_db), user: User = Depends(_read)):
    query = select(MntFailureMode)
    if not include_deleted:
        query = query.where(MntFailureMode.is_deleted == False)
    if equipment_category_id is not None:
        query = query.where(MntFailureMode.equipment_category_id == equipment_category_id)
    query = apply_search(query, q, [MntFailureMode.name])
    query = apply_sort(query, MntFailureMode, sort) if sort else query.order_by(MntFailureMode.id)
    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.post("/failure-modes", response_model=FailureModeOut)
def create_failure_mode(payload: FailureModeCreate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_create(MntFailureMode, "mnt_failure_modes", payload, db, user)


@router.patch("/failure-modes/{item_id}", response_model=FailureModeOut)
def update_failure_mode(item_id: int, payload: FailureModeUpdate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_update(MntFailureMode, "mnt_failure_modes", item_id, payload, db, user)


@router.delete("/failure-modes/{item_id}")
def delete_failure_mode(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_delete(MntFailureMode, "mnt_failure_modes", item_id, db, user)


@router.post("/failure-modes/{item_id}/restore", response_model=FailureModeOut)
def restore_failure_mode(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_restore(MntFailureMode, "mnt_failure_modes", item_id, db, user)


# ---- Failure Mechanisms -----------------------------------------------------

@router.get("/failure-mechanisms", response_model=Pagination[FailureMechanismOut])
def list_failure_mechanisms(page: int = 1, page_size: int = 50, q: str | None = None, sort: str | None = None,
                            include_deleted: bool = False, db=Depends(get_db), user: User = Depends(_read)):
    return _generic_list(MntFailureMechanism, FailureMechanismOut, db, page, page_size, q, sort, include_deleted)


@router.post("/failure-mechanisms", response_model=FailureMechanismOut)
def create_failure_mechanism(payload: FailureMechanismCreate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_create(MntFailureMechanism, "mnt_failure_mechanisms", payload, db, user)


@router.patch("/failure-mechanisms/{item_id}", response_model=FailureMechanismOut)
def update_failure_mechanism(item_id: int, payload: FailureMechanismUpdate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_update(MntFailureMechanism, "mnt_failure_mechanisms", item_id, payload, db, user)


@router.delete("/failure-mechanisms/{item_id}")
def delete_failure_mechanism(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_delete(MntFailureMechanism, "mnt_failure_mechanisms", item_id, db, user)


@router.post("/failure-mechanisms/{item_id}/restore", response_model=FailureMechanismOut)
def restore_failure_mechanism(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_restore(MntFailureMechanism, "mnt_failure_mechanisms", item_id, db, user)


# ---- Failure Causes ---------------------------------------------------------

@router.get("/failure-causes", response_model=Pagination[FailureCauseOut])
def list_failure_causes(page: int = 1, page_size: int = 50, q: str | None = None, sort: str | None = None,
                        include_deleted: bool = False, db=Depends(get_db), user: User = Depends(_read)):
    return _generic_list(MntFailureCause, FailureCauseOut, db, page, page_size, q, sort, include_deleted)


@router.post("/failure-causes", response_model=FailureCauseOut)
def create_failure_cause(payload: FailureCauseCreate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_create(MntFailureCause, "mnt_failure_causes", payload, db, user)


@router.patch("/failure-causes/{item_id}", response_model=FailureCauseOut)
def update_failure_cause(item_id: int, payload: FailureCauseUpdate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_update(MntFailureCause, "mnt_failure_causes", item_id, payload, db, user)


@router.delete("/failure-causes/{item_id}")
def delete_failure_cause(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_delete(MntFailureCause, "mnt_failure_causes", item_id, db, user)


@router.post("/failure-causes/{item_id}/restore", response_model=FailureCauseOut)
def restore_failure_cause(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_restore(MntFailureCause, "mnt_failure_causes", item_id, db, user)


# ---- Detection Methods -----------------------------------------------------

@router.get("/detection-methods", response_model=Pagination[DetectionMethodOut])
def list_detection_methods(page: int = 1, page_size: int = 50, q: str | None = None, sort: str | None = None,
                           include_deleted: bool = False, db=Depends(get_db), user: User = Depends(_read)):
    return _generic_list(MntDetectionMethod, DetectionMethodOut, db, page, page_size, q, sort, include_deleted)


@router.post("/detection-methods", response_model=DetectionMethodOut)
def create_detection_method(payload: DetectionMethodCreate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_create(MntDetectionMethod, "mnt_detection_methods", payload, db, user)


@router.patch("/detection-methods/{item_id}", response_model=DetectionMethodOut)
def update_detection_method(item_id: int, payload: DetectionMethodUpdate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_update(MntDetectionMethod, "mnt_detection_methods", item_id, payload, db, user)


@router.delete("/detection-methods/{item_id}")
def delete_detection_method(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_delete(MntDetectionMethod, "mnt_detection_methods", item_id, db, user)


@router.post("/detection-methods/{item_id}/restore", response_model=DetectionMethodOut)
def restore_detection_method(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_restore(MntDetectionMethod, "mnt_detection_methods", item_id, db, user)


# ---- Activity Types ---------------------------------------------------------

@router.get("/activity-types", response_model=Pagination[ActivityTypeOut])
def list_activity_types(page: int = 1, page_size: int = 50, q: str | None = None, sort: str | None = None,
                        include_deleted: bool = False, db=Depends(get_db), user: User = Depends(_read)):
    return _generic_list(MntActivityType, ActivityTypeOut, db, page, page_size, q, sort, include_deleted)


@router.post("/activity-types", response_model=ActivityTypeOut)
def create_activity_type(payload: ActivityTypeCreate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_create(MntActivityType, "mnt_activity_types", payload, db, user)


@router.patch("/activity-types/{item_id}", response_model=ActivityTypeOut)
def update_activity_type(item_id: int, payload: ActivityTypeUpdate, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_update(MntActivityType, "mnt_activity_types", item_id, payload, db, user)


@router.delete("/activity-types/{item_id}")
def delete_activity_type(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_delete(MntActivityType, "mnt_activity_types", item_id, db, user)


@router.post("/activity-types/{item_id}/restore", response_model=ActivityTypeOut)
def restore_activity_type(item_id: int, db=Depends(get_db), user: User = Depends(_write)):
    return _generic_restore(MntActivityType, "mnt_activity_types", item_id, db, user)
