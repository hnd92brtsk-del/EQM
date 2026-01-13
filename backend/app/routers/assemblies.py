from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_search, apply_sort, apply_date_filters
from app.core.audit import add_audit_log, model_to_dict
from app.models.assemblies import Assembly
from app.models.core import Location
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.assemblies import AssemblyOut, AssemblyCreate, AssemblyUpdate

router = APIRouter()


def build_location_full_path(location_id: int | None, locations_map: dict[int, Location]) -> str | None:
    if not location_id or location_id not in locations_map:
        return None
    parts: list[str] = []
    current_id: int | None = location_id
    seen: set[int] = set()
    while current_id and current_id in locations_map and current_id not in seen:
        location = locations_map[current_id]
        parts.append(location.name)
        seen.add(current_id)
        current_id = location.parent_id
    return " / ".join(reversed(parts))


def attach_location_full_path(items: list[Assembly], db) -> None:
    locations = db.scalars(select(Location)).all()
    locations_map = {loc.id: loc for loc in locations}
    for item in items:
        item.location_full_path = build_location_full_path(item.location_id, locations_map)


@router.get("/", response_model=Pagination[AssemblyOut])
def list_assemblies(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    location_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Assembly)
    if is_deleted is None:
        if not include_deleted:
            query = query.where(Assembly.is_deleted == False)
    else:
        query = query.where(Assembly.is_deleted == is_deleted)
    if location_id is not None:
        query = query.where(Assembly.location_id == location_id)

    query = apply_search(query, q, [Assembly.name])
    query = apply_date_filters(query, Assembly, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, Assembly, sort)

    total, items = paginate(query, db, page, page_size)
    attach_location_full_path(items, db)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/{assembly_id}", response_model=AssemblyOut)
def get_assembly(
    assembly_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Assembly).where(Assembly.id == assembly_id)
    if not include_deleted:
        query = query.where(Assembly.is_deleted == False)
    assembly = db.scalar(query)
    if not assembly:
        raise HTTPException(status_code=404, detail="Assembly not found")
    attach_location_full_path([assembly], db)
    return assembly


@router.post("/", response_model=AssemblyOut)
def create_assembly(
    payload: AssemblyCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    if payload.location_id:
        location = db.scalar(
            select(Location).where(Location.id == payload.location_id, Location.is_deleted == False)
        )
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")

    assembly = Assembly(
        name=payload.name,
        location_id=payload.location_id,
        meta_data=payload.meta_data,
    )
    db.add(assembly)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="assemblies",
        entity_id=assembly.id,
        before=None,
        after=model_to_dict(assembly),
    )

    db.commit()
    db.refresh(assembly)
    attach_location_full_path([assembly], db)
    return assembly


@router.patch("/{assembly_id}", response_model=AssemblyOut)
def update_assembly(
    assembly_id: int,
    payload: AssemblyUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    assembly = db.scalar(select(Assembly).where(Assembly.id == assembly_id))
    if not assembly:
        raise HTTPException(status_code=404, detail="Assembly not found")

    before = model_to_dict(assembly)
    data = payload.model_dump(exclude_unset=True)

    if payload.name is not None:
        assembly.name = payload.name
    if "location_id" in data:
        if data["location_id"]:
            location = db.scalar(
                select(Location).where(Location.id == data["location_id"], Location.is_deleted == False)
            )
            if not location:
                raise HTTPException(status_code=404, detail="Location not found")
        assembly.location_id = data["location_id"]
    if payload.meta_data is not None:
        assembly.meta_data = payload.meta_data

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="assemblies",
        entity_id=assembly.id,
        before=before,
        after=model_to_dict(assembly),
    )

    db.commit()
    db.refresh(assembly)
    attach_location_full_path([assembly], db)
    return assembly


@router.put("/{assembly_id}", response_model=AssemblyOut)
def update_assembly_legacy(
    assembly_id: int,
    payload: AssemblyUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_assembly(assembly_id, payload, db, current_user)


@router.delete("/{assembly_id}")
def delete_assembly(
    assembly_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    assembly = db.scalar(select(Assembly).where(Assembly.id == assembly_id))
    if not assembly:
        raise HTTPException(status_code=404, detail="Assembly not found")

    before = model_to_dict(assembly)
    assembly.is_deleted = True
    assembly.deleted_at = datetime.utcnow()
    assembly.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="assemblies",
        entity_id=assembly.id,
        before=before,
        after=model_to_dict(assembly),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{assembly_id}/restore", response_model=AssemblyOut)
def restore_assembly(
    assembly_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    assembly = db.scalar(select(Assembly).where(Assembly.id == assembly_id))
    if not assembly:
        raise HTTPException(status_code=404, detail="Assembly not found")

    before = model_to_dict(assembly)
    assembly.is_deleted = False
    assembly.deleted_at = None
    assembly.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="assemblies",
        entity_id=assembly.id,
        before=before,
        after=model_to_dict(assembly),
    )

    db.commit()
    db.refresh(assembly)
    attach_location_full_path([assembly], db)
    return assembly
