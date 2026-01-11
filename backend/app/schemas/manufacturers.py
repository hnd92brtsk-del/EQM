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


class ImportIssue(BaseModel):
    row: int | None = None
    field: str | None = None
    message: str


class ImportReport(BaseModel):
    total_rows: int
    created: int
    skipped_duplicates: int
    errors: list[ImportIssue]
    warnings: list[ImportIssue]
