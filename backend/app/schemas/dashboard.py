from typing import List

from pydantic import BaseModel

from app.schemas.identity import UserIdentityOut


class EquipmentByTypeItem(BaseModel):
    equipment_type_id: int
    name: str
    quantity: int
    percent: float


class EquipmentByWarehouseItem(BaseModel):
    warehouse_id: int
    warehouse: str
    quantity: int


class MetricsOut(BaseModel):
    cabinets_total: int
    equipment_types_total: int
    warehouse_items_total: int
    cabinet_items_total: int
    signals_total: int


class DashboardOut(BaseModel):
    metrics: MetricsOut
    equipment_by_type: List[EquipmentByTypeItem]
    equipment_by_warehouse: List[EquipmentByWarehouseItem]


class DonutQtyItem(BaseModel):
    name: str
    qty: int


class DonutValueItem(BaseModel):
    name: str
    value_rub: float


class DashboardKpisOut(BaseModel):
    total_cabinets: int
    total_plc_in_cabinets: int
    total_plc_in_warehouses: int
    ai_total: int
    di_total: int
    ao_total: int
    do_total: int
    total_channels: int
    total_warehouse_value_rub: float


class DashboardDonutsOut(BaseModel):
    by_category: List[DonutQtyItem]
    by_warehouse_qty: List[DonutQtyItem]
    accounted_vs_not: List[DonutQtyItem]
    by_warehouse_value: List[DonutValueItem]


class DashboardOverviewOut(BaseModel):
    kpis: DashboardKpisOut
    donuts: DashboardDonutsOut


class RecentEquipmentActionOut(BaseModel):
    id: int
    actor_id: int
    identity: UserIdentityOut
    action: str
    entity: str
    entity_id: int | None = None
    created_at: str | None = None
    movement_type: str | None = None
    equipment_type: str | None = None
    username: str | None = None
    personnel_full_name: str | None = None
    personnel_role: str | None = None
    system_role: str | None = None
    display_user_label: str


class RecentLoginOut(BaseModel):
    id: int
    user_id: int
    identity: UserIdentityOut
    username: str | None = None
    personnel_full_name: str | None = None
    personnel_role: str | None = None
    system_role: str | None = None
    display_user_label: str
    started_at: str | None = None
    ended_at: str | None = None
    end_reason: str | None = None
