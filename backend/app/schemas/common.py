from pydantic import BaseModel, Field
from typing import Generic, TypeVar, List, Optional
from datetime import datetime

T = TypeVar("T")


class Pagination(BaseModel, Generic[T]):
    items: List[T]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)
    total: int = Field(ge=0)


class EntityBase(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime


class SoftDeleteFields(BaseModel):
    is_deleted: bool
    deleted_at: Optional[datetime] = None
