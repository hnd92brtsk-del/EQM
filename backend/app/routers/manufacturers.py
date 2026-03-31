from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.audit import add_audit_log, model_to_dict
from app.core.dependencies import get_db, require_read_access, require_write_access
from app.core.pagination import paginate
from app.core.query import apply_date_filters, apply_search, apply_sort
from app.models.core import Manufacturer
from app.models.security import User
from app.schemas.common import Pagination
from app.schemas.import_export import ImportIssue, ImportReport
from app.schemas.manufacturers import (
    ManufacturerCreate,
    ManufacturerOut,
    ManufacturerTreeNode,
    ManufacturerUpdate,
)
from app.services.tabular_import_export import (
    as_optional_int,
    as_optional_str,
    as_required_str,
    build_export_response,
    build_template_response,
    is_blank_row,
    read_tabular_rows,
    row_to_mapping,
)

router = APIRouter()
MAX_DEPTH = 2


def _normalize_name(value: str) -> str:
    return " ".join(value.split()).strip().casefold()


def build_tree(items: list[Manufacturer]) -> list[ManufacturerTreeNode]:
    nodes = {
        item.id: ManufacturerTreeNode(
            id=item.id,
            name=item.name,
            country=item.country,
            parent_id=item.parent_id,
            full_path=item.full_path,
            flag=item.flag,
            founded_year=item.founded_year,
            segment=item.segment,
            specialization=item.specialization,
            website=item.website,
            is_deleted=item.is_deleted,
            children=[],
        )
        for item in items
    }
    roots: list[ManufacturerTreeNode] = []
    for item in items:
        if item.parent_id and item.parent_id in nodes:
            nodes[item.parent_id].children.append(nodes[item.id])
        else:
            roots.append(nodes[item.id])
    return roots


def ensure_unique_name(db, name: str, parent_id: int | None, exclude_id: int | None = None) -> None:
    query = select(Manufacturer).where(
        Manufacturer.name == name,
        Manufacturer.parent_id == parent_id,
        Manufacturer.is_deleted == False,
    )
    if exclude_id is not None:
        query = query.where(Manufacturer.id != exclude_id)
    if db.scalar(query):
        raise HTTPException(status_code=400, detail="Manufacturer already exists")


def compute_depth(parent: Manufacturer | None) -> int:
    depth = 1
    current = parent
    seen: set[int] = set()
    while current is not None:
        if current.id in seen:
            raise HTTPException(status_code=400, detail="Parent cycle detected")
        seen.add(current.id)
        current = current.parent
        depth += 1
    return depth


def resolve_parent(db, parent_id: int | None, node_id: int | None = None) -> Manufacturer | None:
    if parent_id is None:
        return None
    parent = db.scalar(
        select(Manufacturer)
        .options(selectinload(Manufacturer.parent))
        .where(Manufacturer.id == parent_id, Manufacturer.is_deleted == False)
    )
    if not parent:
        raise HTTPException(status_code=404, detail="Parent manufacturer not found")
    if node_id is not None and parent.id == node_id:
        raise HTTPException(status_code=400, detail="Node cannot be its own parent")
    if parent.parent_id is not None:
        raise HTTPException(status_code=400, detail="Manufacturers support only country -> brand hierarchy")

    current = parent
    seen: set[int] = set()
    while current is not None:
        if current.id in seen or (node_id is not None and current.id == node_id):
            raise HTTPException(status_code=400, detail="Parent cycle detected")
        seen.add(current.id)
        current = current.parent

    if compute_depth(parent) > MAX_DEPTH:
        raise HTTPException(status_code=400, detail="Manufacturer depth exceeds limit")
    return parent


def get_or_create_country_root(db, country_name: str) -> Manufacturer:
    active = db.scalar(
        select(Manufacturer).where(
            Manufacturer.parent_id == None,
            Manufacturer.name == country_name,
            Manufacturer.is_deleted == False,
        )
    )
    if active:
        return active

    deleted = db.scalar(
        select(Manufacturer).where(
            Manufacturer.parent_id == None,
            Manufacturer.name == country_name,
            Manufacturer.is_deleted == True,
        )
    )
    if deleted:
        deleted.is_deleted = False
        deleted.deleted_at = None
        deleted.deleted_by_id = None
        deleted.country = country_name
        return deleted

    root = Manufacturer(name=country_name, country=country_name)
    db.add(root)
    db.flush()
    return root


