from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.access import require_space_access
from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db
from app.core.pagination import paginate
from app.core.query import apply_date_filters, apply_search, apply_sort
from app.models.core import Location, MainEquipment, TechnologicalEquipment
from app.models.security import SpaceKey, User
from app.schemas.common import Pagination
from app.schemas.technological_equipment import (
    TechnologicalEquipmentCreate,
    TechnologicalEquipmentOut,
    TechnologicalEquipmentUpdate,
)

router = APIRouter()

VALVE_ROOT_NAME = "Запорно-регулирующая арматура"
VALVE_CONSTRUCTION_BRANCH_NAME = "По конструкции"
VALVE_DRIVE_BRANCH_NAME = "По типу привода"


class MainEquipmentValidationContext:
    def __init__(self, items: list[MainEquipment]):
        self.items_by_id = {item.id: item for item in items}
        self.children_by_parent_id: dict[int | None, list[MainEquipment]] = {}
        for item in items:
            self.children_by_parent_id.setdefault(item.parent_id, []).append(item)

        self.valve_root = next((item for item in items if item.name == VALVE_ROOT_NAME), None)
        self.valve_construction_branch = self._find_named_child(
            self.valve_root.id if self.valve_root else None,
            VALVE_CONSTRUCTION_BRANCH_NAME,
        )
        self.valve_drive_branch = self._find_named_child(
            self.valve_root.id if self.valve_root else None,
            VALVE_DRIVE_BRANCH_NAME,
        )

    def _find_named_child(self, parent_id: int | None, name: str) -> MainEquipment | None:
        if parent_id is None:
            return None
        for child in self.children_by_parent_id.get(parent_id, []):
            if child.name == name:
                return child
        return None

    def get(self, item_id: int | None) -> MainEquipment | None:
        if item_id is None:
            return None
        return self.items_by_id.get(item_id)

    def is_leaf(self, item_id: int) -> bool:
        return len(self.children_by_parent_id.get(item_id, [])) == 0

    def is_descendant_of(self, item_id: int, ancestor_id: int | None) -> bool:
        if ancestor_id is None:
            return False
        current = self.items_by_id.get(item_id)
        seen: set[int] = set()
        while current and current.id not in seen:
            if current.id == ancestor_id:
                return True
            seen.add(current.id)
            current = self.items_by_id.get(current.parent_id)
        return False

    def full_path(self, item_id: int | None) -> str | None:
        item = self.get(item_id)
        if not item:
            return None
        return item.full_path()


def _base_query():
    return select(TechnologicalEquipment).options(
        selectinload(TechnologicalEquipment.main_equipment),
        selectinload(TechnologicalEquipment.main_equipment_drive),
        selectinload(TechnologicalEquipment.location),
    )


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _load_main_equipment_context(db) -> MainEquipmentValidationContext:
    items = db.scalars(
        select(MainEquipment).where(MainEquipment.is_deleted == False)
    ).all()
    return MainEquipmentValidationContext(items)


