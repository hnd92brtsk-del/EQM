from fastapi import APIRouter, Depends
from sqlalchemy import select, func, cast, Float, and_, or_, case

from app.core.dependencies import get_db, get_current_user
from app.models.core import Cabinet, EquipmentType, Warehouse
from app.models.operations import WarehouseItem, CabinetItem
from app.models.io import IOSignal
from app.models.security import User
from app.schemas.dashboard import (
    DashboardOut,
    MetricsOut,
    EquipmentByTypeItem,
    EquipmentByWarehouseItem,
    DashboardOverviewOut,
    DashboardKpisOut,
    DashboardDonutsOut,
    DonutQtyItem,
    DonutValueItem,
)

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

    warehouse_qty = (
        select(
            WarehouseItem.equipment_type_id,
            func.sum(WarehouseItem.quantity).label("warehouse_qty"),
        )
        .where(WarehouseItem.is_deleted == False)
        .group_by(WarehouseItem.equipment_type_id)
        .subquery()
    )
    cabinet_qty = (
        select(
            CabinetItem.equipment_type_id,
            func.sum(CabinetItem.quantity).label("cabinet_qty"),
        )
        .where(CabinetItem.is_deleted == False)
        .group_by(CabinetItem.equipment_type_id)
        .subquery()
    )

    by_type_rows = db.execute(
        select(
            EquipmentType.id,
            EquipmentType.name,
            func.coalesce(warehouse_qty.c.warehouse_qty, 0),
            func.coalesce(cabinet_qty.c.cabinet_qty, 0),
        )
        .outerjoin(warehouse_qty, warehouse_qty.c.equipment_type_id == EquipmentType.id)
        .outerjoin(cabinet_qty, cabinet_qty.c.equipment_type_id == EquipmentType.id)
        .where(EquipmentType.is_deleted == False)
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


@router.get("/overview", response_model=DashboardOverviewOut)
def get_dashboard_overview(db=Depends(get_db), user: User = Depends(get_current_user)):
    price_expr = func.coalesce(
        cast(EquipmentType.meta_data["unit_price_rub"].astext, Float), 0.0
    )

    total_cabinets = db.scalar(
        select(func.count()).select_from(Cabinet).where(Cabinet.is_deleted == False)
    ) or 0

    total_plc_in_cabinets = db.scalar(
        select(func.coalesce(func.sum(CabinetItem.quantity), 0))
        .join(EquipmentType, CabinetItem.equipment_type_id == EquipmentType.id)
        .where(
            CabinetItem.is_deleted == False,
            EquipmentType.is_deleted == False,
            EquipmentType.is_channel_forming == True,
        )
    ) or 0

    total_plc_in_warehouses = db.scalar(
        select(func.coalesce(func.sum(WarehouseItem.quantity), 0))
        .join(EquipmentType, WarehouseItem.equipment_type_id == EquipmentType.id)
        .where(
            WarehouseItem.is_deleted == False,
            EquipmentType.is_deleted == False,
            EquipmentType.is_channel_forming == True,
        )
    ) or 0

    channel_sum_expr = (
        EquipmentType.ai_count
        + EquipmentType.di_count
        + EquipmentType.ao_count
        + EquipmentType.do_count
    )
    channel_total_expr = case(
        (channel_sum_expr > 0, channel_sum_expr),
        else_=EquipmentType.channel_count,
    )
    total_channels = db.scalar(
        select(func.coalesce(func.sum(CabinetItem.quantity * channel_total_expr), 0))
        .join(EquipmentType, CabinetItem.equipment_type_id == EquipmentType.id)
        .where(
            CabinetItem.is_deleted == False,
            EquipmentType.is_deleted == False,
            EquipmentType.is_channel_forming == True,
        )
    ) or 0

    total_warehouse_value_rub = db.scalar(
        select(func.coalesce(func.sum(WarehouseItem.quantity * price_expr), 0))
        .join(EquipmentType, WarehouseItem.equipment_type_id == EquipmentType.id)
        .where(
            WarehouseItem.is_deleted == False,
            EquipmentType.is_deleted == False,
        )
    ) or 0.0

    by_category_rows = db.execute(
        select(
            EquipmentType.name,
            func.coalesce(func.sum(WarehouseItem.quantity), 0).label("qty"),
        )
        .join(EquipmentType, WarehouseItem.equipment_type_id == EquipmentType.id)
        .where(
            WarehouseItem.is_deleted == False,
            EquipmentType.is_deleted == False,
        )
        .group_by(EquipmentType.name)
        .order_by(EquipmentType.name)
    ).all()

    by_category = [
        DonutQtyItem(name=row.name, qty=row.qty or 0)
        for row in by_category_rows
        if (row.qty or 0) > 0
    ]

    by_warehouse_qty_rows = db.execute(
        select(
            Warehouse.name,
            func.coalesce(func.sum(WarehouseItem.quantity), 0).label("qty"),
        )
        .select_from(Warehouse)
        .join(
            WarehouseItem,
            and_(
                WarehouseItem.warehouse_id == Warehouse.id,
                WarehouseItem.is_deleted == False,
            ),
            isouter=True,
        )
        .where(Warehouse.is_deleted == False)
        .group_by(Warehouse.name)
        .order_by(Warehouse.name)
    ).all()

    by_warehouse_qty = [
        DonutQtyItem(name=row.name, qty=row.qty or 0) for row in by_warehouse_qty_rows
    ]

    accounted_rows = db.execute(
        select(
            WarehouseItem.is_accounted,
            func.coalesce(func.sum(WarehouseItem.quantity), 0).label("qty"),
        )
        .where(WarehouseItem.is_deleted == False)
        .group_by(WarehouseItem.is_accounted)
    ).all()

    accounted_map = {bool(row.is_accounted): row.qty or 0 for row in accounted_rows}
    accounted_vs_not = [
        DonutQtyItem(name="Учтено", qty=accounted_map.get(True, 0)),
        DonutQtyItem(name="Не учтено", qty=accounted_map.get(False, 0)),
    ]

    by_warehouse_value_rows = db.execute(
        select(
            Warehouse.name,
            func.coalesce(func.sum(WarehouseItem.quantity * price_expr), 0).label(
                "value_rub"
            ),
        )
        .select_from(Warehouse)
        .join(
            WarehouseItem,
            and_(
                WarehouseItem.warehouse_id == Warehouse.id,
                WarehouseItem.is_deleted == False,
            ),
            isouter=True,
        )
        .join(
            EquipmentType,
            EquipmentType.id == WarehouseItem.equipment_type_id,
            isouter=True,
        )
        .where(
            Warehouse.is_deleted == False,
            or_(EquipmentType.is_deleted == False, EquipmentType.id == None),
        )
        .group_by(Warehouse.name)
        .order_by(Warehouse.name)
    ).all()

    by_warehouse_value = [
        DonutValueItem(name=row.name, value_rub=float(row.value_rub or 0))
        for row in by_warehouse_value_rows
    ]

    kpis = DashboardKpisOut(
        total_cabinets=total_cabinets,
        total_plc_in_cabinets=total_plc_in_cabinets,
        total_plc_in_warehouses=total_plc_in_warehouses,
        total_channels=total_channels,
        total_warehouse_value_rub=float(total_warehouse_value_rub or 0),
    )

    donuts = DashboardDonutsOut(
        by_category=by_category,
        by_warehouse_qty=by_warehouse_qty,
        accounted_vs_not=accounted_vs_not,
        by_warehouse_value=by_warehouse_value,
    )

    return DashboardOverviewOut(kpis=kpis, donuts=donuts)
