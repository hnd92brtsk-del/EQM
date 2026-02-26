from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.dependencies import get_db, require_read_access
from app.models.core import Location, Cabinet, EquipmentType, Manufacturer
from app.models.operations import CabinetItem
from app.schemas.io_tree import (
    IOTreeResponse,
    IOTreeLocation,
    IOTreeCabinet,
    IOTreeChannelDevice,
)
from app.models.security import User

router = APIRouter()


def build_location_tree(locations: list[Location]) -> tuple[dict[int, IOTreeLocation], list[IOTreeLocation]]:
    nodes = {
        location.id: IOTreeLocation(id=location.id, name=location.name, children=[], cabinets=[])
        for location in locations
    }
    roots: list[IOTreeLocation] = []
    for location in locations:
        if location.parent_id and location.parent_id in nodes:
            nodes[location.parent_id].children.append(nodes[location.id])
        else:
            roots.append(nodes[location.id])
    return nodes, roots


@router.get("/io-tree", response_model=IOTreeResponse)
def get_io_tree(
    db=Depends(get_db),
    user: User = Depends(require_read_access()),
):
    locations = db.scalars(
        select(Location).where(Location.is_deleted == False).order_by(Location.id)
    ).all()
    nodes_map, roots = build_location_tree(locations)

    cabinets = db.scalars(
        select(Cabinet).where(Cabinet.is_deleted == False).order_by(Cabinet.id)
    ).all()

    equipment_rows = db.execute(
        select(
            CabinetItem.id.label("equipment_in_operation_id"),
            CabinetItem.cabinet_id.label("cabinet_id"),
            EquipmentType.name.label("equipment_name"),
            Manufacturer.name.label("manufacturer_name"),
            EquipmentType.nomenclature_number.label("nomenclature_number"),
            EquipmentType.article.label("article"),
            EquipmentType.ai_count.label("ai_count"),
            EquipmentType.di_count.label("di_count"),
            EquipmentType.ao_count.label("ao_count"),
            EquipmentType.do_count.label("do_count"),
        )
        .join(EquipmentType, CabinetItem.equipment_type_id == EquipmentType.id)
        .outerjoin(Manufacturer, EquipmentType.manufacturer_id == Manufacturer.id)
        .where(
            CabinetItem.is_deleted == False,
            EquipmentType.is_deleted == False,
            EquipmentType.is_channel_forming == True,
        )
        .order_by(CabinetItem.id)
    ).all()

    devices_by_cabinet: dict[int, list[IOTreeChannelDevice]] = {}
    for row in equipment_rows:
        data = dict(row._mapping)
        signals_total = (
            data["ai_count"] + data["di_count"] + data["ao_count"] + data["do_count"]
        )
        device = IOTreeChannelDevice(
            equipment_in_operation_id=data["equipment_in_operation_id"],
            equipment_name=data["equipment_name"],
            manufacturer_name=data.get("manufacturer_name"),
            nomenclature_number=data.get("nomenclature_number"),
            article=data.get("article"),
            ai_count=data["ai_count"],
            di_count=data["di_count"],
            ao_count=data["ao_count"],
            do_count=data["do_count"],
            signals_total=signals_total,
        )
        devices_by_cabinet.setdefault(data["cabinet_id"], []).append(device)

    for cabinet in cabinets:
        cabinet_node = IOTreeCabinet(
            id=cabinet.id,
            name=cabinet.name,
            factory_number=cabinet.factory_number,
            inventory_number=cabinet.nomenclature_number,
            channel_devices=devices_by_cabinet.get(cabinet.id, []),
        )
        if cabinet.location_id and cabinet.location_id in nodes_map:
            nodes_map[cabinet.location_id].cabinets.append(cabinet_node)

    return IOTreeResponse(locations=roots)
