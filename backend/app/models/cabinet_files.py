from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin
from app.models.core import Cabinet
from app.models.security import User


class CabinetFile(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "cabinet_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    cabinet_id: Mapped[int] = mapped_column(ForeignKey("cabinets.id", ondelete="CASCADE"), index=True, nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ext: Mapped[str] = mapped_column(String(20), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    cabinet: Mapped[Cabinet] = relationship()
    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])