def _validate_main_equipment_selection(
    context: MainEquipmentValidationContext,
    main_equipment_id: int,
    main_equipment_drive_id: int | None,
) -> tuple[MainEquipment, MainEquipment | None]:
    main_equipment = context.get(main_equipment_id)
    if not main_equipment:
        raise HTTPException(status_code=404, detail="Main equipment type not found")
    if not context.is_leaf(main_equipment_id):
        raise HTTPException(status_code=400, detail="Main equipment type must be a leaf item")

    valve_root = context.valve_root
    construction_branch = context.valve_construction_branch
    drive_branch = context.valve_drive_branch

    if valve_root and (
        context.is_descendant_of(main_equipment_id, valve_root.id)
        or (main_equipment_drive_id is not None)
    ) and (construction_branch is None or drive_branch is None):
        raise HTTPException(
            status_code=400,
            detail=(
                "Main equipment tree is misconfigured for "
                f"'{VALVE_ROOT_NAME}'. Expected branches "
                f"'{VALVE_CONSTRUCTION_BRANCH_NAME}' and '{VALVE_DRIVE_BRANCH_NAME}'."
            ),
        )

    if drive_branch and context.is_descendant_of(main_equipment_id, drive_branch.id):
        raise HTTPException(
            status_code=400,
            detail=(
                "Select the valve type from the "
                f"'{VALVE_CONSTRUCTION_BRANCH_NAME}' branch."
            ),
        )

    is_valve_type = bool(
        construction_branch and context.is_descendant_of(main_equipment_id, construction_branch.id)
    )

    drive_item = context.get(main_equipment_drive_id)
    if is_valve_type:
        if main_equipment_drive_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Valve drive type is required for "
                    f"'{VALVE_ROOT_NAME}'."
                ),
            )
        if not drive_item:
            raise HTTPException(status_code=404, detail="Valve drive type not found")
        if not context.is_leaf(main_equipment_drive_id):
            raise HTTPException(status_code=400, detail="Valve drive type must be a leaf item")
        if not drive_branch or not context.is_descendant_of(main_equipment_drive_id, drive_branch.id):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Valve drive type must be selected from the "
                    f"'{VALVE_DRIVE_BRANCH_NAME}' branch."
                ),
            )
        return main_equipment, drive_item

    if main_equipment_drive_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Valve drive type can only be set for valve equipment",
        )
    return main_equipment, None


def _resolve_location(db, location_id: int | None) -> Location | None:
    if location_id is None:
        return None
    location = db.scalar(
        select(Location).where(
            Location.id == location_id,
            Location.is_deleted == False,
        )
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


def _build_type_display(
    context: MainEquipmentValidationContext,
    main_equipment_id: int | None,
    main_equipment_drive_id: int | None,
) -> str | None:
    main_equipment = context.get(main_equipment_id)
    if not main_equipment:
        return None
    if (
        context.valve_root
        and context.valve_construction_branch
        and main_equipment_drive_id is not None
        and context.is_descendant_of(main_equipment.id, context.valve_construction_branch.id)
    ):
        drive = context.get(main_equipment_drive_id)
        if drive:
            return f"{context.valve_root.name} / {main_equipment.name} / {drive.name}"
    return context.full_path(main_equipment.id)


def _serialize_item(
    item: TechnologicalEquipment,
    context: MainEquipmentValidationContext,
) -> dict:
    return {
        "id": item.id,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "is_deleted": item.is_deleted,
        "deleted_at": item.deleted_at,
        "name": item.name,
        "main_equipment_id": item.main_equipment_id,
        "main_equipment_name": item.main_equipment.name if item.main_equipment else None,
        "main_equipment_drive_id": item.main_equipment_drive_id,
        "main_equipment_full_path": context.full_path(item.main_equipment_id),
        "main_equipment_drive_full_path": context.full_path(item.main_equipment_drive_id),
        "type_display": _build_type_display(
            context,
            item.main_equipment_id,
            item.main_equipment_drive_id,
        ),
        "tag": item.tag,
        "location_id": item.location_id,
        "location_name": item.location.name if item.location else None,
        "location_path": item.location.full_path() if item.location else None,
        "description": item.description,
    }


@router.get("/", response_model=Pagination[TechnologicalEquipmentOut])
def list_technological_equipment(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    main_equipment_id: int | None = None,
    location_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.equipment, "read")),
):
    query = _base_query()
    context = _load_main_equipment_context(db)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(TechnologicalEquipment.is_deleted == False)
    else:
        query = query.where(TechnologicalEquipment.is_deleted == is_deleted)
    if main_equipment_id is not None:
        query = query.where(TechnologicalEquipment.main_equipment_id == main_equipment_id)
    if location_id is not None:
        query = query.where(TechnologicalEquipment.location_id == location_id)

    query = apply_search(
        query,
        q,
        [
            TechnologicalEquipment.name,
            TechnologicalEquipment.tag,
            TechnologicalEquipment.description,
        ],
    )
    query = apply_date_filters(
        query,
        TechnologicalEquipment,
        created_at_from,
        created_at_to,
        updated_at_from,
        updated_at_to,
    )
    query = apply_sort(query, TechnologicalEquipment, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(
        items=[_serialize_item(item, context) for item in items],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{item_id}", response_model=TechnologicalEquipmentOut)
def get_technological_equipment(
    item_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.equipment, "read")),
):
    query = _base_query().where(TechnologicalEquipment.id == item_id)
    if not include_deleted:
        query = query.where(TechnologicalEquipment.is_deleted == False)
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="Technological equipment not found")
    return _serialize_item(item, _load_main_equipment_context(db))


