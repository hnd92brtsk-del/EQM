from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import EntityBase, Pagination, SoftDeleteFields


CAD_SCHEMA_VERSION = 1


class CadDocumentPayload(BaseModel):
    schema_version: Literal[1] = Field(alias="schemaVersion")
    pages: list[dict[str, Any]] = Field(default_factory=list)
    layers: list[dict[str, Any]] = Field(default_factory=list)
    elements: list[dict[str, Any]] = Field(default_factory=list)
    styles: dict[str, Any] = Field(default_factory=dict)
    profile_state: dict[str, Any] = Field(default_factory=dict, alias="profileState")
    extensions: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class CadDocumentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    profile: str = Field(default="generic", min_length=1, max_length=64)
    location_id: int | None = None
    owner_type: str | None = Field(default=None, max_length=64)
    owner_id: int | None = None
    document: CadDocumentPayload


class CadDocumentUpdate(BaseModel):
    expected_version: int = Field(ge=1, alias="expectedVersion")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    profile: str | None = Field(default=None, min_length=1, max_length=64)
    location_id: int | None = None
    owner_type: str | None = Field(default=None, max_length=64)
    owner_id: int | None = None
    document: CadDocumentPayload | None = None

    model_config = {"populate_by_name": True}


class CadVersionedMutation(BaseModel):
    expected_version: int = Field(ge=1, alias="expectedVersion")

    model_config = {"populate_by_name": True}


class CadDocumentOut(EntityBase, SoftDeleteFields):
    name: str
    description: str | None = None
    profile: str
    location_id: int | None = None
    owner_type: str | None = None
    owner_id: int | None = None
    schema_version: int
    row_version: int
    document: CadDocumentPayload
    created_by_id: int | None = None
    updated_by_id: int | None = None


class CadDocumentList(Pagination[CadDocumentOut]):
    pass


class CadEntityRef(BaseModel):
    entity_type: str = Field(alias="entityType", min_length=1, max_length=64)
    entity_id: str = Field(alias="entityId", min_length=1, max_length=128)

    model_config = {"populate_by_name": True}


class CadBindingSnapshot(BaseModel):
    name: str | None = None


class CadBindingResolution(BaseModel):
    entity_type: str = Field(alias="entityType")
    entity_id: str = Field(alias="entityId")
    status: Literal["resolved", "missing", "forbidden", "unsupported"]
    snapshot: CadBindingSnapshot | None = None

    model_config = {"populate_by_name": True}


class CadEntityResolveRequest(BaseModel):
    entities: list[CadEntityRef] = Field(max_length=500)


class CadEntityResolveResponse(BaseModel):
    items: list[CadBindingResolution]
