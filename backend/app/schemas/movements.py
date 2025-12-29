from pydantic import BaseModel, Field, model_validator
from enum import Enum
from typing import Optional
from app.schemas.common import EntityBase


class MovementType(str, Enum):
    inbound = "inbound"
    transfer = "transfer"
    to_cabinet = "to_cabinet"
    from_cabinet = "from_cabinet"
    direct_to_cabinet = "direct_to_cabinet"
    to_warehouse = "to_warehouse"
    writeoff = "writeoff"
    adjustment = "adjustment"


class MovementCreate(BaseModel):
    movement_type: MovementType
    equipment_type_id: int
    quantity: int = Field(ge=1)

    from_warehouse_id: Optional[int] = None
    to_warehouse_id: Optional[int] = None
    from_cabinet_id: Optional[int] = None
    to_cabinet_id: Optional[int] = None

    reference: Optional[str] = Field(default=None, max_length=200)
    comment: Optional[str] = Field(default=None, max_length=1000)
    is_accounted: Optional[bool] = None

    @model_validator(mode="after")
    def validate_targets(self):
        mt = self.movement_type
        if mt == MovementType.inbound:
            if not self.to_warehouse_id:
                raise ValueError("to_warehouse_id is required for inbound")
        if mt == MovementType.transfer:
            if not self.from_warehouse_id or not self.to_warehouse_id:
                raise ValueError("from_warehouse_id and to_warehouse_id are required for transfer")
        if mt == MovementType.to_cabinet:
            if not self.from_warehouse_id or not self.to_cabinet_id:
                raise ValueError("from_warehouse_id and to_cabinet_id are required for to_cabinet")
        if mt == MovementType.from_cabinet:
            if not self.from_cabinet_id or not self.to_warehouse_id:
                raise ValueError("from_cabinet_id and to_warehouse_id are required for from_cabinet")
        if mt == MovementType.direct_to_cabinet:
            if not self.to_cabinet_id:
                raise ValueError("to_cabinet_id is required for direct_to_cabinet")
        if mt == MovementType.to_warehouse:
            if not self.to_warehouse_id:
                raise ValueError("to_warehouse_id is required for to_warehouse")
        if mt == MovementType.writeoff:
            if not (self.from_warehouse_id or self.from_cabinet_id):
                raise ValueError("from_warehouse_id or from_cabinet_id is required for writeoff")
        if mt == MovementType.adjustment:
            if not (self.from_warehouse_id or self.from_cabinet_id or self.to_warehouse_id or self.to_cabinet_id):
                raise ValueError("from_* or to_* is required for adjustment")
        return self


class MovementOut(EntityBase):
    movement_type: MovementType
    equipment_type_id: int
    quantity: int
    from_warehouse_id: Optional[int] = None
    to_warehouse_id: Optional[int] = None
    from_cabinet_id: Optional[int] = None
    to_cabinet_id: Optional[int] = None
    reference: Optional[str] = None
    comment: Optional[str] = None
    performed_by_id: int
