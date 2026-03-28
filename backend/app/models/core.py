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
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("manufacturers.id", ondelete="SET NULL"), index=True
    )
    flag: Mapped[str | None] = mapped_column(String(16))
    founded_year: Mapped[int | None] = mapped_column(Integer)
    segment: Mapped[str | None] = mapped_column(String(255))
    specialization: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(255))
    parent: Mapped["Manufacturer | None"] = relationship(
        remote_side="Manufacturer.id", backref="children"
    )

    @property
    def full_path(self) -> str:
        parts: list[str] = []
        current: Manufacturer | None = self
        seen: set[int] = set()
        while current and current.id not in seen:
            parts.append(current.name)
            seen.add(current.id)
            current = current.parent
        return " / ".join(reversed(parts))


Index(
    "ix_manufacturers_parent_name_active_unique",
    Manufacturer.parent_id,
    Manufacturer.name,
    unique=True,
    postgresql_where=(Manufacturer.is_deleted == False),
)


class EquipmentCategory(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "equipment_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_categories.id", ondelete="SET NULL"), index=True
    )
    parent: Mapped["EquipmentCategory | None"] = relationship(
        remote_side="EquipmentCategory.id", backref="children"
    )

    nomenclatures: Mapped[list["EquipmentType"]] = relationship(
        back_populates="equipment_category"
    )

    @property
    def full_path(self) -> str:
        parts: list[str] = []
        current: EquipmentCategory | None = self
        seen: set[int] = set()
        while current and current.id not in seen:
            parts.append(current.name)
            seen.add(current.id)
            current = current.parent
        return " / ".join(reversed(parts))


