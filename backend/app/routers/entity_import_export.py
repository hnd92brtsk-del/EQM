from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import case, or_, select
from sqlalchemy.orm import selectinload

from app.core.access import require_space_access
from app.core.dependencies import get_db, require_admin, require_read_access, require_write_access
from app.core.query import apply_alphabet_filter, apply_search, apply_sort, apply_text_filter
from app.models.assemblies import Assembly
from app.models.core import (
    Cabinet,
    DataType,
    EquipmentCategory,
    EquipmentType,
    FieldEquipment,
    Location,
    MainEquipment,
    Manufacturer,
    MeasurementUnit,
    Personnel,
    PersonnelCompetency,
    PersonnelScheduleTemplate,
    PersonnelTraining,
    SignalTypeDictionary,
    Warehouse,
)
from app.models.io import IOSignal, SignalType
from app.models.ipam import Subnet, Vlan
from app.models.operations import CabinetItem, WarehouseItem
from app.models.security import SpaceKey, User
from app.routers import (
    assemblies as assemblies_router,
    cabinet_items as cabinet_items_router,
    cabinets as cabinets_router,
    data_types as data_types_router,
    equipment_categories as equipment_categories_router,
    equipment_types as equipment_types_router,
    field_equipments as field_equipments_router,
    io_signals as io_signals_router,
    ipam as ipam_router,
    locations as locations_router,
    main_equipment as main_equipment_router,
    measurement_units as measurement_units_router,
    personnel as personnel_router,
    signal_types as signal_types_router,
    users as users_router,
    warehouse_items as warehouse_items_router,
    warehouses as warehouses_router,
)
from app.schemas.assemblies import AssemblyCreate
from app.schemas.cabinet_items import CabinetItemCreate
from app.schemas.cabinets import CabinetCreate
from app.schemas.data_types import DataTypeCreate
from app.schemas.equipment_categories import EquipmentCategoryCreate
from app.schemas.equipment_types import EquipmentTypeCreate
from app.schemas.field_equipments import FieldEquipmentCreate
from app.schemas.import_export import ImportIssue, ImportReport
from app.schemas.io_signals import IOSignalUpdate
from app.schemas.ipam import SubnetCreate, VlanCreate
from app.schemas.locations import LocationCreate
from app.schemas.main_equipment import MainEquipmentCreate
from app.schemas.measurement_units import MeasurementUnitCreate
from app.schemas.personnel import PersonnelCompetencyCreate, PersonnelCreate, PersonnelTrainingCreate
from app.schemas.signal_types import SignalTypeCreate
from app.schemas.users import UserCreate
from app.schemas.warehouse_items import WarehouseItemCreate
from app.schemas.warehouses import WarehouseCreate
from app.services.tabular_import_export import (
    as_optional_bool,
    as_optional_date,
    as_optional_float,
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


def _normalized(value: Any) -> str:
    return " ".join(str(value or "").split()).strip().casefold()


def _path_value(item: Any) -> str:
    value = getattr(item, "full_path", None)
    if callable(value):
        return value()
    return str(value or "").strip()


def _json_object_or_none(value: Any) -> dict[str, Any] | None:
    text = as_optional_str(value)
    if text is None:
        return None
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("Value must be a JSON object")
    return parsed


def _json_list_or_empty(value: Any) -> list[dict[str, Any]]:
    text = as_optional_str(value)
    if text is None:
        return []
    parsed = json.loads(text)
    if not isinstance(parsed, list):
        raise ValueError("Value must be a JSON array")
    return parsed


def _report() -> ImportReport:
    return ImportReport(total_rows=0, created=0, updated=0, skipped_duplicates=0, errors=[], warnings=[])


def _append_error(report: ImportReport, *, row: int, field: str | None, message: str) -> None:
    report.errors.append(ImportIssue(row=row, field=field, message=message))


def _append_warning(report: ImportReport, *, row: int, field: str | None, message: str) -> None:
    report.warnings.append(ImportIssue(row=row, field=field, message=message))


def _read_headers(file: UploadFile, format: str | None) -> tuple[list[str], list[list[Any]]]:
    headers, rows = read_tabular_rows(file, format)
    if not headers:
        raise HTTPException(status_code=400, detail="Empty file")
    return headers, rows


def _ensure_headers(headers: Sequence[str], required: Sequence[str]) -> None:
    normalized_headers = {str(header or "").strip().lower() for header in headers}
    for name in required:
        if name not in normalized_headers:
            raise HTTPException(status_code=400, detail=f"Missing '{name}' column")


def _build_tree_lookup(items: Sequence[Any]) -> dict[str, Any]:
    return {_normalized(_path_value(item)): item for item in items if not item.is_deleted}


def _build_location_lookup(db) -> tuple[dict[str, Location], dict[int, str]]:
    items = db.scalars(select(Location).options(selectinload(Location.parent))).all()
    by_path = {_normalized(item.full_path()): item for item in items if not item.is_deleted}
    by_id = {item.id: item.full_path() for item in items}
    return by_path, by_id


def _build_manufacturer_lookup(db) -> dict[str, Manufacturer]:
    items = db.scalars(select(Manufacturer).options(selectinload(Manufacturer.parent))).all()
    return _build_tree_lookup(items)


def _build_equipment_category_lookup(db) -> dict[str, EquipmentCategory]:
    items = db.scalars(select(EquipmentCategory).options(selectinload(EquipmentCategory.parent))).all()
    return _build_tree_lookup(items)


def _build_equipment_type_lookup(db) -> dict[str, EquipmentType]:
    items = db.scalars(
        select(EquipmentType).options(
            selectinload(EquipmentType.manufacturer).selectinload(Manufacturer.parent),
            selectinload(EquipmentType.equipment_category).selectinload(EquipmentCategory.parent),
        )
    ).all()
    return {_normalized(item.nomenclature_number): item for item in items if not item.is_deleted}


def _build_username_lookup(db) -> dict[str, User]:
    return {_normalized(item.username): item for item in db.scalars(select(User)).all() if not item.is_deleted}


def _build_schedule_template_lookup(db) -> dict[str, PersonnelScheduleTemplate]:
    items = db.scalars(select(PersonnelScheduleTemplate)).all()
    return {_normalized(item.label): item for item in items if not item.is_deleted}


def _require_lookup_id(
    lookup: dict[str, Any],
    value: Any,
    *,
    message: str,
    allow_blank: bool = True,
) -> int | None:
    text = as_optional_str(value)
    if text is None:
        if allow_blank:
            return None
        raise ValueError(message)
    item = lookup.get(_normalized(text))
    if item is None:
        raise ValueError(message)
    return int(item.id)


def _tree_export_rows(
    items: Sequence[Any],
    *,
    extra_getters: Sequence[Callable[[Any], Any]] | None = None,
) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for item in items:
        rows.append(
            [
                item.name,
                _path_value(item.parent) if getattr(item, "parent", None) else "",
                *([getter(item) for getter in extra_getters] if extra_getters else []),
            ]
        )
    return rows


def _tree_import(
    *,
    file: UploadFile,
    format: str | None,
    dry_run: bool,
    db,
    current_user: User,
    items_query,
    create_schema: type,
    create_callback: Callable[[Any, Any, User], Any],
    required_headers: Sequence[str],
    parser: Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]],
) -> ImportReport:
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, required_headers)
    report = _report()
    items = db.scalars(items_query).all()
    path_lookup = _build_tree_lookup(items)
    seen_paths: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            payload = parser(values, path_lookup)
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))
            continue

        parent_full_path = as_optional_str(values.get("parent_full_path"))
        full_path = payload["name"] if not parent_full_path else f"{parent_full_path} / {payload['name']}"
        normalized_full_path = _normalized(full_path)
        if normalized_full_path in path_lookup or normalized_full_path in seen_paths:
            report.skipped_duplicates += 1
            _append_warning(report, row=row_index, field="name", message="Duplicate row skipped")
            continue

        seen_paths.add(normalized_full_path)
        payload["_normalized_parent"] = _normalized(parent_full_path) if parent_full_path else None
        payload["_normalized_full_path"] = normalized_full_path
        pending.append(payload)

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        parent_key = payload.pop("_normalized_parent")
        normalized_full_path = payload.pop("_normalized_full_path")
        if parent_key:
            payload["parent_id"] = path_lookup[parent_key].id
        created = create_callback(create_schema(**payload), db, current_user)
        path_lookup[normalized_full_path] = created

    return report


@router.get("/locations/export")
def export_locations(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Location).options(selectinload(Location.parent))
    if not include_deleted:
        query = query.where(Location.is_deleted == False)
    items = db.scalars(query.order_by(Location.parent_id, Location.name, Location.id)).all()
    if q:
        items = [item for item in items if q.casefold() in item.name.casefold()]
    return build_export_response(
        filename_prefix="locations",
        file_format=format,
        headers=["name", "parent_full_path"],
        rows=_tree_export_rows(items),
    )


