from pydantic import BaseModel


class ImportIssue(BaseModel):
    row: int | None = None
    field: str | None = None
    message: str


class ImportReport(BaseModel):
    total_rows: int
    created: int
    updated: int = 0
    skipped_duplicates: int
    errors: list[ImportIssue]
    warnings: list[ImportIssue]