Index(
    "ix_equipment_categories_parent_name_active_unique",
    EquipmentCategory.parent_id,
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


class MainEquipment(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "main_equipment"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("main_equipment.id", ondelete="SET NULL"), index=True
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    meta_data: Mapped[dict | None] = mapped_column(JSONB)
    parent: Mapped["MainEquipment | None"] = relationship(
        remote_side="MainEquipment.id", backref="children"
    )


Index(
    "ix_main_equipment_code_active_unique",
    MainEquipment.code,
    unique=True,
    postgresql_where=(MainEquipment.is_deleted == False),
)


class MeasurementUnit(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "measurement_units"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("measurement_units.id", ondelete="SET NULL"), index=True
    )
    sort_order: Mapped[int | None] = mapped_column(Integer)
    parent: Mapped["MeasurementUnit | None"] = relationship(
        remote_side="MeasurementUnit.id", backref="children"
    )

    def full_path(self) -> str:
        parts: list[str] = []
        current: MeasurementUnit | None = self
        seen: set[int] = set()
        while current and current.id not in seen:
            parts.append(current.name)
            seen.add(current.id)
            current = current.parent
        return " / ".join(reversed(parts))


Index(
    "ix_measurement_units_parent_name_active_unique",
    MeasurementUnit.parent_id,
    MeasurementUnit.name,
    unique=True,
    postgresql_where=(MeasurementUnit.is_deleted == False),
)


class SignalTypeDictionary(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "signal_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("signal_types.id", ondelete="SET NULL"), index=True
    )
    sort_order: Mapped[int | None] = mapped_column(Integer)
    parent: Mapped["SignalTypeDictionary | None"] = relationship(
        remote_side="SignalTypeDictionary.id", backref="children"
    )

    def full_path(self) -> str:
        parts: list[str] = []
        current: SignalTypeDictionary | None = self
        seen: set[int] = set()
        while current and current.id not in seen:
            parts.append(current.name)
            seen.add(current.id)
            current = current.parent
        return " / ".join(reversed(parts))


Index(
    "ix_signal_types_parent_name_active_unique",
    SignalTypeDictionary.parent_id,
    SignalTypeDictionary.name,
    unique=True,
    postgresql_where=(SignalTypeDictionary.is_deleted == False),
)


class FieldEquipment(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "field_equipments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("field_equipments.id", ondelete="SET NULL"), index=True
    )
    parent: Mapped["FieldEquipment | None"] = relationship(
        remote_side="FieldEquipment.id", backref="children"
    )

    def full_path(self) -> str:
        parts: list[str] = []
        current: FieldEquipment | None = self
        seen: set[int] = set()
        while current and current.id not in seen:
            parts.append(current.name)
            seen.add(current.id)
            current = current.parent
        return " / ".join(reversed(parts))


Index(
    "ix_field_equipments_parent_name_active_unique",
    FieldEquipment.parent_id,
    FieldEquipment.name,
    unique=True,
    postgresql_where=(FieldEquipment.is_deleted == False),
)


class DataType(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "data_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_types.id", ondelete="SET NULL"), index=True
    )
    tooltip: Mapped[str | None] = mapped_column(Text)
    parent: Mapped["DataType | None"] = relationship(
        remote_side="DataType.id", backref="children"
    )

    def full_path(self) -> str:
        parts: list[str] = []
        current: DataType | None = self
        seen: set[int] = set()
        while current and current.id not in seen:
            parts.append(current.name)
            seen.add(current.id)
            current = current.parent
        return " / ".join(reversed(parts))


Index(
    "ix_data_types_parent_name_active_unique",
    DataType.parent_id,
    DataType.name,
    unique=True,
    postgresql_where=(DataType.is_deleted == False),
)


class EquipmentType(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "equipment_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    article: Mapped[str | None] = mapped_column(String(100))
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
    has_serial_interfaces: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    serial_ports: Mapped[list[dict]] = mapped_column(JSONB, server_default="[]", nullable=False)
    role_in_power_chain: Mapped[str | None] = mapped_column(String(32))
    current_type: Mapped[str | None] = mapped_column(String(32))
    supply_voltage: Mapped[str | None] = mapped_column(String(32))
    current_consumption_a: Mapped[float | None] = mapped_column(nullable=True)
    top_current_type: Mapped[str | None] = mapped_column(String(32))
    top_supply_voltage: Mapped[str | None] = mapped_column(String(32))
    bottom_current_type: Mapped[str | None] = mapped_column(String(32))
    bottom_supply_voltage: Mapped[str | None] = mapped_column(String(32))
    current_value_a: Mapped[float | None] = mapped_column(nullable=True)
    mount_type: Mapped[str | None] = mapped_column(String(32))
    mount_width_mm: Mapped[int | None] = mapped_column(Integer)
    power_role: Mapped[str | None] = mapped_column(String(32))
    output_voltage: Mapped[str | None] = mapped_column(String(32))
    max_output_current_a: Mapped[float | None] = mapped_column(nullable=True)
    meta_data: Mapped[dict | None] = mapped_column(JSONB)
    photo_filename: Mapped[str | None] = mapped_column(String(255))
    photo_mime: Mapped[str | None] = mapped_column(String(100))
    datasheet_filename: Mapped[str | None] = mapped_column(String(255))
    datasheet_mime: Mapped[str | None] = mapped_column(String(100))
    datasheet_original_name: Mapped[str | None] = mapped_column(String(255))

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

    @property
    def photo_url(self) -> str | None:
        if not self.photo_filename:
            return None
        return f"/equipment-types/{self.id}/photo"

    @property
    def datasheet_url(self) -> str | None:
        if not self.datasheet_filename:
            return None
        return f"/equipment-types/{self.id}/datasheet"

    @property
    def datasheet_name(self) -> str | None:
        return self.datasheet_original_name

    @property
    def power_attributes(self) -> dict[str, str | float | None]:
        return {
            "role_in_power_chain": self.role_in_power_chain,
            "current_type": self.current_type,
            "supply_voltage": self.supply_voltage,
            "top_current_type": self.top_current_type,
            "top_supply_voltage": self.top_supply_voltage,
            "bottom_current_type": self.bottom_current_type,
            "bottom_supply_voltage": self.bottom_supply_voltage,
            "current_value_a": self.current_value_a,
        }


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


class PersonnelScheduleTemplate(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "personnel_schedule_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    number: Mapped[str | None] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    personnel: Mapped[list["Personnel"]] = relationship(back_populates="schedule_template")


Index(
    "ix_personnel_schedule_templates_label_active_unique",
    PersonnelScheduleTemplate.label,
    unique=True,
    postgresql_where=(PersonnelScheduleTemplate.is_deleted == False),
)


class Personnel(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "personnel"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    schedule_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("personnel_schedule_templates.id"), index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    role: Mapped[str | None] = mapped_column(String(200))
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
    schedule_template: Mapped[PersonnelScheduleTemplate | None] = relationship(back_populates="personnel")
    competencies: Mapped[list["PersonnelCompetency"]] = relationship(
        back_populates="personnel", cascade="all, delete-orphan"
    )
    trainings: Mapped[list["PersonnelTraining"]] = relationship(
        back_populates="personnel", cascade="all, delete-orphan"
    )
    yearly_assignments: Mapped[list["PersonnelYearlyScheduleAssignment"]] = relationship(
        back_populates="personnel", cascade="all, delete-orphan"
    )
    yearly_events: Mapped[list["PersonnelYearlyScheduleEvent"]] = relationship(
        back_populates="personnel", cascade="all, delete-orphan"
    )

    @property
    def tenure_years(self) -> int | None:
        if not self.hire_date:
            return None
        return (date.today() - self.hire_date).days // 365

    @property
    def schedule_label(self) -> str | None:
        if self.schedule_template:
            return self.schedule_template.label
        return None


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


class PersonnelYearlyScheduleAssignment(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "personnel_yearly_schedule_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    personnel_id: Mapped[int] = mapped_column(ForeignKey("personnel.id"), index=True, nullable=False)
    year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    work_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(8), nullable=False)

    personnel: Mapped[Personnel] = relationship(back_populates="yearly_assignments")


Index(
    "ix_personnel_yearly_schedule_assignments_person_date_unique",
    PersonnelYearlyScheduleAssignment.personnel_id,
    PersonnelYearlyScheduleAssignment.work_date,
    unique=True,
)


class PersonnelYearlyScheduleEvent(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "personnel_yearly_schedule_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    personnel_id: Mapped[int] = mapped_column(ForeignKey("personnel.id"), index=True, nullable=False)
    year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    work_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)

    personnel: Mapped[Personnel] = relationship(back_populates="yearly_events")


Index(
    "ix_personnel_yearly_schedule_events_person_date_unique",
    PersonnelYearlyScheduleEvent.personnel_id,
    PersonnelYearlyScheduleEvent.work_date,
    unique=True,
)

