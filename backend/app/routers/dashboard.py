from fastapi import APIRouter, Depends
from sqlalchemy import select, func

from app.core.dependencies import get_db, get_current_user
from app.models.core import Cabinet, EquipmentType, Warehouse
from app.models.operations import WarehouseItem, CabinetItem
from app.models.io import IOSignal
from app.models.security import User
from app.schemas.dashboard import DashboardOut, MetricsOut, EquipmentByTypeItem, EquipmentByWarehouseItem

router = APIRouter()


@router.get("/", response_model=DashboardOut)
def get_dashboard(db=Depends(get_db), user: User = Depends(get_current_user)):
    cabinets_total = db.scalar(
        select(func.count()).select_from(Cabinet).where(Cabinet.is_deleted == False)
    ) or 0
    equipment_types_total = db.scalar(
        select(func.count()).select_from(EquipmentType).where(EquipmentType.is_deleted == False)
    ) or 0
    warehouse_items_total = db.scalar(
        select(func.coalesce(func.sum(WarehouseItem.quantity), 0)).where(WarehouseItem.is_deleted == False)
    ) or 0
    cabinet_items_total = db.scalar(
        select(func.coalesce(func.sum(CabinetItem.quantity), 0)).where(CabinetItem.is_deleted == False)
    ) or 0
    signals_total = db.scalar(
        select(func.count()).select_from(IOSignal).where(IOSignal.is_deleted == False)
    ) or 0

    total_equipment = warehouse_items_total + cabinet_items_total

    by_type_rows = db.execute(
        select(
            EquipmentType.id,
            EquipmentType.name,
            func.coalesce(func.sum(WarehouseItem.quantity), 0).label("warehouse_qty"),
            func.coalesce(func.sum(CabinetItem.quantity), 0).label("cabinet_qty"),
        )
        .join(WarehouseItem, WarehouseItem.equipment_type_id == EquipmentType.id, isouter=True)
        .join(CabinetItem, CabinetItem.equipment_type_id == EquipmentType.id, isouter=True)
        .where(EquipmentType.is_deleted == False)
        .group_by(EquipmentType.id, EquipmentType.name)
    ).all()

    equipment_by_type = []
    for row in by_type_rows:
        qty = (row.warehouse_qty or 0) + (row.cabinet_qty or 0)
        percent = (qty / total_equipment * 100) if total_equipment else 0
        equipment_by_type.append(
            EquipmentByTypeItem(
                equipment_type_id=row.id,
                name=row.name,
                quantity=qty,
                percent=round(percent, 2),
            )
        )

    by_warehouse_rows = db.execute(
        select(
            Warehouse.id,
            Warehouse.name,
            func.coalesce(func.sum(WarehouseItem.quantity), 0).label("quantity"),
        )
        .join(WarehouseItem, WarehouseItem.warehouse_id == Warehouse.id, isouter=True)
        .where(Warehouse.is_deleted == False)
        .group_by(Warehouse.id, Warehouse.name)
    ).all()

    equipment_by_warehouse = [
        EquipmentByWarehouseItem(
            warehouse_id=row.id,
            warehouse=row.name,
            quantity=row.quantity or 0,
        )
        for row in by_warehouse_rows
    ]

    metrics = MetricsOut(
        cabinets_total=cabinets_total,
        equipment_types_total=equipment_types_total,
        warehouse_items_total=warehouse_items_total,
        cabinet_items_total=cabinet_items_total,
        signals_total=signals_total,
    )

    return DashboardOut(
        metrics=metrics,
        equipment_by_type=equipment_by_type,
        equipment_by_warehouse=equipment_by_warehouse,
    )
