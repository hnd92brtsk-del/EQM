from fastapi import APIRouter, Depends
from sqlalchemy import Float, and_, cast, func, or_, select, union_all

from app.core.access import require_space_access
from app.core.dependencies import get_db
from app.core.identity import build_full_name, build_personnel_identity_subquery, make_identity
from app.models.audit import AuditLog
from app.models.core import Cabinet, EquipmentType, Warehouse
from app.models.io import IOSignal
from app.models.operations import AssemblyItem, CabinetItem, WarehouseItem
from app.models.security import SpaceKey, User
from app.models.security import User as SecurityUser
from app.models.sessions import UserSession
from app.schemas.dashboard import (
    DashboardDonutsOut,
    DashboardKpisOut,
    DashboardOut,
    DashboardOverviewOut,
    DonutQtyItem,
    DonutValueItem,
    EquipmentByTypeItem,
    EquipmentByWarehouseItem,
    MetricsOut,
    RecentEquipmentActionOut,
    RecentLoginOut,
)

router = APIRouter()


@router.get("/", response_model=DashboardOut)
def get_dashboard(db=Depends(get_db), user: User = Depends(require_space_access(SpaceKey.overview, "read"))):
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
def get_dashboard_overview(db=Depends(get_db), user: User = Depends(require_space_access(SpaceKey.overview, "read"))):
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

    operation_qty = union_all(
        select(
            CabinetItem.equipment_type_id.label("equipment_type_id"),
            CabinetItem.quantity.label("quantity"),
        ).where(CabinetItem.is_deleted == False),
        select(
            AssemblyItem.equipment_type_id.label("equipment_type_id"),
            AssemblyItem.quantity.label("quantity"),
        ).where(AssemblyItem.is_deleted == False),
    ).subquery()

    channel_totals = db.execute(
        select(
            func.coalesce(func.sum(operation_qty.c.quantity * EquipmentType.ai_count), 0).label("ai_total"),
            func.coalesce(func.sum(operation_qty.c.quantity * EquipmentType.di_count), 0).label("di_total"),
            func.coalesce(func.sum(operation_qty.c.quantity * EquipmentType.ao_count), 0).label("ao_total"),
            func.coalesce(func.sum(operation_qty.c.quantity * EquipmentType.do_count), 0).label("do_total"),
        )
        .select_from(operation_qty)
        .join(EquipmentType, operation_qty.c.equipment_type_id == EquipmentType.id)
        .where(
            EquipmentType.is_deleted == False,
            EquipmentType.is_channel_forming == True,
        )
    ).one()

    ai_total = int(channel_totals.ai_total or 0)
    di_total = int(channel_totals.di_total or 0)
    ao_total = int(channel_totals.ao_total or 0)
    do_total = int(channel_totals.do_total or 0)
    total_channels = ai_total + di_total + ao_total + do_total

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
        ai_total=ai_total,
        di_total=di_total,
        ao_total=ao_total,
        do_total=do_total,
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


@router.get("/recent-equipment-actions", response_model=list[RecentEquipmentActionOut])
def get_recent_equipment_actions(
    limit: int = 10,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.overview, "read")),
):
    personnel_identity = build_personnel_identity_subquery()
    rows = db.execute(
        select(
            AuditLog,
            SecurityUser.username.label("username"),
            SecurityUser.role.label("system_role"),
            personnel_identity.c.first_name,
            personnel_identity.c.last_name,
            personnel_identity.c.middle_name,
            personnel_identity.c.personnel_role,
        )
        .join(SecurityUser, SecurityUser.id == AuditLog.actor_id)
        .outerjoin(personnel_identity, personnel_identity.c.user_id == SecurityUser.id)
        .where(
            or_(
                AuditLog.entity.ilike("%equipment%"),
                AuditLog.entity.ilike("%movement%"),
                AuditLog.entity.ilike("%warehouse%"),
                AuditLog.entity.ilike("%cabinet%"),
                AuditLog.entity.ilike("%assembl%"),
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    ).all()

    result = []
    for audit_log, username, system_role, first_name, last_name, middle_name, personnel_role in rows:
        personnel_full_name = build_full_name(last_name, first_name, middle_name)
        identity = make_identity(audit_log.actor_id, username, personnel_full_name, personnel_role, system_role)
        result.append(
            RecentEquipmentActionOut(
                id=audit_log.id,
                actor_id=audit_log.actor_id,
                identity=identity,
                action=audit_log.action,
                entity=audit_log.entity,
                entity_id=audit_log.entity_id,
                created_at=audit_log.created_at.isoformat() if audit_log.created_at else None,
                movement_type=(audit_log.meta or {}).get("movement_type"),
                equipment_type=(audit_log.meta or {}).get("equipment_type"),
                username=username,
                personnel_full_name=personnel_full_name,
                personnel_role=personnel_role,
                system_role=identity.system_role,
                display_user_label=identity.display_user_label,
            )
        )
    return result


@router.get("/recent-logins", response_model=list[RecentLoginOut])
def get_recent_logins(
    limit: int = 10,
    db=Depends(get_db),
    user: User = Depends(require_space_access(SpaceKey.overview, "read")),
):
    personnel_identity = build_personnel_identity_subquery()
    rows = db.execute(
        select(
            UserSession,
            SecurityUser.username.label("username"),
            SecurityUser.role.label("system_role"),
            personnel_identity.c.first_name,
            personnel_identity.c.last_name,
            personnel_identity.c.middle_name,
            personnel_identity.c.personnel_role,
        )
        .join(SecurityUser, SecurityUser.id == UserSession.user_id)
        .outerjoin(personnel_identity, personnel_identity.c.user_id == SecurityUser.id)
        .order_by(UserSession.started_at.desc())
        .limit(limit)
    ).all()

    result = []
    for session, username, system_role, first_name, last_name, middle_name, personnel_role in rows:
        personnel_full_name = build_full_name(last_name, first_name, middle_name)
        identity = make_identity(session.user_id, username, personnel_full_name, personnel_role, system_role)
        result.append(
            RecentLoginOut(
                id=session.id,
                user_id=session.user_id,
                identity=identity,
                username=username,
                personnel_full_name=personnel_full_name,
                personnel_role=personnel_role,
                system_role=identity.system_role,
                display_user_label=identity.display_user_label,
                started_at=session.started_at.isoformat() if session.started_at else None,
                ended_at=session.ended_at.isoformat() if session.ended_at else None,
                end_reason=session.end_reason,
            )
        )
    return result
