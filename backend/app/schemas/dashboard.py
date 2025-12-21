from pydantic import BaseModel
from typing import List


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
