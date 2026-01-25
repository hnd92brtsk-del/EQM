from pydantic import BaseModel, Field


class IOTreeChannelDevice(BaseModel):
    equipment_in_operation_id: int
    equipment_name: str
    manufacturer_name: str | None = None
    nomenclature_number: str | None = None
    article: str | None = None
    ai_count: int
    di_count: int
    ao_count: int
    do_count: int
    signals_total: int


class IOTreeCabinet(BaseModel):
    id: int
    name: str
    factory_number: str | None = None
    inventory_number: str | None = None
    channel_devices: list[IOTreeChannelDevice] = Field(default_factory=list)


class IOTreeLocation(BaseModel):
    id: int
    name: str
    children: list["IOTreeLocation"] = Field(default_factory=list)
    cabinets: list[IOTreeCabinet] = Field(default_factory=list)


class IOTreeResponse(BaseModel):
    locations: list[IOTreeLocation] = Field(default_factory=list)


IOTreeLocation.model_rebuild()
