from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin, VersionMixin
from app.models.core import Location


class Assembly(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "assemblies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    meta_data: Mapped[dict | None] = mapped_column(JSONB)

    location: Mapped[Location | None] = relationship()


Index(
    "ix_assemblies_name_active_unique",
    Assembly.name,
    unique=True,
    postgresql_where=(Assembly.is_deleted == False),
)
