from pydantic import BaseModel
from app.schemas.common import EntityBase, SoftDeleteFields


class CabinetItemOut(EntityBase, SoftDeleteFields):
    cabinet_id: int
    equipment_type_id: int
    quantity: int