def collect_subtree_ids(db, root_id: int) -> list[int]:
    items = db.scalars(select(Manufacturer)).all()
    children_map: dict[int | None, list[int]] = {}
    for item in items:
        children_map.setdefault(item.parent_id, []).append(item.id)

    result: list[int] = []
    stack = [root_id]
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(children_map.get(current, []))
    return result


@router.get("/tree", response_model=list[ManufacturerTreeNode])
def get_manufacturers_tree(
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Manufacturer).options(selectinload(Manufacturer.parent))
    if not include_deleted:
        query = query.where(Manufacturer.is_deleted == False)
    items = db.scalars(query.order_by(Manufacturer.parent_id, Manufacturer.country, Manufacturer.name, Manufacturer.id)).all()
    return build_tree(items)


@router.get("/", response_model=Pagination[ManufacturerOut])
def list_manufacturers(
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    sort: str | None = None,
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    parent_id: int | None = None,
    created_at_from: datetime | None = None,
    created_at_to: datetime | None = None,
    updated_at_from: datetime | None = None,
    updated_at_to: datetime | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Manufacturer).options(selectinload(Manufacturer.parent))
    if is_deleted is None:
        if not include_deleted:
            query = query.where(Manufacturer.is_deleted == False)
    else:
        query = query.where(Manufacturer.is_deleted == is_deleted)
    if parent_id is not None:
        query = query.where(Manufacturer.parent_id == parent_id)

    query = apply_search(
        query,
        q,
        [Manufacturer.name, Manufacturer.country, Manufacturer.segment, Manufacturer.specialization, Manufacturer.website],
    )
    query = apply_date_filters(query, Manufacturer, created_at_from, created_at_to, updated_at_from, updated_at_to)
    query = apply_sort(query, Manufacturer, sort)

    total, items = paginate(query, db, page, page_size)
    return Pagination(items=items, page=page, page_size=page_size, total=total)


@router.get("/export")
def export_manufacturers(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    is_deleted: bool | None = None,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Manufacturer).options(selectinload(Manufacturer.parent))
    if is_deleted is None:
        if not include_deleted:
            query = query.where(Manufacturer.is_deleted == False)
    else:
        query = query.where(Manufacturer.is_deleted == is_deleted)
    items = db.scalars(query.order_by(Manufacturer.parent_id, Manufacturer.country, Manufacturer.name)).all()
    return build_export_response(
        filename_prefix="manufacturers",
        file_format=format,
        headers=[
            "name",
            "country",
            "parent_full_path",
            "flag",
            "founded_year",
            "segment",
            "specialization",
            "website",
        ],
        rows=[
            [
                item.name,
                item.country,
                item.parent.full_path if item.parent else "",
                item.flag,
                item.founded_year,
                item.segment,
                item.specialization,
                item.website,
            ]
            for item in items
        ],
    )


@router.get("/template")
def download_template(
    format: str = Query(default="xlsx", pattern="^(xlsx)$"),
    user: User = Depends(require_read_access()),
):
    return build_template_response(
        filename_prefix="manufacturers-template",
        headers=[
            "name",
            "country",
            "parent_full_path",
            "flag",
            "founded_year",
            "segment",
            "specialization",
            "website",
        ],
        readme_lines=[
            "Manufacturers import template",
            "Required columns: name, country.",
            "Use parent_full_path for brand rows.",
            "Leave parent_full_path empty for country root rows.",
        ],
    )


