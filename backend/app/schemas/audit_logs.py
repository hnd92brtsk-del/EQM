from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class AuditLogOut(BaseModel):
    id: int
    actor_id: int
    action: str
    entity: str
    entity_id: int | None = None
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    created_at: datetime
