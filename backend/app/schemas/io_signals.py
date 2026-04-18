from enum import Enum
from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, SoftDeleteFields


class SignalType(str, Enum):
    AI = "AI"
    AO = "AO"
    DI = "DI"
    DO = "DO"


class IOSignalOut(EntityBase, SoftDeleteFields):
    equipment_in_operation_id: int
    signal_type: SignalType
    channel_index: int
    tag: str | None = None
    signal: str | None = None
    plc_absolute_address: str | None = None
    data_type_id: int | None = None
    data_type_full_path: str | None = None
    signal_kind_id: int | None = None
    equipment_category_id: int | None = None
    equipment_category_full_path: str | None = None
    connection_point: str | None = None
    range_from: str | None = None
    range_to: str | None = None
    full_range: str | None = None
    measurement_unit_id: int | None = None
    measurement_unit_full_path: str | None = None
    is_active: bool


class IOSignalUpdate(BaseModel):
    tag: str | None = Field(default=None, max_length=200)
    signal: str | None = Field(default=None, max_length=500)
    plc_absolute_address: str | None = Field(default=None, max_length=255)
    data_type_id: int | None = None
    signal_kind_id: int | None = None
    equipment_category_id: int | None = None
    connection_point: str | None = Field(default=None, max_length=255)
    range_from: str | None = Field(default=None, max_length=255)
    range_to: str | None = Field(default=None, max_length=255)
    full_range: str | None = Field(default=None, max_length=255)
    measurement_unit_id: int | None = None
    is_active: bool | None = None
