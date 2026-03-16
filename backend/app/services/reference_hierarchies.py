from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import EquipmentCategory, EquipmentType, Manufacturer

REFERENCE_DATA_DIR = Path(__file__).resolve().parents[1] / "reference_data"

EQUIPMENT_CATEGORY_NAME_ALIASES = {
    "плк": "Программируемые логические контроллеры (ПЛК)",
}

COUNTRY_NAME_ALIASES = {
    "germany": "германия",
    "deutschland": "германия",
    "usa": "сша",
    "united states": "сша",
    "switzerland": "швейцария",
    "france": "франция",
    "japan": "япония",
    "austria": "австрия",
    "ireland": "ирландия",
    "denmark": "дания",
    "taiwan": "тайвань",
    "china": "китай",
    "russia": "россия",
}


def _normalize(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip().casefold()


def _load_reference_data(filename: str) -> list[dict]:
    path = REFERENCE_DATA_DIR / filename
    return json.loads(path.read_text(encoding="utf-8"))


def _get_or_create_category(
    db: Session,
    name: str,
    parent_id: int | None,
) -> tuple[EquipmentCategory, str]:
    active = db.scalar(
        select(EquipmentCategory).where(
            EquipmentCategory.name == name,
            EquipmentCategory.parent_id == parent_id,
            EquipmentCategory.is_deleted == False,
        )
    )
    if active:
        return active, "existing"

    deleted = db.scalar(
        select(EquipmentCategory).where(
            EquipmentCategory.name == name,
            EquipmentCategory.parent_id == parent_id,
            EquipmentCategory.is_deleted == True,
        )
    )
    if deleted:
        deleted.is_deleted = False
        deleted.deleted_at = None
        deleted.deleted_by_id = None
        return deleted, "restored"

    item = EquipmentCategory(name=name, parent_id=parent_id)
    db.add(item)
    db.flush()
    return item, "created"


def _get_or_create_manufacturer(
    db: Session,
    *,
    name: str,
    country: str,
    parent_id: int | None,
    flag: str | None = None,
    founded_year: int | None = None,
    segment: str | None = None,
    specialization: str | None = None,
    website: str | None = None,
) -> tuple[Manufacturer, str]:
    active = db.scalar(
        select(Manufacturer).where(
            Manufacturer.name == name,
            Manufacturer.parent_id == parent_id,
            Manufacturer.is_deleted == False,
        )
    )
    if active:
        active.country = country
        active.flag = flag
        active.founded_year = founded_year
        active.segment = segment
        active.specialization = specialization
        active.website = website
        return active, "existing"

    deleted = db.scalar(
        select(Manufacturer).where(
            Manufacturer.name == name,
            Manufacturer.parent_id == parent_id,
            Manufacturer.is_deleted == True,
        )
    )
    if deleted:
        deleted.is_deleted = False
        deleted.deleted_at = None
        deleted.deleted_by_id = None
        deleted.country = country
        deleted.flag = flag
        deleted.founded_year = founded_year
        deleted.segment = segment
        deleted.specialization = specialization
        deleted.website = website
        return deleted, "restored"

    item = Manufacturer(
        name=name,
        country=country,
        parent_id=parent_id,
        flag=flag,
        founded_year=founded_year,
        segment=segment,
        specialization=specialization,
        website=website,
    )
    db.add(item)
    db.flush()
    return item, "created"


def _mark_deleted(items: list[EquipmentCategory] | list[Manufacturer]) -> int:
    changed = 0
    for item in items:
        if not item.is_deleted:
            item.is_deleted = True
            changed += 1
    return changed


def import_equipment_categories(db: Session) -> dict[str, int]:
    rows = _load_reference_data("equipment_categories.json")
    stats = {
        "created": 0,
        "restored": 0,
        "existing": 0,
        "archived": 0,
        "remapped_equipment_types": 0,
    }
    new_ids: set[int] = set()
    name_lookup: dict[str, list[EquipmentCategory]] = {}
    subcategory_nodes: dict[tuple[str, str], EquipmentCategory] = {}
    leaf_nodes: dict[tuple[str, str, str], EquipmentCategory] = {}

    for row in rows:
        category_name = row["category"]
        subcategory_name = row["subcategory"]
        leaf_name = row["name"]

        category, status = _get_or_create_category(db, category_name, None)
        stats[status] += 1
        new_ids.add(category.id)

        subcategory_key = (category_name, subcategory_name)
        subcategory = subcategory_nodes.get(subcategory_key)
        if subcategory is None:
            subcategory, status = _get_or_create_category(db, subcategory_name, category.id)
            stats[status] += 1
            subcategory_nodes[subcategory_key] = subcategory
        new_ids.add(subcategory.id)

        leaf_key = (category_name, subcategory_name, leaf_name)
        leaf = leaf_nodes.get(leaf_key)
        if leaf is None:
            leaf, status = _get_or_create_category(db, leaf_name, subcategory.id)
            stats[status] += 1
            leaf_nodes[leaf_key] = leaf
        new_ids.add(leaf.id)

    active_items = db.scalars(
        select(EquipmentCategory).where(EquipmentCategory.is_deleted == False)
    ).all()
    for item in active_items:
        name_lookup.setdefault(_normalize(item.name), []).append(item)

    category_alias_targets: dict[str, EquipmentCategory] = {}
    for alias, target_name in EQUIPMENT_CATEGORY_NAME_ALIASES.items():
        candidates = [item for item in name_lookup.get(_normalize(target_name), []) if item.id in new_ids]
        if len(candidates) == 1:
            category_alias_targets[alias] = candidates[0]

    referenced = db.scalars(
        select(EquipmentCategory).join(EquipmentType, EquipmentType.equipment_category_id == EquipmentCategory.id)
    ).all()
    remap_by_old_id: dict[int, int] = {}
    for item in referenced:
        if item.id in new_ids:
            continue
        candidates = [candidate for candidate in name_lookup.get(_normalize(item.name), []) if candidate.id in new_ids]
        target = candidates[0] if len(candidates) == 1 else category_alias_targets.get(_normalize(item.name))
        if target is None:
            raise ValueError(f"Cannot safely remap equipment category '{item.name}' (id={item.id})")
        remap_by_old_id[item.id] = target.id

    for old_id, new_id in remap_by_old_id.items():
        equipment_types = db.scalars(
            select(EquipmentType).where(EquipmentType.equipment_category_id == old_id)
        ).all()
        for equipment in equipment_types:
            equipment.equipment_category_id = new_id
            stats["remapped_equipment_types"] += 1

    stale_items = db.scalars(
        select(EquipmentCategory).where(
            EquipmentCategory.is_deleted == False,
            EquipmentCategory.id.not_in(new_ids),
        )
    ).all()
    stats["archived"] = _mark_deleted(stale_items)
    return stats


def import_manufacturers(db: Session) -> dict[str, int]:
    rows = _load_reference_data("manufacturers.json")
    stats = {
        "created": 0,
        "restored": 0,
        "existing": 0,
        "archived": 0,
        "remapped_equipment_types": 0,
    }
    new_ids: set[int] = set()
    country_nodes: dict[str, Manufacturer] = {}
    brand_nodes_by_name: dict[str, list[Manufacturer]] = {}

    for row in rows:
        country_name = row["country"]
        country = country_nodes.get(country_name)
        if country is None:
            country, status = _get_or_create_manufacturer(
                db,
                name=country_name,
                country=country_name,
                parent_id=None,
            )
            stats[status] += 1
            country_nodes[country_name] = country
            new_ids.add(country.id)

        brand, status = _get_or_create_manufacturer(
            db,
            name=row["brand_name"],
            country=country.name,
            parent_id=country.id,
            flag=row.get("flag"),
            founded_year=row.get("founded_year"),
            segment=row.get("segment"),
            specialization=row.get("specialization"),
            website=row.get("website"),
        )
        stats[status] += 1
        new_ids.add(brand.id)
        brand_nodes_by_name.setdefault(_normalize(brand.name), []).append(brand)

    referenced = db.scalars(
        select(Manufacturer).join(EquipmentType, EquipmentType.manufacturer_id == Manufacturer.id)
    ).all()
    remap_by_old_id: dict[int, int] = {}
    for item in referenced:
        if item.id in new_ids:
            continue

        candidates = [candidate for candidate in brand_nodes_by_name.get(_normalize(item.name), []) if candidate.id in new_ids]
        target: Manufacturer | None = None
        if len(candidates) == 1:
            target = candidates[0]
        elif candidates:
            normalized_country = _normalize(item.country)
            normalized_country = COUNTRY_NAME_ALIASES.get(normalized_country, normalized_country)
            exact_country_matches = [candidate for candidate in candidates if _normalize(candidate.country) == normalized_country]
            if len(exact_country_matches) == 1:
                target = exact_country_matches[0]

        if target is None:
            raise ValueError(f"Cannot safely remap manufacturer '{item.name}' (id={item.id})")
        remap_by_old_id[item.id] = target.id

    for old_id, new_id in remap_by_old_id.items():
        equipment_types = db.scalars(
            select(EquipmentType).where(EquipmentType.manufacturer_id == old_id)
        ).all()
        for equipment in equipment_types:
            equipment.manufacturer_id = new_id
            stats["remapped_equipment_types"] += 1

    stale_items = db.scalars(
        select(Manufacturer).where(
            Manufacturer.is_deleted == False,
            Manufacturer.id.not_in(new_ids),
        )
    ).all()
    stats["archived"] = _mark_deleted(stale_items)
    return stats
