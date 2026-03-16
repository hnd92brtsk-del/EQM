from pydantic import BaseModel, Field
from app.schemas.common import EntityBase, SoftDeleteFields


class ManufacturerOut(EntityBase, SoftDeleteFields):
    name: str
    country: str
    parent_id: int | None = None
    full_path: str | None = None
    flag: str | None = None
    founded_year: int | None = None
    segment: str | None = None
    specialization: str | None = None
    website: str | None = None


class ManufacturerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    parent_id: int | None = None
    flag: str | None = Field(default=None, max_length=16)
    founded_year: int | None = None
    segment: str | None = Field(default=None, max_length=255)
    specialization: str | None = None
    website: str | None = Field(default=None, max_length=255)


class ManufacturerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    parent_id: int | None = None
    flag: str | None = Field(default=None, max_length=16)
    founded_year: int | None = None
    segment: str | None = Field(default=None, max_length=255)
    specialization: str | None = None
    website: str | None = Field(default=None, max_length=255)
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


class ManufacturerTreeNode(BaseModel):
    id: int
    name: str
    country: str
    parent_id: int | None = None
    full_path: str | None = None
    flag: str | None = None
    founded_year: int | None = None
    segment: str | None = None
    specialization: str | None = None
    website: str | None = None
    is_deleted: bool = False
    children: list["ManufacturerTreeNode"] = Field(default_factory=list)


ManufacturerTreeNode.model_rebuild()
