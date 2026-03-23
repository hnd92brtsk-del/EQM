from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, Pagination, SoftDeleteFields


SerialMapNodeKind = Literal["equipment", "master", "slave", "sensor", "bus", "repeater", "gateway"]
SerialMapParity = Literal["None", "Even", "Odd", "Mark", "Space"]
SerialMapProtocol = Literal["Modbus RTU", "Profibus DP", "CAN Bus", "RS-485", "RS-232", "Custom"]
SerialMapDataDirection = Literal["rx", "tx"]
SerialMapAccess = Literal["R", "RW", "W"]


class SerialMapViewport(BaseModel):
    x: float = 0
    y: float = 0
    zoom: float = 1


class SerialPortDescriptor(BaseModel):
    type: str = Field(min_length=1, max_length=100)
    count: int = Field(ge=1, le=64)


class SerialMapEquipmentSource(BaseModel):
    source: Literal["cabinet", "assembly"]
    equipmentInOperationId: int
    equipmentTypeId: int
    containerId: int
    containerName: str = Field(min_length=1, max_length=255)


class SerialMapGatewayMapping(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    srcRegisterType: str = Field(default="", max_length=100)
    srcAddress: str = Field(default="", max_length=100)
    srcDataType: str = Field(default="", max_length=100)
    dstRegisterType: str = Field(default="", max_length=100)
    dstAddress: str = Field(default="", max_length=100)
    dstDataType: str = Field(default="", max_length=100)
    note: str = Field(default="", max_length=255)


class SerialMapDataPoolEntry(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    direction: SerialMapDataDirection
    registerType: str = Field(default="", max_length=100)
    address: str = Field(default="", max_length=100)
    name: str = Field(default="", max_length=255)
    dataType: str = Field(default="", max_length=100)
    valueExample: str = Field(default="", max_length=255)
    access: SerialMapAccess = "R"
    description: str = Field(default="", max_length=1000)
    sortOrder: int = 0


class SerialMapNode(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    kind: SerialMapNodeKind
    name: str = Field(min_length=1, max_length=255)
    protocol: SerialMapProtocol
    baudRate: int = Field(ge=0, le=12_000_000)
    address: int | None = Field(default=None, ge=0, le=65535)
    parity: SerialMapParity = "None"
    dataBits: int = Field(default=8, ge=5, le=9)
    stopBits: int = Field(default=1, ge=1, le=2)
    segment: int = Field(default=1, ge=1, le=9999)
    note: str = Field(default="", max_length=2000)
    width: float = Field(default=160, ge=20, le=5000)
    height: float = Field(default=88, ge=20, le=5000)
    position: dict[str, float]
    dataPool: list[SerialMapDataPoolEntry] = Field(default_factory=list)
    serialPorts: list[SerialPortDescriptor] = Field(default_factory=list)
    sourceRef: SerialMapEquipmentSource | None = None
    bridgeProtocol: SerialMapProtocol | None = None
    converterMappings: list[SerialMapGatewayMapping] = Field(default_factory=list)


class SerialMapEdge(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    fromNodeId: str = Field(min_length=1, max_length=100)
    toNodeId: str = Field(min_length=1, max_length=100)
    protocol: SerialMapProtocol
    baudRate: int = Field(ge=0, le=12_000_000)
    label: str = Field(default="", max_length=255)
    meta: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class SerialMapHistorySnapshot(BaseModel):
    nodes: list[SerialMapNode] = Field(default_factory=list)
    edges: list[SerialMapEdge] = Field(default_factory=list)
    viewport: SerialMapViewport = Field(default_factory=SerialMapViewport)


class SerialMapHistory(BaseModel):
    past: list[SerialMapHistorySnapshot] = Field(default_factory=list)
    future: list[SerialMapHistorySnapshot] = Field(default_factory=list)


class SerialMapDocumentData(BaseModel):
    version: Literal[2] = 2
    updatedAt: str = Field(min_length=1, max_length=100)
    viewport: SerialMapViewport = Field(default_factory=SerialMapViewport)
    nodes: list[SerialMapNode] = Field(default_factory=list)
    edges: list[SerialMapEdge] = Field(default_factory=list)
    history: SerialMapHistory = Field(default_factory=SerialMapHistory)


class LegacySerialMapScheme(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    viewport: SerialMapViewport = Field(default_factory=SerialMapViewport)
    nodes: list[SerialMapNode] = Field(default_factory=list)
    edges: list[SerialMapEdge] = Field(default_factory=list)
    history: SerialMapHistory = Field(default_factory=SerialMapHistory)


class LegacySerialMapProjectDocument(BaseModel):
    projectId: str = Field(min_length=1, max_length=100)
    version: Literal[1] = 1
    updatedAt: str = Field(min_length=1, max_length=100)
    activeSchemeId: str = Field(min_length=1, max_length=100)
    schemes: list[LegacySerialMapScheme] = Field(default_factory=list)


class SerialMapDocumentBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    scope: str | None = Field(default=None, max_length=64)
    location_id: int | None = None
    source_context: dict | None = None
    document: SerialMapDocumentData


class SerialMapDocumentCreate(SerialMapDocumentBase):
    pass


class SerialMapDocumentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    scope: str | None = Field(default=None, max_length=64)
    location_id: int | None = None
    source_context: dict | None = None
    document: SerialMapDocumentData | None = None


class SerialMapDocumentOut(EntityBase, SoftDeleteFields):
    name: str
    description: str | None = None
    scope: str | None = None
    location_id: int | None = None
    source_context: dict | None = None
    document: SerialMapDocumentData
    created_by_id: int | None = None
    updated_by_id: int | None = None


class SerialMapDuplicatePayload(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)


class SerialMapEligibleEquipmentOut(BaseModel):
    key: str = Field(min_length=1, max_length=100)
    id: int
    source: Literal["cabinet", "assembly"]
    containerId: int
    containerName: str = Field(min_length=1, max_length=255)
    equipmentTypeId: int
    equipmentTypeName: str = Field(min_length=1, max_length=255)
    manufacturerName: str | None = None
    displayName: str = Field(min_length=1, max_length=255)
    serialPorts: list[SerialPortDescriptor] = Field(default_factory=list)
    locationFullPath: str | None = None


class SerialMapDocumentPage(Pagination[SerialMapDocumentOut]):
    pass
