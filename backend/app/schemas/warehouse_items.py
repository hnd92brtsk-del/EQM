from pydantic import BaseModel
from app.schemas.common import EntityBase, SoftDeleteFields


class WarehouseItemOut(EntityBase, SoftDeleteFields):
    warehouse_id: int
    equipment_type_id: int
    quantity: int
