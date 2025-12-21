from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields


class ManufacturerOut(EntityBase, SoftDeleteFields):
    name: str
    country: str


class ManufacturerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    country: str = Field(min_length=1, max_length=100)


class ManufacturerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    is_deleted: bool | None = None
