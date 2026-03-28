from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.identity import UserIdentityOut


class AuditLogOut(BaseModel):
    id: int
    actor_id: int
    identity: UserIdentityOut
    username: str | None = None
    personnel_full_name: str | None = None
    personnel_role: str | None = None
    system_role: str | None = None
    display_user_label: str
    action: str
    entity: str
    entity_id: int | None = None
    before: Optional[dict[str, Any]] = None
    after: Optional[dict[str, Any]] = None
    meta: Optional[dict[str, Any]] = None
    created_at: datetime
