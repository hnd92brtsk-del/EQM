from pydantic import BaseModel, Field
from enum import Enum
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
    cabinet_component_id: int
    tag_name: str | None = None
    signal_name: str | None = None
    plc_channel_address: str | None = None
    signal_type: SignalType
    measurement_type: MeasurementType
    terminal_connection: str | None = None
    sensor_range: str | None = None
    engineering_units: str | None = None


class IOSignalCreate(BaseModel):
    cabinet_component_id: int
    tag_name: str | None = Field(default=None, max_length=200)
    signal_name: str | None = Field(default=None, max_length=500)
    plc_channel_address: str | None = Field(default=None, max_length=100)
    signal_type: SignalType
    measurement_type: MeasurementType
    terminal_connection: str | None = Field(default=None, max_length=100)
    sensor_range: str | None = Field(default=None, max_length=100)
    engineering_units: str | None = Field(default=None, max_length=50)


class IOSignalUpdate(BaseModel):
    tag_name: str | None = Field(default=None, max_length=200)
    signal_name: str | None = Field(default=None, max_length=500)
    plc_channel_address: str | None = Field(default=None, max_length=100)
    signal_type: SignalType | None = None
    measurement_type: MeasurementType | None = None
    terminal_connection: str | None = Field(default=None, max_length=100)
    sensor_range: str | None = Field(default=None, max_length=100)
    engineering_units: str | None = Field(default=None, max_length=50)
    is_deleted: bool | None = None
