from calendar import monthrange
from datetime import date, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.access import require_space_access
from app.core.dependencies import get_db
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.core import (
    Personnel,
    PersonnelCompetency,
    PersonnelScheduleTemplate,
    PersonnelTraining,
    PersonnelYearlyScheduleAssignment,
    PersonnelYearlyScheduleEvent,
)
from app.models.attachments import Attachment
from app.models.security import SpaceKey, User
from app.schemas.common import Pagination
from app.schemas.personnel import (
    DeleteYearlyScheduleEventRequest,
    MonthFillYearlyScheduleRequest,
    PersonnelOut,
    PersonnelCreate,
    PersonnelUpdate,
    PersonnelCompetencyCreate,
    PersonnelCompetencyUpdate,
    PersonnelCompetencyOut,
    PersonnelScheduleTemplateOut,
    PersonnelTrainingCreate,
    PersonnelTrainingUpdate,
    PersonnelTrainingOut,
    PersonnelYearlyScheduleAssignmentOut,
    PersonnelYearlyScheduleEventOut,
    PersonnelYearlyScheduleResponse,
    SCHEDULE_STATUSES,
    UpdateYearlyScheduleStatusesRequest,
    UpsertYearlyScheduleEventRequest,
    YearlyScheduleEmployeeOut,
    YearlyScheduleEmployeeSummary,
    YearlyScheduleSummaryResponse,
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
    personnel = db.scalar(select(Personnel).where(Personnel.id == person_id))
    if not personnel or (not include_deleted and personnel.is_deleted):
        raise HTTPException(status_code=404, detail="Personnel not found")
    return personnel


def ensure_schedule_template(db, schedule_template_id: int | None) -> PersonnelScheduleTemplate | None:
    if schedule_template_id is None:
        return None
    template = db.scalar(select(PersonnelScheduleTemplate).where(PersonnelScheduleTemplate.id == schedule_template_id))
    if not template or template.is_deleted:
        raise HTTPException(status_code=404, detail="Schedule template not found")
    return template


def validate_schedule_status(value: str) -> str:
    if value not in SCHEDULE_STATUSES:
        raise HTTPException(status_code=422, detail="Unsupported schedule status")
    return value


def ensure_year_matches(work_date: date, year: int) -> None:
    if work_date.year != year:
        raise HTTPException(status_code=422, detail="Date is outside the requested year")


def build_full_name(personnel: Personnel) -> str:
    return " ".join(
        part for part in [personnel.last_name, personnel.first_name, personnel.middle_name] if part
    )


def empty_status_counters() -> dict[str, int]:
    return {status_code: 0 for status_code in SCHEDULE_STATUSES}


def accumulate_summary(
    rows: list[tuple[int, int, str]],
) -> tuple[dict[str, int], dict[str, YearlyScheduleEmployeeSummary]]:
    global_summary = empty_status_counters()
    employees: dict[str, YearlyScheduleEmployeeSummary] = {}

    for personnel_id, month, status_code in rows:
        if status_code not in global_summary:
            continue
        global_summary[status_code] += 1
        employee_key = str(personnel_id)
        employee_summary = employees.setdefault(
            employee_key,
            YearlyScheduleEmployeeSummary(year=empty_status_counters(), months={}),
        )
        employee_summary.year[status_code] += 1
        month_key = str(month - 1)
        month_summary = employee_summary.months.setdefault(month_key, empty_status_counters())
        month_summary[status_code] += 1

    return global_summary, employees


@router.get("/schedule-templates", response_model=list[PersonnelScheduleTemplateOut])
def list_schedule_templates(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    query = select(PersonnelScheduleTemplate)
    if not include_deleted:
        query = query.where(PersonnelScheduleTemplate.is_deleted == False)
    return db.scalars(query.order_by(PersonnelScheduleTemplate.label)).all()


@router.get("/schedules/yearly", response_model=PersonnelYearlyScheduleResponse)
def get_yearly_schedule(
    year: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    personnel_query = (
        select(Personnel)
        .options(selectinload(Personnel.schedule_template))
        .order_by(Personnel.last_name, Personnel.first_name, Personnel.middle_name)
    )
    if not include_deleted:
        personnel_query = personnel_query.where(Personnel.is_deleted == False)
    personnel_items = db.scalars(personnel_query).all()

    assignments_query = select(PersonnelYearlyScheduleAssignment).where(
        PersonnelYearlyScheduleAssignment.year == year
    )
    events_query = select(PersonnelYearlyScheduleEvent).where(PersonnelYearlyScheduleEvent.year == year)
    if not include_deleted:
        assignments_query = assignments_query.where(PersonnelYearlyScheduleAssignment.is_deleted == False)
        events_query = events_query.where(PersonnelYearlyScheduleEvent.is_deleted == False)

    assignments = db.scalars(assignments_query.order_by(PersonnelYearlyScheduleAssignment.work_date)).all()
    events = db.scalars(events_query.order_by(PersonnelYearlyScheduleEvent.work_date)).all()

    return PersonnelYearlyScheduleResponse(
        year=year,
        employees=[
            YearlyScheduleEmployeeOut(
                id=item.id,
                full_name=build_full_name(item),
                schedule_label=item.schedule_label,
                schedule_template_id=item.schedule_template_id,
                is_deleted=item.is_deleted,
            )
            for item in personnel_items
        ],
        assignments=[
            PersonnelYearlyScheduleAssignmentOut(
                personnel_id=item.personnel_id,
                iso_date=item.work_date,
                status=item.status,
            )
            for item in assignments
        ],
        events=[
            PersonnelYearlyScheduleEventOut(
                personnel_id=item.personnel_id,
                iso_date=item.work_date,
                label=item.label,
            )
            for item in events
        ],
    )


@router.get("/schedules/yearly/summary", response_model=YearlyScheduleSummaryResponse)
def get_yearly_schedule_summary(
    year: int,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    rows = db.execute(
        select(
            PersonnelYearlyScheduleAssignment.personnel_id,
            func.extract("month", PersonnelYearlyScheduleAssignment.work_date),
            PersonnelYearlyScheduleAssignment.status,
        ).where(
            PersonnelYearlyScheduleAssignment.year == year,
            PersonnelYearlyScheduleAssignment.is_deleted == False,
        )
    ).all()
    normalized_rows = [(int(personnel_id), int(month), status_code) for personnel_id, month, status_code in rows]
    global_summary, employees = accumulate_summary(normalized_rows)
    return YearlyScheduleSummaryResponse.model_validate({"global": global_summary, "employees": employees})


@router.patch("/schedules/yearly/statuses", response_model=list[PersonnelYearlyScheduleAssignmentOut])
def update_yearly_schedule_statuses(
    payload: UpdateYearlyScheduleStatusesRequest,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    updated_records: list[PersonnelYearlyScheduleAssignment] = []

    for operation in payload.operations:
        validate_schedule_status(operation.status)
        ensure_personnel(db, operation.personnel_id)
        if operation.to_date < operation.from_date:
            raise HTTPException(status_code=422, detail="to_date must be greater than or equal to from_date")
        ensure_year_matches(operation.from_date, payload.year)
        clipped_to_date = min(operation.to_date, date(payload.year, 12, 31))

        current_date = operation.from_date
        while current_date <= clipped_to_date:
            existing = db.scalar(
                select(PersonnelYearlyScheduleAssignment).where(
                    PersonnelYearlyScheduleAssignment.personnel_id == operation.personnel_id,
                    PersonnelYearlyScheduleAssignment.work_date == current_date,
                )
            )
            if existing:
                before = model_to_dict(existing)
                existing.year = payload.year
                existing.status = operation.status
                existing.is_deleted = False
                existing.deleted_at = None
                existing.deleted_by_id = None
                updated_records.append(existing)
                add_audit_log(
                    db,
                    actor_id=current_user.id,
                    action="UPDATE",
                    entity="personnel_yearly_schedule_assignments",
                    entity_id=existing.id,
                    before=before,
                    after=model_to_dict(existing),
                )
            else:
                assignment = PersonnelYearlyScheduleAssignment(
                    personnel_id=operation.personnel_id,
                    year=payload.year,
                    work_date=current_date,
                    status=operation.status,
                    is_deleted=False,
                )
                db.add(assignment)
                db.flush()
                updated_records.append(assignment)
                add_audit_log(
                    db,
                    actor_id=current_user.id,
                    action="CREATE",
                    entity="personnel_yearly_schedule_assignments",
                    entity_id=assignment.id,
                    before=None,
                    after=model_to_dict(assignment),
                )
            current_date += timedelta(days=1)

    db.commit()
    return [
        PersonnelYearlyScheduleAssignmentOut(
            personnel_id=item.personnel_id,
            iso_date=item.work_date,
            status=item.status,
        )
        for item in updated_records
    ]


@router.patch("/schedules/yearly/month-fill", response_model=list[PersonnelYearlyScheduleAssignmentOut])
def fill_yearly_schedule_month(
    payload: MonthFillYearlyScheduleRequest,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    validate_schedule_status(payload.status)
    ensure_personnel(db, payload.personnel_id)
    day_count = monthrange(payload.year, payload.month + 1)[1]
    start_date = date(payload.year, payload.month + 1, 1)
    end_date = date(payload.year, payload.month + 1, day_count)
    return update_yearly_schedule_statuses(
        UpdateYearlyScheduleStatusesRequest(
            year=payload.year,
            operations=[
                {
                    "personnel_id": payload.personnel_id,
                    "from_date": start_date,
                    "to_date": end_date,
                    "status": payload.status,
                }
            ],
        ),
        db,
        current_user,
    )


@router.put("/schedules/yearly/event", response_model=PersonnelYearlyScheduleEventOut)
def upsert_yearly_schedule_event(
    payload: UpsertYearlyScheduleEventRequest,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    ensure_personnel(db, payload.personnel_id)
    ensure_year_matches(payload.iso_date, payload.year)
    normalized_label = payload.label.strip()
    if not normalized_label:
        raise HTTPException(status_code=422, detail="Event label cannot be empty")

    event = db.scalar(
        select(PersonnelYearlyScheduleEvent).where(
            PersonnelYearlyScheduleEvent.personnel_id == payload.personnel_id,
            PersonnelYearlyScheduleEvent.work_date == payload.iso_date,
        )
    )
    if event:
        before = model_to_dict(event)
        event.year = payload.year
        event.label = normalized_label
        event.is_deleted = False
        event.deleted_at = None
        event.deleted_by_id = None
        add_audit_log(
            db,
            actor_id=current_user.id,
            action="UPDATE",
            entity="personnel_yearly_schedule_events",
            entity_id=event.id,
            before=before,
            after=model_to_dict(event),
        )
    else:
        event = PersonnelYearlyScheduleEvent(
            personnel_id=payload.personnel_id,
            year=payload.year,
            work_date=payload.iso_date,
            label=normalized_label,
            is_deleted=False,
        )
        db.add(event)
        db.flush()
        add_audit_log(
            db,
            actor_id=current_user.id,
            action="CREATE",
            entity="personnel_yearly_schedule_events",
            entity_id=event.id,
            before=None,
            after=model_to_dict(event),
        )
    db.commit()
    return PersonnelYearlyScheduleEventOut(
        personnel_id=event.personnel_id,
        iso_date=event.work_date,
        label=event.label,
    )


@router.delete("/schedules/yearly/event")
def delete_yearly_schedule_event(
    payload: DeleteYearlyScheduleEventRequest,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    ensure_personnel(db, payload.personnel_id)
    ensure_year_matches(payload.iso_date, payload.year)
    event = db.scalar(
        select(PersonnelYearlyScheduleEvent).where(
            PersonnelYearlyScheduleEvent.personnel_id == payload.personnel_id,
            PersonnelYearlyScheduleEvent.work_date == payload.iso_date,
            PersonnelYearlyScheduleEvent.is_deleted == False,
        )
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    before = model_to_dict(event)
    event.is_deleted = True
    event.deleted_at = datetime.utcnow()
    event.deleted_by_id = current_user.id
    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="personnel_yearly_schedule_events",
        entity_id=event.id,
        before=before,
        after=model_to_dict(event),
    )
    db.commit()
    return {"status": "ok"}


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
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    query = select(Personnel).options(selectinload(Personnel.user), selectinload(Personnel.schedule_template))
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
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    query = (
        select(Personnel)
        .where(Personnel.id == person_id)
        .options(
            selectinload(Personnel.user),
            selectinload(Personnel.schedule_template),
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    ensure_schedule_template(db, payload.schedule_template_id)
    personnel = Personnel(is_deleted=False, **payload.model_dump())
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    personnel = db.scalar(select(Personnel).where(Personnel.id == person_id))
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")

    before = model_to_dict(personnel)
    data = payload.model_dump(exclude_unset=True)
    if "schedule_template_id" in data:
        ensure_schedule_template(db, data["schedule_template_id"])
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    ensure_personnel(db, person_id)
    competency = PersonnelCompetency(personnel_id=person_id, is_deleted=False, **payload.model_dump())
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    ensure_personnel(db, person_id)
    training = PersonnelTraining(personnel_id=person_id, is_deleted=False, **payload.model_dump())
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
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
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    attachment = db.scalar(select(Attachment).where(Attachment.id == attachment_id))
    if not attachment or attachment.is_deleted:
        raise HTTPException(status_code=404, detail="Attachment not found")
    file_path = Path(attachment.storage_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=str(file_path), filename=attachment.filename, media_type=attachment.content_type)


@router.delete("/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    attachment = db.scalar(select(Attachment).where(Attachment.id == attachment_id))
    if not attachment or attachment.is_deleted:
        raise HTTPException(status_code=404, detail="Attachment not found")

    attachment.is_deleted = True
    attachment.deleted_at = datetime.utcnow()
    attachment.deleted_by_id = current_user.id
    db.commit()
    return {"status": "ok"}

@router.post("/{person_id}/attachments")
def upload_attachment(
    person_id: int,
    entity: str = "personnel",
    entity_id: int | None = None,
    file: UploadFile = File(...),
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
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
