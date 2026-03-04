from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, VersionMixin


class PidProcess(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "pid_processes"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


Index(
    "ix_pid_processes_location_name_active_unique",
    PidProcess.location_id,
    PidProcess.name,
    unique=True,
    postgresql_where=(PidProcess.is_deleted == False),
)
