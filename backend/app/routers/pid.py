from datetime import datetime, UTC

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.models.core import Location
from app.models.pid import PidProcess
from app.models.security import User
from app.schemas.pid import (
    PidDiagramOut,
    PidDiagramPayload,
    PidProcessCreate,
    PidProcessOut,
    PidProcessUpdate,
)
from app.services.pid_storage import load_diagram, save_diagram_atomic, save_image

router = APIRouter()


def _ensure_location(db, location_id: int) -> None:
    exists = db.scalar(
        select(Location.id).where(
            Location.id == location_id,
            Location.is_deleted == False,
        )
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Location not found")


def _get_process(db, process_id: int, include_deleted: bool = False) -> PidProcess:
    query = select(PidProcess).where(PidProcess.id == process_id)
    if not include_deleted:
        query = query.where(PidProcess.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="PID process not found")
    return item


@router.get("/{location_id}/processes", response_model=list[PidProcessOut])
def list_processes(
    location_id: int,
    include_deleted: bool = Query(default=False),
    db=Depends(get_db),
    _user: User = Depends(require_read_access()),
):
    _ensure_location(db, location_id)
    query = select(PidProcess).where(PidProcess.location_id == location_id)
    if not include_deleted:
        query = query.where(PidProcess.is_deleted == False)
    return db.scalars(query.order_by(PidProcess.created_at.desc(), PidProcess.id.desc())).all()


@router.post("/{location_id}/processes", response_model=PidProcessOut)
def create_process(
    location_id: int,
    payload: PidProcessCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    _ensure_location(db, location_id)
    item = PidProcess(location_id=location_id, name=payload.name, description=payload.description)
    db.add(item)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="PID process with this name already exists")

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="pid_processes",
        entity_id=item.id,
        before=None,
        after=model_to_dict(item),
    )
    db.commit()
    db.refresh(item)
    return item


@router.patch("/processes/{process_id}", response_model=PidProcessOut)
def update_process(
    process_id: int,
    payload: PidProcessUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = _get_process(db, process_id)
    before = model_to_dict(item)
    if payload.name is not None:
        item.name = payload.name
    if "description" in payload.model_fields_set:
        item.description = payload.description
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="PID process with this name already exists")
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="pid_processes",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )
    db.commit()
    db.refresh(item)
    return item


@router.delete("/processes/{process_id}")
def delete_process(
    process_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = _get_process(db, process_id)
    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.now(UTC)
    item.deleted_by_id = current_user.id
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="pid_processes",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )
    db.commit()
    return {"status": "ok"}


@router.post("/processes/{process_id}/restore", response_model=PidProcessOut)
def restore_process(
    process_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = _get_process(db, process_id, include_deleted=True)
    if not item.is_deleted:
        return item
    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="PID process with this name already exists")
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="pid_processes",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )
    db.commit()
    db.refresh(item)
    return item


@router.get("/diagram/{process_id}", response_model=PidDiagramOut)
def get_diagram(
    process_id: int,
    db=Depends(get_db),
    _user: User = Depends(require_read_access()),
):
    item = _get_process(db, process_id)
    loaded = load_diagram(process_id)
    if loaded is None:
        return PidDiagramOut(
            processId=item.id,
            version=1,
            updatedAt=datetime.now(UTC),
            viewport={"x": 0, "y": 0, "zoom": 1},
            nodes=[],
            edges=[],
        )
    try:
        return PidDiagramOut(**loaded)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Invalid diagram data: {exc}")


@router.put("/diagram/{process_id}", response_model=PidDiagramOut)
def save_diagram(
    process_id: int,
    payload: PidDiagramPayload,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    item = _get_process(db, process_id)
    if payload.processId != item.id:
        raise HTTPException(status_code=400, detail="processId mismatch")
    save_diagram_atomic(process_id, payload)
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="pid_diagrams",
        entity_id=item.id,
        before=None,
        after={"process_id": item.id, "updated_at": payload.updatedAt.isoformat()},
    )
    db.commit()
    return payload


@router.post("/upload-image")
def upload_image(
    file: UploadFile = File(...),
    _db=Depends(get_db),
    _user: User = Depends(require_write_access()),
):
    try:
        stored_name, original_name = save_image(file)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    return {
        "filename": stored_name,
        "original_name": original_name,
        "url": f"/api/v1/pid-storage/images/{stored_name}",
    }
