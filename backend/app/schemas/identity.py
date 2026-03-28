from pydantic import BaseModel


class UserIdentityOut(BaseModel):
    user_id: int
    username: str | None = None
    personnel_full_name: str | None = None
    personnel_role: str | None = None
    system_role: str | None = None
    display_user_label: str
