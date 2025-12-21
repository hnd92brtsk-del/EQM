from pydantic import BaseModel
from datetime import datetime


class SessionOut(BaseModel):
    id: int
    user_id: int
    started_at: datetime
    ended_at: datetime | None = None
    end_reason: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
