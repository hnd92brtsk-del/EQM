from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.dependencies import get_db, require_read_access, require_admin
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import Personnel, PersonnelCompetency, PersonnelTraining
from app.models.attachments import Attachment
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.personnel import (
    PersonnelOut,
    PersonnelCreate,
    PersonnelUpdate,
    PersonnelCompetencyCreate,
    PersonnelCompetencyUpdate,
    PersonnelCompetencyOut,
    PersonnelTrainingCreate,
    PersonnelTrainingUpdate,
    PersonnelTrainingOut,
)

router = APIRouter()

MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
ALLOWED_ATTACHMENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
}


def ensure_personnel(db, person_id: int, include_deleted: bool = False) -> Personnel:
    query = select(Personnel).where(Personnel.id == person_id)
    if not include_deleted:
        query = query.where(Personnel.is_deleted == False)
    personnel = db.scalar(query)
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return personnel


@router.get("/", response_model=Pagination[PersonnelOut])
def list_personnel(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    service: str | None = None,
    department: str | None = None,
    shop: str | None = None,
    division: str | None = None,
    organisation: str | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Personnel).options(selectinload(Personnel.user))
    if is_deleted is None:
        if not include_deleted:
            query = query.where(Personnel.is_deleted == False)
    else:
        query = query.where(Personnel.is_deleted == is_deleted)
    if service:
        query = query.where(Personnel.service == service)
    if department:
        query = query.where(Personnel.department == department)
    if shop:
        query = query.where(Personnel.shop == shop)
    if division:
        query = query.where(Personnel.division == division)
    if organisation:
        query = query.where(Personnel.organisation == organisation)

    query = apply_search(
        query,
        q,
        [
            Personnel.first_name,
            Personnel.last_name,
            Personnel.middle_name,
            Personnel.position,
            Personnel.personnel_number,
        ],
    )
    query = apply_date_filters(query, Personnel, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, Personnel, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{person_id}", response_model=PersonnelOut)
def get_personnel(
    person_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = (
        select(Personnel)
        .where(Personnel.id == person_id)
        .options(
            selectinload(Personnel.user),
            selectinload(Personnel.competencies),
            selectinload(Personnel.trainings),
        )
    )
    if not include_deleted:
        query = query.where(Personnel.is_deleted == False)
    personnel = db.scalar(query)
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    if not include_deleted:
        personnel.competencies = [c for c in personnel.competencies if not c.is_deleted]
        personnel.trainings = [t for t in personnel.trainings if not t.is_deleted]
    return personnel


@router.post("/", response_model=PersonnelOut)
def create_personnel(
    payload: PersonnelCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    personnel = Personnel(**payload.model_dump())
    db.add(personnel)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="personnel",
        entity_id=personnel.id,
        before=None,
        after=model_to_dict(personnel),
    )

    db.commit()
    db.refresh(personnel)
    return personnel


@router.patch("/{person_id}", response_model=PersonnelOut)
def update_personnel(
    person_id: int,
    payload: PersonnelUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    personnel = db.scalar(select(Personnel).where(Personnel.id == person_id))
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")

    before = model_to_dict(personnel)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(personnel, key, value)

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="personnel",
        entity_id=personnel.id,
        before=before,
        after=model_to_dict(personnel),
    )

    db.commit()
    db.refresh(personnel)
    return personnel


@router.delete("/{person_id}")
def delete_personnel(
    person_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    personnel = db.scalar(select(Personnel).where(Personnel.id == person_id))
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")

    before = model_to_dict(personnel)
    personnel.is_deleted = True
    personnel.deleted_at = datetime.utcnow()
    personnel.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="personnel",
        entity_id=personnel.id,
        before=before,
        after=model_to_dict(personnel),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{person_id}/restore", response_model=PersonnelOut)
def restore_personnel(
    person_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    personnel = db.scalar(select(Personnel).where(Personnel.id == person_id))
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")

    before = model_to_dict(personnel)
    personnel.is_deleted = False
    personnel.deleted_at = None
    personnel.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="personnel",
        entity_id=personnel.id,
        before=before,
        after=model_to_dict(personnel),
    )

    db.commit()
    db.refresh(personnel)
    return personnel


@router.post("/{person_id}/competencies", response_model=PersonnelCompetencyOut)
def create_competency(
    person_id: int,
    payload: PersonnelCompetencyCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    ensure_personnel(db, person_id)
    competency = PersonnelCompetency(personnel_id=person_id, **payload.model_dump())
    db.add(competency)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="personnel_competencies",
        entity_id=competency.id,
        before=None,
        after=model_to_dict(competency),
    )

    db.commit()
    db.refresh(competency)
    return competency


@router.patch("/{person_id}/competencies/{competency_id}", response_model=PersonnelCompetencyOut)
def update_competency(
    person_id: int,
    competency_id: int,
    payload: PersonnelCompetencyUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    competency = db.scalar(
        select(PersonnelCompetency).where(
            PersonnelCompetency.id == competency_id,
            PersonnelCompetency.personnel_id == person_id,
        )
    )
    if not competency:
        raise HTTPException(status_code=404, detail="Competency not found")

    before = model_to_dict(competency)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(competency, key, value)

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="personnel_competencies",
        entity_id=competency.id,
        before=before,
        after=model_to_dict(competency),
    )

    db.commit()
    db.refresh(competency)
    return competency


@router.delete("/{person_id}/competencies/{competency_id}")
def delete_competency(
    person_id: int,
    competency_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    competency = db.scalar(
        select(PersonnelCompetency).where(
            PersonnelCompetency.id == competency_id,
            PersonnelCompetency.personnel_id == person_id,
        )
    )
    if not competency:
        raise HTTPException(status_code=404, detail="Competency not found")

    before = model_to_dict(competency)
    competency.is_deleted = True
    competency.deleted_at = datetime.utcnow()
    competency.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="personnel_competencies",
        entity_id=competency.id,
        before=before,
        after=model_to_dict(competency),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{person_id}/competencies/{competency_id}/restore", response_model=PersonnelCompetencyOut)
def restore_competency(
    person_id: int,
    competency_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    competency = db.scalar(
        select(PersonnelCompetency).where(
            PersonnelCompetency.id == competency_id,
            PersonnelCompetency.personnel_id == person_id,
        )
    )
    if not competency:
        raise HTTPException(status_code=404, detail="Competency not found")

    before = model_to_dict(competency)
    competency.is_deleted = False
    competency.deleted_at = None
    competency.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="personnel_competencies",
        entity_id=competency.id,
        before=before,
        after=model_to_dict(competency),
    )

    db.commit()
    db.refresh(competency)
    return competency


@router.post("/{person_id}/trainings", response_model=PersonnelTrainingOut)
def create_training(
    person_id: int,
    payload: PersonnelTrainingCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    ensure_personnel(db, person_id)
    training = PersonnelTraining(personnel_id=person_id, **payload.model_dump())
    db.add(training)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="personnel_trainings",
        entity_id=training.id,
        before=None,
        after=model_to_dict(training),
    )

    db.commit()
    db.refresh(training)
    return training


@router.patch("/{person_id}/trainings/{training_id}", response_model=PersonnelTrainingOut)
def update_training(
    person_id: int,
    training_id: int,
    payload: PersonnelTrainingUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    training = db.scalar(
        select(PersonnelTraining).where(
            PersonnelTraining.id == training_id,
            PersonnelTraining.personnel_id == person_id,
        )
    )
    if not training:
        raise HTTPException(status_code=404, detail="Training not found")

    before = model_to_dict(training)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(training, key, value)

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="personnel_trainings",
        entity_id=training.id,
        before=before,
        after=model_to_dict(training),
    )

    db.commit()
    db.refresh(training)
    return training


@router.delete("/{person_id}/trainings/{training_id}")
def delete_training(
    person_id: int,
    training_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    training = db.scalar(
        select(PersonnelTraining).where(
            PersonnelTraining.id == training_id,
            PersonnelTraining.personnel_id == person_id,
        )
    )
    if not training:
        raise HTTPException(status_code=404, detail="Training not found")

    before = model_to_dict(training)
    training.is_deleted = True
    training.deleted_at = datetime.utcnow()
    training.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="personnel_trainings",
        entity_id=training.id,
        before=before,
        after=model_to_dict(training),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{person_id}/trainings/{training_id}/restore", response_model=PersonnelTrainingOut)
def restore_training(
    person_id: int,
    training_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    training = db.scalar(
        select(PersonnelTraining).where(
            PersonnelTraining.id == training_id,
            PersonnelTraining.personnel_id == person_id,
        )
    )
    if not training:
        raise HTTPException(status_code=404, detail="Training not found")

    before = model_to_dict(training)
    training.is_deleted = False
    training.deleted_at = None
    training.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="personnel_trainings",
        entity_id=training.id,
        before=before,
        after=model_to_dict(training),
    )

    db.commit()
    db.refresh(training)
    return training


@router.get("/{person_id}/attachments")
def list_personnel_attachments(
    person_id: int,
    entity: str = "personnel",
    entity_id: int | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    ensure_personnel(db, person_id, include_deleted=True)
    if entity != "personnel":
        if not entity_id:
            raise HTTPException(status_code=400, detail="entity_id is required for nested attachments")
        if entity == "personnel_competency":
            competency = db.scalar(
                select(PersonnelCompetency).where(
                    PersonnelCompetency.id == entity_id, PersonnelCompetency.personnel_id == person_id
                )
            )
            if not competency:
                raise HTTPException(status_code=404, detail="Competency not found")
        elif entity == "personnel_training":
            training = db.scalar(
                select(PersonnelTraining).where(
                    PersonnelTraining.id == entity_id, PersonnelTraining.personnel_id == person_id
                )
            )
            if not training:
                raise HTTPException(status_code=404, detail="Training not found")
        else:
            raise HTTPException(status_code=400, detail="Unsupported entity")
    else:
        entity_id = person_id

    query = select(Attachment).where(Attachment.entity == entity, Attachment.entity_id == entity_id)
    if not include_deleted:
        query = query.where(Attachment.is_deleted == False)
    attachments = db.scalars(query.order_by(Attachment.id)).all()
    return attachments


@router.get("/attachments/{attachment_id}")
def download_attachment(
    attachment_id: int,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    attachment = db.scalar(select(Attachment).where(Attachment.id == attachment_id))
    if not attachment or attachment.is_deleted:
        raise HTTPException(status_code=404, detail="Attachment not found")
    file_path = Path(attachment.storage_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=str(file_path), filename=attachment.filename, media_type=attachment.content_type)


@router.post("/{person_id}/attachments")
def upload_attachment(
    person_id: int,
    entity: str = "personnel",
    entity_id: int | None = None,
    file: UploadFile = File(...),
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    ensure_personnel(db, person_id)
    if entity != "personnel":
        if not entity_id:
            raise HTTPException(status_code=400, detail="entity_id is required for nested attachments")
        if entity == "personnel_competency":
            competency = db.scalar(
                select(PersonnelCompetency).where(
                    PersonnelCompetency.id == entity_id, PersonnelCompetency.personnel_id == person_id
                )
            )
            if not competency:
                raise HTTPException(status_code=404, detail="Competency not found")
        elif entity == "personnel_training":
            training = db.scalar(
                select(PersonnelTraining).where(
                    PersonnelTraining.id == entity_id, PersonnelTraining.personnel_id == person_id
                )
            )
            if not training:
                raise HTTPException(status_code=404, detail="Training not found")
        else:
            raise HTTPException(status_code=400, detail="Unsupported entity")
    else:
        entity_id = person_id

    if not file.content_type or file.content_type not in ALLOWED_ATTACHMENT_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file type")

    contents = file.file.read()
    if len(contents) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid4().hex}_{Path(file.filename).name}"
    storage_path = upload_dir / safe_name
    storage_path.write_bytes(contents)

    attachment = Attachment(
        entity=entity,
        entity_id=entity_id,
        filename=file.filename,
        content_type=file.content_type,
        size_bytes=len(contents),
        storage_path=str(storage_path),
        uploaded_by_id=current_user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment
