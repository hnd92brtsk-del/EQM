from datetime import date
from sqlalchemy import String, Integer, Boolean, ForeignKey, Index, Date, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin, VersionMixin
from app.models.security import User


class Manufacturer(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "manufacturers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)


Index(
    "ix_manufacturers_name_active_unique",
    Manufacturer.name,
    unique=True,
    postgresql_where=(Manufacturer.is_deleted == False),
)


class EquipmentCategory(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "equipment_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    nomenclatures: Mapped[list["EquipmentType"]] = relationship(
        back_populates="equipment_category"
    )


Index(
    "ix_equipment_categories_name_active_unique",
    EquipmentCategory.name,
    unique=True,
    postgresql_where=(EquipmentCategory.is_deleted == False),
)


class Location(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    parent: Mapped["Location | None"] = relationship(
        remote_side="Location.id", backref="children"
    )

    def full_path(self) -> str:
        parts: list[str] = []
        current: Location | None = self
        seen: set[int] = set()
        while current and current.id not in seen:
            parts.append(current.name)
            seen.add(current.id)
            current = current.parent
        return " / ".join(reversed(parts))


class EquipmentType(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "equipment_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    nomenclature_number: Mapped[str] = mapped_column(String(100), nullable=False)
    manufacturer_id: Mapped[int] = mapped_column(
        ForeignKey("manufacturers.id"), index=True, nullable=False
    )
    equipment_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_categories.id"), index=True
    )
    is_channel_forming: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    channel_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    ai_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    di_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    ao_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    do_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    is_network: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    network_ports: Mapped[list[dict] | None] = mapped_column(JSONB)
    meta_data: Mapped[dict | None] = mapped_column(JSONB)

    manufacturer: Mapped[Manufacturer] = relationship()
    equipment_category: Mapped[EquipmentCategory | None] = relationship(
        back_populates="nomenclatures"
    )

    @property
    def unit_price_rub(self) -> float | None:
        if not self.meta_data:
            return None
        value = self.meta_data.get("unit_price_rub")
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


Index(
    "ix_equipment_types_nomenclature_active_unique",
    EquipmentType.nomenclature_number,
    unique=True,
    postgresql_where=(EquipmentType.is_deleted == False),
)


class Warehouse(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    meta_data: Mapped[dict | None] = mapped_column(JSONB)

    location: Mapped[Location | None] = relationship()


class Cabinet(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "cabinets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    factory_number: Mapped[str | None] = mapped_column(String(100))
    nomenclature_number: Mapped[str | None] = mapped_column(String(100))
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    meta_data: Mapped[dict | None] = mapped_column(JSONB)

    location: Mapped[Location | None] = relationship()

class Personnel(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "personnel"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    position: Mapped[str] = mapped_column(String(200), nullable=False)
    personnel_number: Mapped[str | None] = mapped_column(String(50))
    service: Mapped[str | None] = mapped_column(String(200))
    shop: Mapped[str | None] = mapped_column(String(200))
    department: Mapped[str | None] = mapped_column(String(200))
    division: Mapped[str | None] = mapped_column(String(200))
    birth_date: Mapped[date | None] = mapped_column(Date)
    hire_date: Mapped[date | None] = mapped_column(Date)
    organisation: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User | None] = relationship(foreign_keys=[user_id])
    competencies: Mapped[list["PersonnelCompetency"]] = relationship(
        back_populates="personnel", cascade="all, delete-orphan"
    )
    trainings: Mapped[list["PersonnelTraining"]] = relationship(
        back_populates="personnel", cascade="all, delete-orphan"
    )

    @property
    def tenure_years(self) -> int | None:
        if not self.hire_date:
            return None
        return (date.today() - self.hire_date).days // 365


Index(
    "ix_personnel_personnel_number_active_unique",
    Personnel.personnel_number,
    unique=True,
    postgresql_where=(Personnel.is_deleted == False),
)


class PersonnelCompetency(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "personnel_competencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    personnel_id: Mapped[int] = mapped_column(ForeignKey("personnel.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    organisation: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(200))
    completion_date: Mapped[date | None] = mapped_column(Date)

    personnel: Mapped[Personnel] = relationship(back_populates="competencies")

    @property
    def completion_age_days(self) -> int | None:
        if not self.completion_date:
            return None
        return (date.today() - self.completion_date).days


class PersonnelTraining(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "personnel_trainings"

    id: Mapped[int] = mapped_column(primary_key=True)
    personnel_id: Mapped[int] = mapped_column(ForeignKey("personnel.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    completion_date: Mapped[date | None] = mapped_column(Date)
    next_due_date: Mapped[date | None] = mapped_column(Date)
    reminder_offset_days: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)

    personnel: Mapped[Personnel] = relationship(back_populates="trainings")

    @property
    def days_until_due(self) -> int | None:
        if not self.next_due_date:
            return None
        return (self.next_due_date - date.today()).days

    @property
    def days_since_completion(self) -> int | None:
        if not self.completion_date:
            return None
        return (date.today() - self.completion_date).days

