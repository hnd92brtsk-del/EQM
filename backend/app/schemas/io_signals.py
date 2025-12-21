from pydantic import BaseModel, Field
from enum import Enum
from app.schemas.common import EntityBase, SoftDeleteFields


class SignalType(str, Enum):
    AI = "AI"
    AO = "AO"
    DI = "DI"
    DO = "DO"


class MeasurementType(str, Enum):
    mA_4_20 = "4-20mA"
    v_0_10 = "0-10V"
    other = "other"


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