@router.post("/import", response_model=ImportReport)
def import_manufacturers(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, data_rows = read_tabular_rows(file, format)
    if not headers:
        raise HTTPException(status_code=400, detail="Empty file")

    normalized_headers = {header.strip().lower() for header in headers}
    if "name" not in normalized_headers:
        raise HTTPException(status_code=400, detail="Missing 'name' column")
    if "country" not in normalized_headers:
        raise HTTPException(status_code=400, detail="Missing 'country' column")

    report = ImportReport(total_rows=0, created=0, updated=0, skipped_duplicates=0, errors=[], warnings=[])
    existing_items = db.scalars(select(Manufacturer).options(selectinload(Manufacturer.parent))).all()
    active_paths = {_normalize_name(item.full_path): item for item in existing_items if not item.is_deleted}
    seen_paths: set[str] = set()
    to_create: list[dict[str, object | None]] = []

    for row_index, row in enumerate(data_rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            name = as_required_str(values.get("name"), field="name")
            country = as_required_str(values.get("country"), field="country")
        except ValueError as exc:
            field = "name" if "name" in str(exc).lower() else "country"
            report.errors.append(ImportIssue(row=row_index, field=field, message=str(exc)))
            continue

        parent_full_path = as_optional_str(values.get("parent_full_path"))
        if parent_full_path:
            parent = active_paths.get(_normalize_name(parent_full_path))
            if not parent:
                report.errors.append(
                    ImportIssue(row=row_index, field="parent_full_path", message="Parent manufacturer not found")
                )
                continue
            if parent.parent_id is not None:
                report.errors.append(
                    ImportIssue(row=row_index, field="parent_full_path", message="Parent must be a country root")
                )
                continue
            full_path = f"{parent.full_path} / {name}"
        else:
            full_path = name

        normalized_path = _normalize_name(full_path)
        if normalized_path in active_paths or normalized_path in seen_paths:
            report.skipped_duplicates += 1
            report.warnings.append(ImportIssue(row=row_index, field="name", message="Duplicate manufacturer skipped"))
            continue

        seen_paths.add(normalized_path)
        to_create.append(
            {
                "name": name,
                "country": country,
                "parent_full_path": parent_full_path,
                "flag": as_optional_str(values.get("flag")),
                "founded_year": as_optional_int(values.get("founded_year")),
                "segment": as_optional_str(values.get("segment")),
                "specialization": as_optional_str(values.get("specialization")),
                "website": as_optional_str(values.get("website")),
            }
        )

    report.created = len(to_create)
    if not dry_run:
        for item_data in to_create:
            parent_full_path = item_data["parent_full_path"]
            if parent_full_path:
                parent = active_paths[_normalize_name(str(parent_full_path))]
                manufacturer = Manufacturer(
                    name=str(item_data["name"]),
                    country=parent.name,
                    parent_id=parent.id,
                    flag=item_data["flag"],
                    founded_year=item_data["founded_year"],
                    segment=item_data["segment"],
                    specialization=item_data["specialization"],
                    website=item_data["website"],
                )
            else:
                manufacturer = Manufacturer(
                    name=str(item_data["name"]),
                    country=str(item_data["country"]),
                )
            if manufacturer.parent_id is None:
                ensure_unique_name(db, manufacturer.name, None)
            else:
                ensure_unique_name(db, manufacturer.name, manufacturer.parent_id)
            db.add(manufacturer)
            db.flush()
            active_paths[_normalize_name(manufacturer.full_path)] = manufacturer
            add_audit_log(
                db,
                actor_id=current_user.id,
                action="CREATE",
                entity="manufacturers",
                entity_id=manufacturer.id,
                before=None,
                after=model_to_dict(manufacturer),
            )
        db.commit()

    return report


@router.get("/{manufacturer_id}", response_model=ManufacturerOut)
def get_manufacturer(
    manufacturer_id: int,
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = (
        select(Manufacturer)
        .options(selectinload(Manufacturer.parent))
        .where(Manufacturer.id == manufacturer_id)
    )
    if not include_deleted:
        query = query.where(Manufacturer.is_deleted == False)
    manufacturer = db.scalar(query)
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    return manufacturer


@router.post("/", response_model=ManufacturerOut)
def create_manufacturer(
    payload: ManufacturerCreate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    parent = None
    country_name = payload.country.strip() if payload.country else ""
    if payload.parent_id is not None:
        parent = resolve_parent(db, payload.parent_id)
        country_name = parent.name
        ensure_unique_name(db, payload.name, parent.id)
        manufacturer = Manufacturer(
            name=payload.name,
            country=country_name,
            parent_id=parent.id,
            flag=payload.flag,
            founded_year=payload.founded_year,
            segment=payload.segment,
            specialization=payload.specialization,
            website=payload.website,
        )
    elif country_name and _normalize_name(country_name) != _normalize_name(payload.name):
        parent = get_or_create_country_root(db, country_name)
        ensure_unique_name(db, payload.name, parent.id)
        manufacturer = Manufacturer(
            name=payload.name,
            country=parent.name,
            parent_id=parent.id,
            flag=payload.flag,
            founded_year=payload.founded_year,
            segment=payload.segment,
            specialization=payload.specialization,
            website=payload.website,
        )
    else:
        country_root = country_name or payload.name
        ensure_unique_name(db, payload.name, None)
        manufacturer = Manufacturer(name=payload.name, country=country_root)

    db.add(manufacturer)
    db.flush()

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="CREATE",
        entity="manufacturers",
        entity_id=manufacturer.id,
        before=None,
        after=model_to_dict(manufacturer),
    )

    db.commit()
    db.refresh(manufacturer)
    return manufacturer


@router.patch("/{manufacturer_id}", response_model=ManufacturerOut)
def update_manufacturer(
    manufacturer_id: int,
    payload: ManufacturerUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    manufacturer = db.scalar(
        select(Manufacturer).options(selectinload(Manufacturer.parent)).where(Manufacturer.id == manufacturer_id)
    )
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    before = model_to_dict(manufacturer)
    data = payload.model_dump(exclude_unset=True)
    target_parent = manufacturer.parent
    if "parent_id" in data:
        target_parent = resolve_parent(db, data["parent_id"], node_id=manufacturer_id)

    if target_parent is not None and db.scalar(select(Manufacturer).where(Manufacturer.parent_id == manufacturer_id)):
        raise HTTPException(status_code=400, detail="Country node with children cannot become a brand")

    target_name = payload.name if payload.name is not None else manufacturer.name
    target_parent_id = target_parent.id if target_parent is not None else None
    ensure_unique_name(db, target_name, target_parent_id, exclude_id=manufacturer_id)

    old_is_root = manufacturer.parent_id is None
    old_name = manufacturer.name

    manufacturer.name = target_name
    manufacturer.parent_id = target_parent_id
    if target_parent is None:
        manufacturer.country = payload.country or target_name
        if "parent_id" in data and data["parent_id"] is None:
            manufacturer.flag = None
            manufacturer.founded_year = None
            manufacturer.segment = None
            manufacturer.specialization = None
            manufacturer.website = None
    else:
        manufacturer.country = target_parent.name
        if "flag" in data:
            manufacturer.flag = data["flag"]
        if "founded_year" in data:
            manufacturer.founded_year = data["founded_year"]
        if "segment" in data:
            manufacturer.segment = data["segment"]
        if "specialization" in data:
            manufacturer.specialization = data["specialization"]
        if "website" in data:
            manufacturer.website = data["website"]

    if manufacturer.parent_id is None and (old_name != manufacturer.name or not old_is_root):
        children = db.scalars(select(Manufacturer).where(Manufacturer.parent_id == manufacturer.id)).all()
        for child in children:
            child.country = manufacturer.name

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="UPDATE",
        entity="manufacturers",
        entity_id=manufacturer.id,
        before=before,
        after=model_to_dict(manufacturer),
    )

    db.commit()
    db.refresh(manufacturer)
    return manufacturer


@router.put("/{manufacturer_id}", response_model=ManufacturerOut)
def update_manufacturer_legacy(
    manufacturer_id: int,
    payload: ManufacturerUpdate,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return update_manufacturer(manufacturer_id, payload, db, current_user)


@router.delete("/{manufacturer_id}")
def delete_manufacturer(
    manufacturer_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    manufacturer = db.scalar(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    subtree_ids = collect_subtree_ids(db, manufacturer_id)
    items = db.scalars(select(Manufacturer).where(Manufacturer.id.in_(subtree_ids))).all()
    before = model_to_dict(manufacturer)
    for item in items:
        item.is_deleted = True
        item.deleted_at = datetime.utcnow()
        item.deleted_by_id = current_user.id

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="DELETE",
        entity="manufacturers",
        entity_id=manufacturer.id,
        before=before,
        after=model_to_dict(manufacturer),
    )

    db.commit()
    return {"status": "ok"}


@router.post("/{manufacturer_id}/restore", response_model=ManufacturerOut)
def restore_manufacturer(
    manufacturer_id: int,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    manufacturer = db.scalar(
        select(Manufacturer).options(selectinload(Manufacturer.parent)).where(Manufacturer.id == manufacturer_id)
    )
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    before = model_to_dict(manufacturer)
    ancestors: list[Manufacturer] = []
    current = manufacturer.parent
    while current is not None:
        ancestors.append(current)
        current = current.parent

    for item in reversed(ancestors):
        item.is_deleted = False
        item.deleted_at = None
        item.deleted_by_id = None

    subtree_ids = collect_subtree_ids(db, manufacturer_id)
    items = db.scalars(select(Manufacturer).where(Manufacturer.id.in_(subtree_ids))).all()
    for item in items:
        item.is_deleted = False
        item.deleted_at = None
        item.deleted_by_id = None

    add_audit_log(
        db,
        actor_id=current_user.id,
        action="RESTORE",
        entity="manufacturers",
        entity_id=manufacturer.id,
        before=before,
        after=model_to_dict(manufacturer),
    )

    db.commit()
    db.refresh(manufacturer)
    return manufacturer