@router.post("/", response_model=TechnologicalEquipmentOut)
def create_technological_equipment(
    payload: TechnologicalEquipmentCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    context = _load_main_equipment_context(db)
    _validate_main_equipment_selection(
        context,
        payload.main_equipment_id,
        payload.main_equipment_drive_id,
    )
    _resolve_location(db, payload.location_id)

    item = TechnologicalEquipment(
        name=payload.name.strip(),
        main_equipment_id=payload.main_equipment_id,
        main_equipment_drive_id=payload.main_equipment_drive_id,
        tag=_normalize_text(payload.tag),
        location_id=payload.location_id,
        description=_normalize_text(payload.description),
    )
    db.add(item)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="technological_equipment",
        entity_id=item.id,
        before=None,
        after=model_to_dict(item),
    )

    db.commit()
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item.id))
    return _serialize_item(item, context)


@router.patch("/{item_id}", response_model=TechnologicalEquipmentOut)
def update_technological_equipment(
    item_id: int,
    payload: TechnologicalEquipmentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Technological equipment not found")

    before = model_to_dict(item)
    data = payload.model_dump(exclude_unset=True)
    context = _load_main_equipment_context(db)
    next_main_equipment_id = data.get("main_equipment_id", item.main_equipment_id)
    next_main_equipment_drive_id = (
        data["main_equipment_drive_id"]
        if "main_equipment_drive_id" in data
        else item.main_equipment_drive_id
    )
    _validate_main_equipment_selection(
        context,
        next_main_equipment_id,
        next_main_equipment_drive_id,
    )

    if payload.name is not None:
        item.name = payload.name.strip()
    if payload.main_equipment_id is not None:
        item.main_equipment_id = payload.main_equipment_id
    if "main_equipment_drive_id" in data:
        item.main_equipment_drive_id = data.get("main_equipment_drive_id")
    if "tag" in data:
        item.tag = _normalize_text(data.get("tag"))
    if "location_id" in data:
        _resolve_location(db, data.get("location_id"))
        item.location_id = data.get("location_id")
    if "description" in data:
        item.description = _normalize_text(data.get("description"))

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="technological_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item.id))
    return _serialize_item(item, context)


@router.put("/{item_id}", response_model=TechnologicalEquipmentOut)
def update_technological_equipment_legacy(
    item_id: int,
    payload: TechnologicalEquipmentUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    return update_technological_equipment(item_id, payload, db, current_user)


@router.delete("/{item_id}")
def delete_technological_equipment(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    item = db.scalar(select(TechnologicalEquipment).where(TechnologicalEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Technological equipment not found")

    before = model_to_dict(item)
    item.is_deleted = True
    item.deleted_at = datetime.utcnow()
    item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="technological_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{item_id}/restore", response_model=TechnologicalEquipmentOut)
def restore_technological_equipment(
    item_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.equipment, "write")),
):
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Technological equipment not found")

    before = model_to_dict(item)
    item.is_deleted = False
    item.deleted_at = None
    item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="technological_equipment",
        entity_id=item.id,
        before=before,
        after=model_to_dict(item),
    )

    db.commit()
    item = db.scalar(_base_query().where(TechnologicalEquipment.id == item.id))
    return _serialize_item(item, _load_main_equipment_context(db))
