from datetime import datetime

from pydantic import BaseModel

from app.schemas.identity import UserIdentityOut


class SessionOut(BaseModel):
    id: int
    user_id: int
    identity: UserIdentityOut
    username: str | None = None
    personnel_full_name: str | None = None
    personnel_role: str | None = None
    system_role: str | None = None
    display_user_label: str
    started_at: datetime
    ended_at: datetime | None = None
    end_reason: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
