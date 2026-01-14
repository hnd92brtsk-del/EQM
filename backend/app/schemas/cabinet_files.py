from datetime import datetime
from pydantic import BaseModel


class CabinetFileOut(BaseModel):
    id: int
    cabinet_id: int
    original_name: str
    ext: str
    size_bytes: int
    mime: str
    created_at: datetime
    created_by_id: int
