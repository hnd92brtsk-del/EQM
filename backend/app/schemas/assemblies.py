from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from app.schemas.common import EntityBase, SoftDeleteFields


class AssemblyOut(EntityBase, SoftDeleteFields):
    name: str
    location_id: int | None = None
    location_full_path: str | None = None
    meta_data: Optional[Dict[str, Any]] = None


class AssemblyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location_id: int | None = None
    meta_data: Optional[Dict[str, Any]] = None


class AssemblyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    location_id: int | None = None
    meta_data: Optional[Dict[str, Any]] = None
    is_deleted: bool | None = None
