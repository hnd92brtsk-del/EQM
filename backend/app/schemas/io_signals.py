from enum import Enum
from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, SoftDeleteFields


class SignalType(str, Enum):
    AI = "AI"
    AO = "AO"
    DI = "DI"
    DO = "DO"


class MeasurementType(str, Enum):
    mA_4_20_ai = "4-20mA (AI)"
    mA_0_20_ai = "0-20mA (AI)"
    v_0_10_ai = "0-10V (AI)"
    pt100_rtd_ai = "Pt100 (RTD AI)"
    pt1000_rtd_ai = "Pt1000 (RTD AI)"
    m50_rtd_ai = "M50 (RTD AI)"
    v_24_di = "24V (DI)"
    v_220_di = "220V (DI)"
    mA_8_16_di = "8-16mA (DI)"


class IOSignalOut(EntityBase, SoftDeleteFields):
    equipment_in_operation_id: int
    signal_type: SignalType
    channel_index: int
    tag: str | None = None
    signal: str | None = None
    signal_kind_id: int | None = None
    measurement_type: MeasurementType | None = None
    measurement_unit_id: int | None = None
    measurement_unit_full_path: str | None = None
    is_active: bool


class IOSignalUpdate(BaseModel):
    tag: str | None = Field(default=None, max_length=200)
    signal: str | None = Field(default=None, max_length=500)
    signal_kind_id: int | None = None
    measurement_type: MeasurementType | None = None
    measurement_unit_id: int | None = None
    is_active: bool | None = None
