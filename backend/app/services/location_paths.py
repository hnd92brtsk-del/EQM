from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable, TypeVar

from sqlalchemy import select

from app.models.core import Location

T = TypeVar("T")


@dataclass(frozen=True)
class LocationContext:
    locations_map: dict[int, Location]
    full_path_by_id: dict[int, str]
    children_by_parent: dict[int | None, list[int]]


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


def build_location_context(locations: Iterable[Location]) -> LocationContext:
    locations_map = {location.id: location for location in locations}
    full_path_by_id = {
        location_id: build_location_full_path(location_id, locations_map) or location.name
        for location_id, location in locations_map.items()
    }
    children_by_parent: dict[int | None, list[int]] = {}
    for location in locations_map.values():
        children_by_parent.setdefault(location.parent_id, []).append(location.id)
    return LocationContext(
        locations_map=locations_map,
        full_path_by_id=full_path_by_id,
        children_by_parent=children_by_parent,
    )


def load_location_context(db, location_ids: Iterable[int | None] | None = None) -> LocationContext:
    normalized_ids = {location_id for location_id in (location_ids or []) if location_id}
    if not normalized_ids:
        return build_location_context(db.scalars(select(Location)).all())

    pending_ids = set(normalized_ids)
    locations_map: dict[int, Location] = {}

    while pending_ids:
        batch = db.scalars(select(Location).where(Location.id.in_(pending_ids))).all()
        pending_ids = set()
        for location in batch:
            if location.id in locations_map:
                continue
            locations_map[location.id] = location
            if location.parent_id and location.parent_id not in locations_map:
                pending_ids.add(location.parent_id)

    return build_location_context(locations_map.values())


def attach_location_full_path(
    items: list[T],
    *,
    db,
    location_getter: Callable[[T], int | None],
    attribute_name: str = "location_full_path",
) -> None:
    context = load_location_context(db, [location_getter(item) for item in items])
    for item in items:
        setattr(item, attribute_name, context.full_path_by_id.get(location_getter(item)))