@router.get("/locations/template")
def template_locations(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="locations-template",
        headers=["name", "parent_full_path"],
        readme_lines=[
            "Locations import template",
            "Required columns: name.",
            "Use parent_full_path to place a node under an existing location.",
        ],
    )


@router.post("/locations/import", response_model=ImportReport)
def import_locations(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return _tree_import(
        file=file,
        format=format,
        dry_run=dry_run,
        db=db,
        current_user=current_user,
        items_query=select(Location).options(selectinload(Location.parent)),
        create_schema=LocationCreate,
        create_callback=locations_router.create_location,
        required_headers=["name"],
        parser=lambda values, lookup: {
            "name": as_required_str(values.get("name"), field="name"),
            "parent_id": _require_lookup_id(lookup, values.get("parent_full_path"), message="Parent location not found"),
        },
    )


@router.get("/field-equipments/export")
def export_field_equipments(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(FieldEquipment).options(selectinload(FieldEquipment.parent))
    if not include_deleted:
        query = query.where(FieldEquipment.is_deleted == False)
    items = db.scalars(query.order_by(FieldEquipment.parent_id, FieldEquipment.name, FieldEquipment.id)).all()
    if q:
        items = [item for item in items if q.casefold() in item.name.casefold()]
    return build_export_response(
        filename_prefix="field-equipments",
        file_format=format,
        headers=["name", "parent_full_path"],
        rows=_tree_export_rows(items),
    )


@router.get("/field-equipments/template")
def template_field_equipments(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="field-equipments-template",
        headers=["name", "parent_full_path"],
        readme_lines=[
            "Field equipments import template",
            "Required columns: name.",
            "Use parent_full_path to reference an existing parent node.",
        ],
    )


@router.post("/field-equipments/import", response_model=ImportReport)
def import_field_equipments(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return _tree_import(
        file=file,
        format=format,
        dry_run=dry_run,
        db=db,
        current_user=current_user,
        items_query=select(FieldEquipment).options(selectinload(FieldEquipment.parent)),
        create_schema=FieldEquipmentCreate,
        create_callback=field_equipments_router.create_field_equipment,
        required_headers=["name"],
        parser=lambda values, lookup: {
            "name": as_required_str(values.get("name"), field="name"),
            "parent_id": _require_lookup_id(lookup, values.get("parent_full_path"), message="Parent field equipment not found"),
        },
    )


@router.get("/data-types/export")
def export_data_types(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(DataType).options(selectinload(DataType.parent))
    if not include_deleted:
        query = query.where(DataType.is_deleted == False)
    items = db.scalars(query.order_by(DataType.parent_id, DataType.name, DataType.id)).all()
    if q:
        items = [item for item in items if q.casefold() in item.name.casefold()]
    return build_export_response(
        filename_prefix="data-types",
        file_format=format,
        headers=["name", "parent_full_path", "tooltip"],
        rows=_tree_export_rows(items, extra_getters=[lambda item: item.tooltip]),
    )


@router.get("/data-types/template")
def template_data_types(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="data-types-template",
        headers=["name", "parent_full_path", "tooltip"],
        readme_lines=[
            "Data types import template",
            "Required columns: name.",
            "tooltip is optional.",
        ],
    )


@router.post("/data-types/import", response_model=ImportReport)
def import_data_types(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return _tree_import(
        file=file,
        format=format,
        dry_run=dry_run,
        db=db,
        current_user=current_user,
        items_query=select(DataType).options(selectinload(DataType.parent)),
        create_schema=DataTypeCreate,
        create_callback=data_types_router.create_data_type,
        required_headers=["name"],
        parser=lambda values, lookup: {
            "name": as_required_str(values.get("name"), field="name"),
            "tooltip": as_optional_str(values.get("tooltip")),
            "parent_id": _require_lookup_id(lookup, values.get("parent_full_path"), message="Parent data type not found"),
        },
    )


@router.get("/measurement-units/export")
def export_measurement_units(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(MeasurementUnit).options(selectinload(MeasurementUnit.parent))
    if not include_deleted:
        query = query.where(MeasurementUnit.is_deleted == False)
    items = db.scalars(query.order_by(MeasurementUnit.parent_id, MeasurementUnit.name, MeasurementUnit.id)).all()
    if q:
        items = [item for item in items if q.casefold() in item.name.casefold()]
    return build_export_response(
        filename_prefix="measurement-units",
        file_format=format,
        headers=["name", "parent_full_path", "sort_order"],
        rows=_tree_export_rows(items, extra_getters=[lambda item: item.sort_order]),
    )


@router.get("/measurement-units/template")
def template_measurement_units(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="measurement-units-template",
        headers=["name", "parent_full_path", "sort_order"],
        readme_lines=[
            "Measurement units import template",
            "Required columns: name.",
            "sort_order is optional.",
        ],
    )


@router.post("/measurement-units/import", response_model=ImportReport)
def import_measurement_units(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return _tree_import(
        file=file,
        format=format,
        dry_run=dry_run,
        db=db,
        current_user=current_user,
        items_query=select(MeasurementUnit).options(selectinload(MeasurementUnit.parent)),
        create_schema=MeasurementUnitCreate,
        create_callback=measurement_units_router.create_measurement_unit,
        required_headers=["name"],
        parser=lambda values, lookup: {
            "name": as_required_str(values.get("name"), field="name"),
            "sort_order": as_optional_int(values.get("sort_order")),
            "parent_id": _require_lookup_id(lookup, values.get("parent_full_path"), message="Parent measurement unit not found"),
        },
    )


@router.get("/signal-types/export")
def export_signal_types(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(SignalTypeDictionary).options(selectinload(SignalTypeDictionary.parent))
    if not include_deleted:
        query = query.where(SignalTypeDictionary.is_deleted == False)
    items = db.scalars(query.order_by(SignalTypeDictionary.parent_id, SignalTypeDictionary.name, SignalTypeDictionary.id)).all()
    if q:
        items = [item for item in items if q.casefold() in item.name.casefold()]
    return build_export_response(
        filename_prefix="signal-types",
        file_format=format,
        headers=["name", "parent_full_path", "sort_order"],
        rows=_tree_export_rows(items, extra_getters=[lambda item: item.sort_order]),
    )


@router.get("/signal-types/template")
def template_signal_types(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="signal-types-template",
        headers=["name", "parent_full_path", "sort_order"],
        readme_lines=[
            "Signal types import template",
            "Required columns: name.",
            "sort_order is optional.",
        ],
    )


@router.post("/signal-types/import", response_model=ImportReport)
def import_signal_types(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return _tree_import(
        file=file,
        format=format,
        dry_run=dry_run,
        db=db,
        current_user=current_user,
        items_query=select(SignalTypeDictionary).options(selectinload(SignalTypeDictionary.parent)),
        create_schema=SignalTypeCreate,
        create_callback=signal_types_router.create_signal_type,
        required_headers=["name"],
        parser=lambda values, lookup: {
            "name": as_required_str(values.get("name"), field="name"),
            "sort_order": as_optional_int(values.get("sort_order")),
            "parent_id": _require_lookup_id(lookup, values.get("parent_full_path"), message="Parent signal type not found"),
        },
    )


@router.get("/equipment-categories/export")
def export_equipment_categories(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(EquipmentCategory).options(selectinload(EquipmentCategory.parent))
    if not include_deleted:
        query = query.where(EquipmentCategory.is_deleted == False)
    items = db.scalars(query.order_by(EquipmentCategory.parent_id, EquipmentCategory.name, EquipmentCategory.id)).all()
    if q:
        items = [item for item in items if q.casefold() in item.name.casefold()]
    return build_export_response(
        filename_prefix="equipment-categories",
        file_format=format,
        headers=["name", "parent_full_path"],
        rows=_tree_export_rows(items),
    )


@router.get("/equipment-categories/template")
def template_equipment_categories(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="equipment-categories-template",
        headers=["name", "parent_full_path"],
        readme_lines=[
            "Equipment categories import template",
            "Required columns: name.",
            "Use parent_full_path to place a node in the hierarchy.",
        ],
    )


@router.post("/equipment-categories/import", response_model=ImportReport)
def import_equipment_categories(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    return _tree_import(
        file=file,
        format=format,
        dry_run=dry_run,
        db=db,
        current_user=current_user,
        items_query=select(EquipmentCategory).options(selectinload(EquipmentCategory.parent)),
        create_schema=EquipmentCategoryCreate,
        create_callback=equipment_categories_router.create_equipment_category,
        required_headers=["name"],
        parser=lambda values, lookup: {
            "name": as_required_str(values.get("name"), field="name"),
            "parent_id": _require_lookup_id(lookup, values.get("parent_full_path"), message="Parent equipment category not found"),
        },
    )


@router.get("/main-equipment/export")
def export_main_equipment(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(MainEquipment)
    if not include_deleted:
        query = query.where(MainEquipment.is_deleted == False)
    items = db.scalars(query.order_by(MainEquipment.code, MainEquipment.id)).all()
    if q:
        items = [item for item in items if q.casefold() in item.name.casefold() or q.casefold() in item.code.casefold()]
    by_id = {item.id: item for item in items}
    return build_export_response(
        filename_prefix="main-equipment",
        file_format=format,
        headers=["name", "parent_code", "code", "level", "meta_data_json"],
        rows=[
            [
                item.name,
                by_id[item.parent_id].code if item.parent_id and item.parent_id in by_id else "",
                item.code,
                item.level,
                json.dumps(item.meta_data or {}, ensure_ascii=False) if item.meta_data else "",
            ]
            for item in items
        ],
    )


@router.get("/main-equipment/template")
def template_main_equipment(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="main-equipment-template",
        headers=["name", "parent_code", "code", "meta_data_json"],
        readme_lines=[
            "Main equipment import template",
            "Required columns: name.",
            "parent_code is optional.",
            "Leave code empty to auto-generate it.",
        ],
    )


@router.post("/main-equipment/import", response_model=ImportReport)
def import_main_equipment(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["name"])
    report = _report()
    items = db.scalars(select(MainEquipment)).all()
    code_lookup = {_normalized(item.code): item for item in items if not item.is_deleted}
    seen_codes: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            name = as_required_str(values.get("name"), field="name")
            code = as_optional_str(values.get("code"))
            parent_code = as_optional_str(values.get("parent_code"))
            meta_data = _json_object_or_none(values.get("meta_data_json"))
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))
            continue

        normalized_code = _normalized(code)
        if code and (normalized_code in code_lookup or normalized_code in seen_codes):
            report.skipped_duplicates += 1
            _append_warning(report, row=row_index, field="code", message="Duplicate main equipment code skipped")
            continue
        if parent_code and _normalized(parent_code) not in code_lookup:
            _append_error(report, row=row_index, field="parent_code", message="Parent main equipment not found")
            continue

        pending.append({"name": name, "code": code, "parent_code": parent_code, "meta_data": meta_data})
        if code:
            seen_codes.add(normalized_code)

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        parent_code = payload.pop("parent_code")
        if parent_code:
            payload["parent_id"] = code_lookup[_normalized(parent_code)].id
        created = main_equipment_router.create_main_equipment(MainEquipmentCreate(**payload), db, current_user)
        code_lookup[_normalized(created.code)] = created

    return report


@router.get("/warehouses/export")
def export_warehouses(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    sort: str | None = None,
    location_id: int | None = None,
    name: str | None = None,
    name_alphabet: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Warehouse)
    if not include_deleted:
        query = query.where(Warehouse.is_deleted == False)
    if location_id is not None:
        query = query.where(Warehouse.location_id == location_id)
    query = apply_text_filter(query, Warehouse.name, name)
    query = apply_alphabet_filter(query, Warehouse.name, name_alphabet)
    query = apply_search(query, q, [Warehouse.name])
    query = apply_sort(query, Warehouse, sort)
    items = db.scalars(query).all()
    _location_lookup, location_by_id = _build_location_lookup(db)
    return build_export_response(
        filename_prefix="warehouses",
        file_format=format,
        headers=["name", "location_full_path", "meta_data_json"],
        rows=[
            [item.name, location_by_id.get(item.location_id, ""), json.dumps(item.meta_data or {}, ensure_ascii=False) if item.meta_data else ""]
            for item in items
        ],
    )


@router.get("/warehouses/template")
def template_warehouses(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="warehouses-template",
        headers=["name", "location_full_path", "meta_data_json"],
        readme_lines=[
            "Warehouses import template",
            "Required columns: name.",
            "location_full_path and meta_data_json are optional.",
        ],
    )


@router.post("/warehouses/import", response_model=ImportReport)
def import_warehouses(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["name"])
    report = _report()
    location_lookup, location_by_id = _build_location_lookup(db)
    existing_keys = {
        f"{_normalized(item.name)}|{_normalized(location_by_id.get(item.location_id, ''))}"
        for item in db.scalars(select(Warehouse)).all()
        if not item.is_deleted
    }
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            name = as_required_str(values.get("name"), field="name")
            location_full_path = as_optional_str(values.get("location_full_path")) or ""
            key = f"{_normalized(name)}|{_normalized(location_full_path)}"
            if key in existing_keys or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="name", message="Duplicate warehouse skipped")
                continue
            seen.add(key)
            pending.append(
                {
                    "name": name,
                    "location_id": _require_lookup_id(location_lookup, values.get("location_full_path"), message="Location not found"),
                    "meta_data": _json_object_or_none(values.get("meta_data_json")),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        warehouses_router.create_warehouse(WarehouseCreate(**payload), db, current_user)

    return report


@router.get("/cabinets/export")
def export_cabinets(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    sort: str | None = None,
    location_id: int | None = None,
    name: str | None = None,
    name_alphabet: str | None = None,
    factory_number: str | None = None,
    nomenclature_number: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Cabinet)
    if not include_deleted:
        query = query.where(Cabinet.is_deleted == False)
    if location_id is not None:
        query = query.where(Cabinet.location_id == location_id)
    query = apply_text_filter(query, Cabinet.name, name)
    query = apply_alphabet_filter(query, Cabinet.name, name_alphabet)
    query = apply_text_filter(query, Cabinet.factory_number, factory_number)
    query = apply_text_filter(query, Cabinet.nomenclature_number, nomenclature_number)
    query = apply_search(query, q, [Cabinet.name])
    query = apply_sort(query, Cabinet, sort)
    items = db.scalars(query).all()
    _location_lookup, location_by_id = _build_location_lookup(db)
    return build_export_response(
        filename_prefix="cabinets",
        file_format=format,
        headers=["name", "factory_number", "nomenclature_number", "location_full_path", "meta_data_json"],
        rows=[
            [
                item.name,
                item.factory_number,
                item.nomenclature_number,
                location_by_id.get(item.location_id, ""),
                json.dumps(item.meta_data or {}, ensure_ascii=False) if item.meta_data else "",
            ]
            for item in items
        ],
    )


@router.get("/cabinets/template")
def template_cabinets(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="cabinets-template",
        headers=["name", "factory_number", "nomenclature_number", "location_full_path", "meta_data_json"],
        readme_lines=[
            "Cabinets import template",
            "Required columns: name.",
            "Use location_full_path instead of internal IDs.",
        ],
    )


@router.post("/cabinets/import", response_model=ImportReport)
def import_cabinets(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["name"])
    report = _report()
    location_lookup, location_by_id = _build_location_lookup(db)
    existing_keys = {
        "|".join(
            [
                _normalized(item.name),
                _normalized(item.factory_number),
                _normalized(item.nomenclature_number),
                _normalized(location_by_id.get(item.location_id, "")),
            ]
        )
        for item in db.scalars(select(Cabinet)).all()
        if not item.is_deleted
    }
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            name = as_required_str(values.get("name"), field="name")
            factory_number_value = as_optional_str(values.get("factory_number"))
            nomenclature_value = as_optional_str(values.get("nomenclature_number"))
            location_full_path = as_optional_str(values.get("location_full_path")) or ""
            key = "|".join(
                [
                    _normalized(name),
                    _normalized(factory_number_value),
                    _normalized(nomenclature_value),
                    _normalized(location_full_path),
                ]
            )
            if key in existing_keys or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="name", message="Duplicate cabinet skipped")
                continue
            seen.add(key)
            pending.append(
                {
                    "name": name,
                    "factory_number": factory_number_value,
                    "nomenclature_number": nomenclature_value,
                    "location_id": _require_lookup_id(location_lookup, values.get("location_full_path"), message="Location not found"),
                    "meta_data": _json_object_or_none(values.get("meta_data_json")),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        cabinets_router.create_cabinet(CabinetCreate(**payload), db, current_user)

    return report


@router.get("/assemblies/export")
def export_assemblies(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    sort: str | None = None,
    location_id: int | None = None,
    name: str | None = None,
    name_alphabet: str | None = None,
    factory_number: str | None = None,
    nomenclature_number: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Assembly)
    if not include_deleted:
        query = query.where(Assembly.is_deleted == False)
    if location_id is not None:
        query = query.where(Assembly.location_id == location_id)
    query = apply_text_filter(query, Assembly.name, name)
    query = apply_alphabet_filter(query, Assembly.name, name_alphabet)
    query = apply_text_filter(query, Assembly.factory_number, factory_number)
    query = apply_text_filter(query, Assembly.nomenclature_number, nomenclature_number)
    query = apply_search(query, q, [Assembly.name])
    query = apply_sort(query, Assembly, sort)
    items = db.scalars(query).all()
    _location_lookup, location_by_id = _build_location_lookup(db)
    return build_export_response(
        filename_prefix="assemblies",
        file_format=format,
        headers=["name", "factory_number", "nomenclature_number", "location_full_path", "meta_data_json"],
        rows=[
            [
                item.name,
                item.factory_number,
                item.nomenclature_number,
                location_by_id.get(item.location_id, ""),
                json.dumps(item.meta_data or {}, ensure_ascii=False) if item.meta_data else "",
            ]
            for item in items
        ],
    )


@router.get("/assemblies/template")
def template_assemblies(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="assemblies-template",
        headers=["name", "factory_number", "nomenclature_number", "location_full_path", "meta_data_json"],
        readme_lines=[
            "Assemblies import template",
            "Required columns: name.",
            "Use location_full_path instead of internal IDs.",
        ],
    )


@router.post("/assemblies/import", response_model=ImportReport)
def import_assemblies(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["name"])
    report = _report()
    location_lookup, location_by_id = _build_location_lookup(db)
    existing_keys = {
        "|".join(
            [
                _normalized(item.name),
                _normalized(item.factory_number),
                _normalized(item.nomenclature_number),
                _normalized(location_by_id.get(item.location_id, "")),
            ]
        )
        for item in db.scalars(select(Assembly)).all()
        if not item.is_deleted
    }
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            name = as_required_str(values.get("name"), field="name")
            factory_number_value = as_optional_str(values.get("factory_number"))
            nomenclature_value = as_optional_str(values.get("nomenclature_number"))
            location_full_path = as_optional_str(values.get("location_full_path")) or ""
            key = "|".join(
                [
                    _normalized(name),
                    _normalized(factory_number_value),
                    _normalized(nomenclature_value),
                    _normalized(location_full_path),
                ]
            )
            if key in existing_keys or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="name", message="Duplicate assembly skipped")
                continue
            seen.add(key)
            pending.append(
                {
                    "name": name,
                    "factory_number": factory_number_value,
                    "nomenclature_number": nomenclature_value,
                    "location_id": _require_lookup_id(location_lookup, values.get("location_full_path"), message="Location not found"),
                    "meta_data": _json_object_or_none(values.get("meta_data_json")),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        assemblies_router.create_assembly(AssemblyCreate(**payload), db, current_user)

    return report


@router.get("/equipment-types/export")
def export_equipment_types(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    sort: str | None = None,
    manufacturer_id: int | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(EquipmentType).options(
        selectinload(EquipmentType.manufacturer).selectinload(Manufacturer.parent),
        selectinload(EquipmentType.equipment_category).selectinload(EquipmentCategory.parent),
    )
    if not include_deleted:
        query = query.where(EquipmentType.is_deleted == False)
    if manufacturer_id is not None:
        query = query.where(EquipmentType.manufacturer_id == manufacturer_id)
    query = apply_search(query, q, [EquipmentType.name, EquipmentType.nomenclature_number])
    query = apply_sort(query, EquipmentType, sort)
    items = db.scalars(query).all()
    return build_export_response(
        filename_prefix="equipment-types",
        file_format=format,
        headers=[
            "name",
            "article",
            "nomenclature_number",
            "manufacturer_full_path",
            "equipment_category_full_path",
            "role_in_power_chain",
            "current_type",
            "supply_voltage",
            "current_consumption_a",
            "top_current_type",
            "top_supply_voltage",
            "bottom_current_type",
            "bottom_supply_voltage",
            "current_value_a",
            "is_channel_forming",
            "channel_count",
            "ai_count",
            "di_count",
            "ao_count",
            "do_count",
            "is_network",
            "network_ports_json",
            "has_serial_interfaces",
            "serial_ports_json",
            "mount_type",
            "mount_width_mm",
            "power_role",
            "output_voltage",
            "max_output_current_a",
            "unit_price_rub",
            "meta_data_json",
        ],
        rows=[
            [
                item.name,
                item.article,
                item.nomenclature_number,
                item.manufacturer.full_path if item.manufacturer else "",
                item.equipment_category.full_path if item.equipment_category else "",
                item.role_in_power_chain,
                item.current_type,
                item.supply_voltage,
                item.current_consumption_a,
                item.top_current_type,
                item.top_supply_voltage,
                item.bottom_current_type,
                item.bottom_supply_voltage,
                item.current_value_a,
                item.is_channel_forming,
                item.channel_count,
                item.ai_count,
                item.di_count,
                item.ao_count,
                item.do_count,
                item.is_network,
                json.dumps(item.network_ports or [], ensure_ascii=False),
                item.has_serial_interfaces,
                json.dumps(item.serial_ports or [], ensure_ascii=False),
                item.mount_type,
                item.mount_width_mm,
                item.power_role,
                item.output_voltage,
                item.max_output_current_a,
                item.unit_price_rub,
                json.dumps(item.meta_data or {}, ensure_ascii=False) if item.meta_data else "",
            ]
            for item in items
        ],
    )


@router.get("/equipment-types/template")
def template_equipment_types(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="equipment-types-template",
        headers=[
            "name",
            "article",
            "nomenclature_number",
            "manufacturer_full_path",
            "equipment_category_full_path",
            "role_in_power_chain",
            "current_type",
            "supply_voltage",
            "current_consumption_a",
            "top_current_type",
            "top_supply_voltage",
            "bottom_current_type",
            "bottom_supply_voltage",
            "current_value_a",
            "is_channel_forming",
            "channel_count",
            "ai_count",
            "di_count",
            "ao_count",
            "do_count",
            "is_network",
            "network_ports_json",
            "has_serial_interfaces",
            "serial_ports_json",
            "mount_type",
            "mount_width_mm",
            "power_role",
            "output_voltage",
            "max_output_current_a",
            "unit_price_rub",
            "meta_data_json",
        ],
        readme_lines=[
            "Equipment types import template",
            "Required columns: name, nomenclature_number, manufacturer_full_path.",
            "network_ports_json and serial_ports_json accept JSON arrays.",
            "meta_data_json accepts a JSON object.",
        ],
    )


@router.post("/equipment-types/import", response_model=ImportReport)
def import_equipment_types(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["name", "nomenclature_number", "manufacturer_full_path"])
    report = _report()
    manufacturer_lookup = _build_manufacturer_lookup(db)
    category_lookup = _build_equipment_category_lookup(db)
    existing = _build_equipment_type_lookup(db)
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            nomenclature_number = as_required_str(values.get("nomenclature_number"), field="nomenclature_number")
            key = _normalized(nomenclature_number)
            if key in existing or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="nomenclature_number", message="Duplicate equipment type skipped")
                continue
            seen.add(key)
            pending.append(
                {
                    "name": as_required_str(values.get("name"), field="name"),
                    "article": as_optional_str(values.get("article")),
                    "nomenclature_number": nomenclature_number,
                    "manufacturer_id": _require_lookup_id(manufacturer_lookup, values.get("manufacturer_full_path"), message="Manufacturer not found", allow_blank=False),
                    "equipment_category_id": _require_lookup_id(category_lookup, values.get("equipment_category_full_path"), message="Equipment category not found"),
                    "role_in_power_chain": as_optional_str(values.get("role_in_power_chain")),
                    "current_type": as_optional_str(values.get("current_type")),
                    "supply_voltage": as_optional_str(values.get("supply_voltage")),
                    "current_consumption_a": as_optional_float(values.get("current_consumption_a")),
                    "top_current_type": as_optional_str(values.get("top_current_type")),
                    "top_supply_voltage": as_optional_str(values.get("top_supply_voltage")),
                    "bottom_current_type": as_optional_str(values.get("bottom_current_type")),
                    "bottom_supply_voltage": as_optional_str(values.get("bottom_supply_voltage")),
                    "current_value_a": as_optional_float(values.get("current_value_a")),
                    "is_channel_forming": bool(as_optional_bool(values.get("is_channel_forming")) or False),
                    "channel_count": as_optional_int(values.get("channel_count")) or 0,
                    "ai_count": as_optional_int(values.get("ai_count")) or 0,
                    "di_count": as_optional_int(values.get("di_count")) or 0,
                    "ao_count": as_optional_int(values.get("ao_count")) or 0,
                    "do_count": as_optional_int(values.get("do_count")) or 0,
                    "is_network": bool(as_optional_bool(values.get("is_network")) or False),
                    "network_ports": _json_list_or_empty(values.get("network_ports_json")),
                    "has_serial_interfaces": bool(as_optional_bool(values.get("has_serial_interfaces")) or False),
                    "serial_ports": _json_list_or_empty(values.get("serial_ports_json")),
                    "mount_type": as_optional_str(values.get("mount_type")),
                    "mount_width_mm": as_optional_int(values.get("mount_width_mm")),
                    "power_role": as_optional_str(values.get("power_role")),
                    "output_voltage": as_optional_str(values.get("output_voltage")),
                    "max_output_current_a": as_optional_float(values.get("max_output_current_a")),
                    "unit_price_rub": as_optional_float(values.get("unit_price_rub")),
                    "meta_data": _json_object_or_none(values.get("meta_data_json")),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        created = equipment_types_router.create_equipment_type(EquipmentTypeCreate(**payload), db, current_user)
        existing[_normalized(created.nomenclature_number)] = created

    return report


@router.get("/users/export")
def export_users(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    sort: str | None = None,
    role: str | None = None,
    username: str | None = None,
    username_alphabet: str | None = None,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    query = select(User)
    if not include_deleted:
        query = query.where(User.is_deleted == False)
    if role:
        query = query.where(User.role == role)
    query = apply_text_filter(query, User.username, username)
    query = apply_alphabet_filter(query, User.username, username_alphabet)
    query = apply_search(query, q, [User.username])
    query = apply_sort(query, User, sort)
    items = db.scalars(query).all()
    return build_export_response(
        filename_prefix="users",
        file_format=format,
        headers=["username", "role", "password"],
        rows=[[item.username, item.role, ""] for item in items],
    )


@router.get("/users/template")
def template_users(current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin"))):
    return build_template_response(
        filename_prefix="users-template",
        headers=["username", "role", "password"],
        readme_lines=[
            "Users import template",
            "Required columns: username, role, password.",
            "Exported password cells are intentionally blank.",
        ],
    )


@router.post("/users/import", response_model=ImportReport)
def import_users(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.admin_users, "admin")),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["username", "role", "password"])
    report = _report()
    existing = {_normalized(item.username) for item in db.scalars(select(User)).all() if not item.is_deleted}
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            username_value = as_required_str(values.get("username"), field="username")
            key = _normalized(username_value)
            if key in existing or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="username", message="Duplicate username skipped")
                continue
            seen.add(key)
            pending.append(
                {
                    "username": username_value,
                    "role": as_required_str(values.get("role"), field="role"),
                    "password": as_required_str(values.get("password"), field="password"),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        users_router.create_user(UserCreate(**payload), db, current_user)

    return report


@router.get("/personnel/export")
def export_personnel(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    sort: str | None = None,
    service: str | None = None,
    department: str | None = None,
    shop: str | None = None,
    division: str | None = None,
    organisation: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    query = select(Personnel).options(selectinload(Personnel.user), selectinload(Personnel.schedule_template))
    if not include_deleted:
        query = query.where(Personnel.is_deleted == False)
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
        [Personnel.first_name, Personnel.last_name, Personnel.middle_name, Personnel.position, Personnel.personnel_number],
    )
    query = apply_sort(query, Personnel, sort)
    items = db.scalars(query).all()
    return build_export_response(
        filename_prefix="personnel",
        file_format=format,
        headers=[
            "user_username",
            "schedule_template_label",
            "first_name",
            "last_name",
            "middle_name",
            "role",
            "position",
            "personnel_number",
            "service",
            "shop",
            "department",
            "division",
            "birth_date",
            "hire_date",
            "organisation",
            "email",
            "phone",
            "notes",
        ],
        rows=[
            [
                item.user.username if item.user else "",
                item.schedule_template.label if item.schedule_template else "",
                item.first_name,
                item.last_name,
                item.middle_name,
                item.role,
                item.position,
                item.personnel_number,
                item.service,
                item.shop,
                item.department,
                item.division,
                item.birth_date,
                item.hire_date,
                item.organisation,
                item.email,
                item.phone,
                item.notes,
            ]
            for item in items
        ],
    )


@router.get("/personnel/template")
def template_personnel(user: User = Depends(require_space_access(SpaceKey.personnel, "read"))):
    return build_template_response(
        filename_prefix="personnel-template",
        headers=[
            "user_username",
            "schedule_template_label",
            "first_name",
            "last_name",
            "middle_name",
            "role",
            "position",
            "personnel_number",
            "service",
            "shop",
            "department",
            "division",
            "birth_date",
            "hire_date",
            "organisation",
            "email",
            "phone",
            "notes",
        ],
        readme_lines=[
            "Personnel import template",
            "Required columns: first_name, last_name, position.",
            "Use user_username and schedule_template_label for readable links.",
        ],
    )


@router.post("/personnel/import", response_model=ImportReport)
def import_personnel(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["first_name", "last_name", "position"])
    report = _report()
    username_lookup = _build_username_lookup(db)
    schedule_lookup = _build_schedule_template_lookup(db)
    existing_keys = {
        _normalized(item.personnel_number)
        or "|".join([_normalized(item.last_name), _normalized(item.first_name), _normalized(item.middle_name), _normalized(item.position)])
        for item in db.scalars(select(Personnel)).all()
        if not item.is_deleted
    }
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            first_name = as_required_str(values.get("first_name"), field="first_name")
            last_name = as_required_str(values.get("last_name"), field="last_name")
            position = as_required_str(values.get("position"), field="position")
            personnel_number = as_optional_str(values.get("personnel_number"))
            key = _normalized(personnel_number) or "|".join([_normalized(last_name), _normalized(first_name), _normalized(as_optional_str(values.get("middle_name"))), _normalized(position)])
            if key in existing_keys or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="personnel_number", message="Duplicate personnel row skipped")
                continue
            seen.add(key)
            pending.append(
                {
                    "user_id": _require_lookup_id(username_lookup, values.get("user_username"), message="User not found"),
                    "schedule_template_id": _require_lookup_id(schedule_lookup, values.get("schedule_template_label"), message="Schedule template not found"),
                    "first_name": first_name,
                    "last_name": last_name,
                    "middle_name": as_optional_str(values.get("middle_name")),
                    "role": as_optional_str(values.get("role")),
                    "position": position,
                    "personnel_number": personnel_number,
                    "service": as_optional_str(values.get("service")),
                    "shop": as_optional_str(values.get("shop")),
                    "department": as_optional_str(values.get("department")),
                    "division": as_optional_str(values.get("division")),
                    "birth_date": as_optional_date(values.get("birth_date")),
                    "hire_date": as_optional_date(values.get("hire_date")),
                    "organisation": as_optional_str(values.get("organisation")),
                    "email": as_optional_str(values.get("email")),
                    "phone": as_optional_str(values.get("phone")),
                    "notes": as_optional_str(values.get("notes")),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        personnel_router.create_personnel(PersonnelCreate(**payload), db, current_user)

    return report


@router.get("/personnel/{person_id}/competencies/export")
def export_personnel_competencies(
    person_id: int,
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    personnel_router.ensure_personnel(db, person_id, include_deleted=True)
    query = select(PersonnelCompetency).where(PersonnelCompetency.personnel_id == person_id)
    if not include_deleted:
        query = query.where(PersonnelCompetency.is_deleted == False)
    items = db.scalars(query.order_by(PersonnelCompetency.id)).all()
    return build_export_response(
        filename_prefix=f"personnel-{person_id}-competencies",
        file_format=format,
        headers=["name", "organisation", "city", "completion_date"],
        rows=[[item.name, item.organisation, item.city, item.completion_date] for item in items],
    )


@router.get("/personnel/{person_id}/competencies/template")
def template_personnel_competencies(
    person_id: int,
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    return build_template_response(
        filename_prefix=f"personnel-{person_id}-competencies-template",
        headers=["name", "organisation", "city", "completion_date"],
        readme_lines=[
            "Personnel competencies import template",
            "Required columns: name.",
            "The import works in the context of the selected employee.",
        ],
    )


@router.post("/personnel/{person_id}/competencies/import", response_model=ImportReport)
def import_personnel_competencies(
    person_id: int,
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["name"])
    personnel_router.ensure_personnel(db, person_id)
    report = _report()
    existing_keys = {
        "|".join([_normalized(item.name), _normalized(item.organisation), _normalized(item.city), _normalized(item.completion_date)])
        for item in db.scalars(select(PersonnelCompetency).where(PersonnelCompetency.personnel_id == person_id)).all()
        if not item.is_deleted
    }
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            name = as_required_str(values.get("name"), field="name")
            organisation_value = as_optional_str(values.get("organisation"))
            city_value = as_optional_str(values.get("city"))
            completion_date_value = as_optional_date(values.get("completion_date"))
            key = "|".join([_normalized(name), _normalized(organisation_value), _normalized(city_value), _normalized(completion_date_value)])
            if key in existing_keys or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="name", message="Duplicate competency skipped")
                continue
            seen.add(key)
            pending.append({"name": name, "organisation": organisation_value, "city": city_value, "completion_date": completion_date_value})
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        personnel_router.create_competency(person_id, PersonnelCompetencyCreate(**payload), db, current_user)

    return report


@router.get("/personnel/{person_id}/trainings/export")
def export_personnel_trainings(
    person_id: int,
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    personnel_router.ensure_personnel(db, person_id, include_deleted=True)
    query = select(PersonnelTraining).where(PersonnelTraining.personnel_id == person_id)
    if not include_deleted:
        query = query.where(PersonnelTraining.is_deleted == False)
    items = db.scalars(query.order_by(PersonnelTraining.id)).all()
    return build_export_response(
        filename_prefix=f"personnel-{person_id}-trainings",
        file_format=format,
        headers=["name", "completion_date", "next_due_date", "reminder_offset_days"],
        rows=[[item.name, item.completion_date, item.next_due_date, item.reminder_offset_days] for item in items],
    )


@router.get("/personnel/{person_id}/trainings/template")
def template_personnel_trainings(
    person_id: int,
    user: User = Depends(require_space_access(SpaceKey.personnel, "read")),
):
    return build_template_response(
        filename_prefix=f"personnel-{person_id}-trainings-template",
        headers=["name", "completion_date", "next_due_date", "reminder_offset_days"],
        readme_lines=[
            "Personnel trainings import template",
            "Required columns: name.",
            "The import works in the context of the selected employee.",
        ],
    )


@router.post("/personnel/{person_id}/trainings/import", response_model=ImportReport)
def import_personnel_trainings(
    person_id: int,
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_space_access(SpaceKey.personnel, "write")),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["name"])
    personnel_router.ensure_personnel(db, person_id)
    report = _report()
    existing_keys = {
        "|".join([_normalized(item.name), _normalized(item.completion_date), _normalized(item.next_due_date), _normalized(item.reminder_offset_days)])
        for item in db.scalars(select(PersonnelTraining).where(PersonnelTraining.personnel_id == person_id)).all()
        if not item.is_deleted
    }
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            name = as_required_str(values.get("name"), field="name")
            completion_date_value = as_optional_date(values.get("completion_date"))
            next_due_date_value = as_optional_date(values.get("next_due_date"))
            reminder_offset_days_value = as_optional_int(values.get("reminder_offset_days")) or 0
            key = "|".join([_normalized(name), _normalized(completion_date_value), _normalized(next_due_date_value), _normalized(reminder_offset_days_value)])
            if key in existing_keys or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="name", message="Duplicate training skipped")
                continue
            seen.add(key)
            pending.append(
                {
                    "name": name,
                    "completion_date": completion_date_value,
                    "next_due_date": next_due_date_value,
                    "reminder_offset_days": reminder_offset_days_value,
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        personnel_router.create_training(person_id, PersonnelTrainingCreate(**payload), db, current_user)

    return report


@router.get("/ipam/vlans/export")
def export_vlans(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    q: str | None = None,
    is_active: bool | None = None,
    location_id: int | None = None,
    sort: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Vlan).where(Vlan.is_deleted == False)
    if q:
        query = query.where(or_(Vlan.name.ilike(f"%{q}%"), Vlan.purpose.ilike(f"%{q}%")))
    if is_active is not None:
        query = query.where(Vlan.is_active == is_active)
    if location_id is not None:
        query = query.where(Vlan.location_id == location_id)
    if sort and getattr(Vlan, sort.lstrip("-"), None) is not None:
        column = getattr(Vlan, sort.lstrip("-"))
        query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
    else:
        query = query.order_by(Vlan.vlan_number.asc())
    items = db.scalars(query).all()
    _location_lookup, location_by_id = _build_location_lookup(db)
    return build_export_response(
        filename_prefix="ipam-vlans",
        file_format=format,
        headers=["vlan_number", "name", "purpose", "description", "location_full_path", "is_active"],
        rows=[
            [item.vlan_number, item.name, item.purpose, item.description, location_by_id.get(item.location_id, ""), item.is_active]
            for item in items
        ],
    )


@router.get("/ipam/vlans/template")
def template_vlans(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="ipam-vlans-template",
        headers=["vlan_number", "name", "purpose", "description", "location_full_path", "is_active"],
        readme_lines=["VLAN import template", "Required columns: vlan_number, name."],
    )


@router.post("/ipam/vlans/import", response_model=ImportReport)
def import_vlans(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["vlan_number", "name"])
    report = _report()
    location_lookup, _ = _build_location_lookup(db)
    existing = {_normalized(item.vlan_number) for item in db.scalars(select(Vlan)).all() if not item.is_deleted}
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            vlan_number_value = as_optional_int(values.get("vlan_number"))
            if vlan_number_value is None:
                raise ValueError("vlan_number is required")
            key = _normalized(vlan_number_value)
            if key in existing or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="vlan_number", message="Duplicate VLAN skipped")
                continue
            seen.add(key)
            parsed_is_active = as_optional_bool(values.get("is_active"))
            pending.append(
                {
                    "vlan_number": vlan_number_value,
                    "name": as_required_str(values.get("name"), field="name"),
                    "purpose": as_optional_str(values.get("purpose")),
                    "description": as_optional_str(values.get("description")),
                    "location_id": _require_lookup_id(location_lookup, values.get("location_full_path"), message="Location not found"),
                    "is_active": True if parsed_is_active is None else bool(parsed_is_active),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        ipam_router.create_vlan(VlanCreate(**payload), db, current_user)

    return report


@router.get("/ipam/subnets/export")
def export_subnets(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    q: str | None = None,
    sort: str | None = None,
    vlan_id: int | None = None,
    vlan_number: int | None = None,
    prefix: int | None = None,
    location_id: int | None = None,
    is_active: bool | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = select(Subnet).options(selectinload(Subnet.vlan)).where(Subnet.is_deleted == False)
    if q:
        query = query.where(or_(Subnet.cidr.ilike(f"%{q}%"), Subnet.name.ilike(f"%{q}%")))
    if vlan_id is not None:
        query = query.where(Subnet.vlan_id == vlan_id)
    if vlan_number is not None:
        query = query.join(Vlan, Subnet.vlan_id == Vlan.id).where(Vlan.vlan_number == vlan_number)
    if prefix is not None:
        query = query.where(Subnet.prefix == prefix)
    if location_id is not None:
        query = query.where(Subnet.location_id == location_id)
    if is_active is not None:
        query = query.where(Subnet.is_active == is_active)
    if sort and getattr(Subnet, sort.lstrip("-"), None) is not None:
        column = getattr(Subnet, sort.lstrip("-"))
        query = query.order_by(column.desc() if sort.startswith("-") else column.asc())
    else:
        query = query.order_by(Subnet.network_address.asc())
    items = db.scalars(query).all()
    _location_lookup, location_by_id = _build_location_lookup(db)
    vlan_by_id = {item.id: item for item in db.scalars(select(Vlan)).all()}
    return build_export_response(
        filename_prefix="ipam-subnets",
        file_format=format,
        headers=["cidr", "vlan_number", "gateway_ip", "name", "description", "location_full_path", "vrf", "is_active"],
        rows=[
            [
                item.cidr,
                vlan_by_id[item.vlan_id].vlan_number if item.vlan_id and item.vlan_id in vlan_by_id else "",
                item.gateway_ip,
                item.name,
                item.description,
                location_by_id.get(item.location_id, ""),
                item.vrf,
                item.is_active,
            ]
            for item in items
        ],
    )


@router.get("/ipam/subnets/template")
def template_subnets(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="ipam-subnets-template",
        headers=["cidr", "vlan_number", "gateway_ip", "name", "description", "location_full_path", "vrf", "is_active"],
        readme_lines=[
            "Subnets import template",
            "Required columns: cidr.",
            "Use vlan_number and location_full_path for readable references.",
        ],
    )


@router.post("/ipam/subnets/import", response_model=ImportReport)
def import_subnets(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["cidr"])
    report = _report()
    location_lookup, _ = _build_location_lookup(db)
    vlan_lookup = {_normalized(item.vlan_number): item for item in db.scalars(select(Vlan)).all() if not item.is_deleted}
    existing = {_normalized(item.cidr) for item in db.scalars(select(Subnet)).all() if not item.is_deleted}
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            cidr_value = as_required_str(values.get("cidr"), field="cidr")
            key = _normalized(cidr_value)
            if key in existing or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="cidr", message="Duplicate subnet skipped")
                continue
            seen.add(key)
            vlan_number_value = as_optional_int(values.get("vlan_number"))
            vlan_id_value = None
            if vlan_number_value is not None:
                vlan = vlan_lookup.get(_normalized(vlan_number_value))
                if vlan is None:
                    raise ValueError("VLAN not found")
                vlan_id_value = vlan.id
            parsed_is_active = as_optional_bool(values.get("is_active"))
            pending.append(
                {
                    "cidr": cidr_value,
                    "vlan_id": vlan_id_value,
                    "gateway_ip": as_optional_str(values.get("gateway_ip")),
                    "name": as_optional_str(values.get("name")),
                    "description": as_optional_str(values.get("description")),
                    "location_id": _require_lookup_id(location_lookup, values.get("location_full_path"), message="Location not found"),
                    "vrf": as_optional_str(values.get("vrf")),
                    "is_active": True if parsed_is_active is None else bool(parsed_is_active),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        ipam_router.create_subnet(SubnetCreate(**payload), db, current_user)

    return report


@router.get("/warehouse-items/export")
def export_warehouse_items(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    sort: str | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    equipment_type_id: int | None = None,
    manufacturer_id: int | None = None,
    equipment_category_id: int | None = None,
    equipment_type_name: str | None = None,
    equipment_type_name_alphabet: str | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = (
        select(WarehouseItem)
        .join(Warehouse, WarehouseItem.warehouse_id == Warehouse.id)
        .join(EquipmentType, WarehouseItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .outerjoin(EquipmentCategory, EquipmentType.equipment_category_id == EquipmentCategory.id)
        .options(
            selectinload(WarehouseItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(WarehouseItem.warehouse),
        )
    )
    if not include_deleted:
        query = query.where(WarehouseItem.is_deleted == False)
    if warehouse_id:
        query = query.where(WarehouseItem.warehouse_id == warehouse_id)
    if location_id:
        query = query.where(Warehouse.location_id == location_id)
    if equipment_type_id:
        query = query.where(WarehouseItem.equipment_type_id == equipment_type_id)
    if manufacturer_id:
        query = query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if equipment_category_id:
        query = query.where(EquipmentType.equipment_category_id == equipment_category_id)
    query = apply_text_filter(query, EquipmentType.name, equipment_type_name)
    query = apply_alphabet_filter(query, EquipmentType.name, equipment_type_name_alphabet)
    if q:
        if q.isdigit():
            query = query.where((WarehouseItem.warehouse_id == int(q)) | (WarehouseItem.equipment_type_id == int(q)))
        else:
            query = apply_search(query, q, [EquipmentType.name, Manufacturer.name, EquipmentCategory.name])
    if sort:
        query = apply_sort(query, WarehouseItem, sort)
    items = db.scalars(query).all()
    _location_lookup, location_by_id = _build_location_lookup(db)
    return build_export_response(
        filename_prefix="warehouse-items",
        file_format=format,
        headers=[
            "warehouse_name",
            "warehouse_location_full_path",
            "equipment_type_nomenclature_number",
            "equipment_type_name",
            "manufacturer_full_path",
            "quantity",
            "is_accounted",
        ],
        rows=[
            [
                item.warehouse.name if item.warehouse else "",
                location_by_id.get(item.warehouse.location_id if item.warehouse else None, ""),
                item.equipment_type.nomenclature_number if item.equipment_type else "",
                item.equipment_type.name if item.equipment_type else "",
                item.equipment_type.manufacturer.full_path if item.equipment_type and item.equipment_type.manufacturer else "",
                item.quantity,
                item.is_accounted,
            ]
            for item in items
        ],
    )


@router.get("/warehouse-items/template")
def template_warehouse_items(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="warehouse-items-template",
        headers=["warehouse_name", "warehouse_location_full_path", "equipment_type_nomenclature_number", "quantity", "is_accounted"],
        readme_lines=[
            "Warehouse items import template",
            "Required columns: warehouse_name, equipment_type_nomenclature_number, quantity.",
            "Duplicates are skipped instead of updating existing rows.",
        ],
    )


@router.post("/warehouse-items/import", response_model=ImportReport)
def import_warehouse_items(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["warehouse_name", "equipment_type_nomenclature_number", "quantity"])
    report = _report()
    _location_lookup, location_by_id = _build_location_lookup(db)
    equipment_type_lookup = _build_equipment_type_lookup(db)
    warehouse_lookup = {
        f"{_normalized(item.name)}|{_normalized(location_by_id.get(item.location_id, ''))}": item
        for item in db.scalars(select(Warehouse)).all()
        if not item.is_deleted
    }
    existing = {f"{item.warehouse_id}|{item.equipment_type_id}" for item in db.scalars(select(WarehouseItem)).all() if not item.is_deleted}
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            warehouse_name_value = as_required_str(values.get("warehouse_name"), field="warehouse_name")
            warehouse_key = f"{_normalized(warehouse_name_value)}|{_normalized(as_optional_str(values.get('warehouse_location_full_path')))}"
            warehouse = warehouse_lookup.get(warehouse_key)
            if warehouse is None:
                raise ValueError("Warehouse not found")
            equipment_type_value = equipment_type_lookup.get(_normalized(as_required_str(values.get("equipment_type_nomenclature_number"), field="equipment_type_nomenclature_number")))
            if equipment_type_value is None:
                raise ValueError("Equipment type not found")
            key = f"{warehouse.id}|{equipment_type_value.id}"
            if key in existing or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="equipment_type_nomenclature_number", message="Duplicate warehouse item skipped")
                continue
            seen.add(key)
            parsed_is_accounted = as_optional_bool(values.get("is_accounted"))
            pending.append(
                {
                    "warehouse_id": warehouse.id,
                    "equipment_type_id": equipment_type_value.id,
                    "quantity": as_optional_int(values.get("quantity")) or 0,
                    "is_accounted": True if parsed_is_accounted is None else bool(parsed_is_accounted),
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        warehouse_items_router.create_warehouse_item(WarehouseItemCreate(**payload), db, current_user)

    return report


@router.get("/cabinet-items/export")
def export_cabinet_items(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    include_deleted: bool = False,
    q: str | None = None,
    sort: str | None = None,
    cabinet_id: int | None = None,
    equipment_type_id: int | None = None,
    manufacturer_id: int | None = None,
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    query = (
        select(CabinetItem)
        .join(EquipmentType, CabinetItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .options(
            selectinload(CabinetItem.equipment_type).selectinload(EquipmentType.manufacturer),
            selectinload(CabinetItem.cabinet),
        )
    )
    if not include_deleted:
        query = query.where(CabinetItem.is_deleted == False)
    if cabinet_id:
        query = query.where(CabinetItem.cabinet_id == cabinet_id)
    if equipment_type_id:
        query = query.where(CabinetItem.equipment_type_id == equipment_type_id)
    if manufacturer_id:
        query = query.where(EquipmentType.manufacturer_id == manufacturer_id)
    if q:
        if q.isdigit():
            query = query.where((CabinetItem.cabinet_id == int(q)) | (CabinetItem.equipment_type_id == int(q)))
        else:
            query = apply_search(query, q, [EquipmentType.name, Manufacturer.name])
    if sort:
        query = apply_sort(query, CabinetItem, sort)
    items = db.scalars(query).all()
    _location_lookup, location_by_id = _build_location_lookup(db)
    return build_export_response(
        filename_prefix="cabinet-items",
        file_format=format,
        headers=[
            "cabinet_name",
            "cabinet_factory_number",
            "cabinet_location_full_path",
            "equipment_type_nomenclature_number",
            "equipment_type_name",
            "manufacturer_full_path",
            "quantity",
        ],
        rows=[
            [
                item.cabinet.name if item.cabinet else "",
                item.cabinet.factory_number if item.cabinet else "",
                location_by_id.get(item.cabinet.location_id if item.cabinet else None, ""),
                item.equipment_type.nomenclature_number if item.equipment_type else "",
                item.equipment_type.name if item.equipment_type else "",
                item.equipment_type.manufacturer.full_path if item.equipment_type and item.equipment_type.manufacturer else "",
                item.quantity,
            ]
            for item in items
        ],
    )


@router.get("/cabinet-items/template")
def template_cabinet_items(user: User = Depends(require_read_access())):
    return build_template_response(
        filename_prefix="cabinet-items-template",
        headers=["cabinet_name", "cabinet_factory_number", "cabinet_location_full_path", "equipment_type_nomenclature_number", "quantity"],
        readme_lines=[
            "Cabinet items import template",
            "Required columns: cabinet_name, equipment_type_nomenclature_number, quantity.",
            "Duplicates are skipped instead of updating existing rows.",
        ],
    )


@router.post("/cabinet-items/import", response_model=ImportReport)
def import_cabinet_items(
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["cabinet_name", "equipment_type_nomenclature_number", "quantity"])
    report = _report()
    _location_lookup, location_by_id = _build_location_lookup(db)
    equipment_type_lookup = _build_equipment_type_lookup(db)
    cabinet_lookup = {
        "|".join([_normalized(item.name), _normalized(item.factory_number), _normalized(location_by_id.get(item.location_id, ""))]): item
        for item in db.scalars(select(Cabinet)).all()
        if not item.is_deleted
    }
    existing = {f"{item.cabinet_id}|{item.equipment_type_id}" for item in db.scalars(select(CabinetItem)).all() if not item.is_deleted}
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            cabinet_name_value = as_required_str(values.get("cabinet_name"), field="cabinet_name")
            cabinet_key = "|".join([
                _normalized(cabinet_name_value),
                _normalized(as_optional_str(values.get("cabinet_factory_number"))),
                _normalized(as_optional_str(values.get("cabinet_location_full_path"))),
            ])
            cabinet = cabinet_lookup.get(cabinet_key)
            if cabinet is None:
                raise ValueError("Cabinet not found")
            equipment_type_value = equipment_type_lookup.get(_normalized(as_required_str(values.get("equipment_type_nomenclature_number"), field="equipment_type_nomenclature_number")))
            if equipment_type_value is None:
                raise ValueError("Equipment type not found")
            key = f"{cabinet.id}|{equipment_type_value.id}"
            if key in existing or key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="equipment_type_nomenclature_number", message="Duplicate cabinet item skipped")
                continue
            seen.add(key)
            pending.append(
                {
                    "cabinet_id": cabinet.id,
                    "equipment_type_id": equipment_type_value.id,
                    "quantity": as_optional_int(values.get("quantity")) or 0,
                }
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.created = len(pending)
    if dry_run:
        return report

    for payload in pending:
        cabinet_items_router.create_cabinet_item(CabinetItemCreate(**payload), db, current_user)

    return report




@router.get("/io-signals/export")
def export_io_signals(
    equipment_in_operation_id: int = Query(..., ge=1),
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    ordering = case(
        (IOSignal.signal_type == SignalType.AI, 1),
        (IOSignal.signal_type == SignalType.DI, 2),
        (IOSignal.signal_type == SignalType.AO, 3),
        (IOSignal.signal_type == SignalType.DO, 4),
        else_=5,
    )
    items = db.scalars(
        select(IOSignal)
        .where(IOSignal.equipment_in_operation_id == equipment_in_operation_id, IOSignal.is_deleted == False)
        .order_by(ordering, IOSignal.channel_index)
    ).all()
    io_signals_router.attach_lookup_paths(items, db)
    signal_kind_paths = {
        item.id: _path_value(item)
        for item in db.scalars(select(SignalTypeDictionary).options(selectinload(SignalTypeDictionary.parent))).all()
    }
    return build_export_response(
        filename_prefix=f"io-signals-{equipment_in_operation_id}",
        file_format=format,
        headers=[
            "signal_type",
            "channel_index",
            "tag",
            "signal",
            "plc_absolute_address",
            "data_type_full_path",
            "signal_kind_full_path",
            "field_equipment_full_path",
            "connection_point",
            "range_from",
            "range_to",
            "full_range",
            "measurement_unit_full_path",
            "is_active",
        ],
        rows=[
            [
                item.signal_type.value if hasattr(item.signal_type, "value") else item.signal_type,
                item.channel_index,
                item.tag,
                item.signal,
                item.plc_absolute_address,
                item.data_type_full_path,
                signal_kind_paths.get(item.signal_kind_id, ""),
                item.field_equipment_full_path,
                item.connection_point,
                item.range_from,
                item.range_to,
                item.full_range,
                item.measurement_unit_full_path,
                item.is_active,
            ]
            for item in items
        ],
    )


@router.get("/io-signals/template")
def template_io_signals(
    equipment_in_operation_id: int = Query(..., ge=1),
    user: User = Depends(require_read_access()),
):
    return build_template_response(
        filename_prefix=f"io-signals-{equipment_in_operation_id}-template",
        headers=[
            "signal_type",
            "channel_index",
            "tag",
            "signal",
            "plc_absolute_address",
            "data_type_full_path",
            "signal_kind_full_path",
            "field_equipment_full_path",
            "connection_point",
            "range_from",
            "range_to",
            "full_range",
            "measurement_unit_full_path",
            "is_active",
        ],
        readme_lines=[
            "IO signals template",
            "Required columns: signal_type, channel_index.",
            "Import updates existing signals only and requires equipment_in_operation_id in the request context.",
        ],
    )


@router.post("/io-signals/import", response_model=ImportReport)
def import_io_signals(
    equipment_in_operation_id: int = Query(..., ge=1),
    file: UploadFile = File(...),
    format: str | None = Query(default=None, pattern="^(csv|xlsx)$"),
    dry_run: bool = True,
    db=Depends(get_db),
    current_user: User = Depends(require_write_access()),
):
    headers, rows = _read_headers(file, format)
    _ensure_headers(headers, ["signal_type", "channel_index"])
    report = _report()
    signals = db.scalars(
        select(IOSignal).where(IOSignal.equipment_in_operation_id == equipment_in_operation_id, IOSignal.is_deleted == False)
    ).all()
    signal_lookup = {
        f"{_normalized(item.signal_type.value if hasattr(item.signal_type, 'value') else item.signal_type)}|{item.channel_index}": item
        for item in signals
    }
    data_type_lookup = _build_tree_lookup(db.scalars(select(DataType).options(selectinload(DataType.parent))).all())
    signal_kind_lookup = _build_tree_lookup(db.scalars(select(SignalTypeDictionary).options(selectinload(SignalTypeDictionary.parent))).all())
    field_equipment_lookup = _build_tree_lookup(db.scalars(select(FieldEquipment).options(selectinload(FieldEquipment.parent))).all())
    measurement_lookup = _build_tree_lookup(db.scalars(select(MeasurementUnit).options(selectinload(MeasurementUnit.parent))).all())
    seen: set[str] = set()
    pending: list[tuple[IOSignal, dict[str, Any]]] = []

    for row_index, row in enumerate(rows, start=2):
        if is_blank_row(row):
            continue
        report.total_rows += 1
        values = row_to_mapping(headers, row)
        try:
            signal_type_value = as_required_str(values.get("signal_type"), field="signal_type")
            channel_index_value = as_optional_int(values.get("channel_index"))
            if channel_index_value is None:
                raise ValueError("channel_index is required")
            key = f"{_normalized(signal_type_value)}|{channel_index_value}"
            signal = signal_lookup.get(key)
            if signal is None:
                raise ValueError("Signal not found in selected equipment context")
            if key in seen:
                report.skipped_duplicates += 1
                _append_warning(report, row=row_index, field="channel_index", message="Duplicate signal row skipped")
                continue
            seen.add(key)
            parsed_is_active = as_optional_bool(values.get("is_active"))
            pending.append(
                (
                    signal,
                    {
                        "tag": as_optional_str(values.get("tag")),
                        "signal": as_optional_str(values.get("signal")),
                        "plc_absolute_address": as_optional_str(values.get("plc_absolute_address")),
                        "data_type_id": _require_lookup_id(data_type_lookup, values.get("data_type_full_path"), message="Data type not found"),
                        "signal_kind_id": _require_lookup_id(signal_kind_lookup, values.get("signal_kind_full_path"), message="Signal kind not found"),
                        "field_equipment_id": _require_lookup_id(field_equipment_lookup, values.get("field_equipment_full_path"), message="Field equipment not found"),
                        "connection_point": as_optional_str(values.get("connection_point")),
                        "range_from": as_optional_str(values.get("range_from")),
                        "range_to": as_optional_str(values.get("range_to")),
                        "full_range": as_optional_str(values.get("full_range")),
                        "measurement_unit_id": _require_lookup_id(measurement_lookup, values.get("measurement_unit_full_path"), message="Measurement unit not found"),
                        "is_active": True if parsed_is_active is None else bool(parsed_is_active),
                    },
                )
            )
        except ValueError as exc:
            _append_error(report, row=row_index, field=None, message=str(exc))

    report.updated = len(pending)
    if dry_run:
        return report

    for signal, payload in pending:
        io_signals_router.update_signal(signal.id, IOSignalUpdate(**payload), db, current_user)

    return report
