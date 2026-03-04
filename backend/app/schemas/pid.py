from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import EntityBase, SoftDeleteFields


PidNodeCategory = Literal["main", "instrument", "external"]
PidEdgeType = Literal["process", "signal", "control", "electric"]


class PidViewport(BaseModel):
    x: float
    y: float
    zoom: float = Field(gt=0)


class PidNodePosition(BaseModel):
    x: float
    y: float


class PidNode(BaseModel):
    id: str = Field(min_length=1)
    type: str = Field(min_length=1)
    category: PidNodeCategory
    symbolKey: str = Field(min_length=1)
    label: str = Field(default="", max_length=255)
    tag: str = Field(default="", max_length=100)
    position: PidNodePosition
    sourceRef: dict | None = None
    properties: dict = Field(default_factory=dict)


class PidEdge(BaseModel):
    id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    edgeType: PidEdgeType
    label: str = Field(default="", max_length=255)
    style: dict = Field(default_factory=dict)


class PidDiagramPayload(BaseModel):
    processId: int
    version: int = 1
    updatedAt: datetime
    viewport: PidViewport
    nodes: list[PidNode] = Field(default_factory=list)
    edges: list[PidEdge] = Field(default_factory=list)


class PidDiagramOut(PidDiagramPayload):
    pass


class PidProcessOut(EntityBase, SoftDeleteFields):
    location_id: int
    name: str
    description: str | None = None


class PidProcessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)


class PidProcessUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
