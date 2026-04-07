from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, VersionMixin


# ---------------------------------------------------------------------------
# Dictionaries
# ---------------------------------------------------------------------------

class MntFailureMode(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "mnt_failure_modes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50))
    equipment_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_categories.id", ondelete="SET NULL"), index=True
    )
    description: Mapped[str | None] = mapped_column(Text)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_failure_modes.id", ondelete="SET NULL"), index=True
    )
    parent: Mapped["MntFailureMode | None"] = relationship(
        remote_side="MntFailureMode.id", backref="children"
    )


class MntFailureMechanism(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "mnt_failure_mechanisms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)


class MntFailureCause(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "mnt_failure_causes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50))
    category: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)


class MntDetectionMethod(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "mnt_detection_methods"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)


class MntActivityType(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "mnt_activity_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50))
    category: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------

class MntIncident(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "mnt_incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_number: Mapped[str | None] = mapped_column(String(50), unique=True)
    cabinet_id: Mapped[int] = mapped_column(
        ForeignKey("cabinets.id"), index=True, nullable=False
    )
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id"), index=True
    )
    severity: Mapped[str | None] = mapped_column(String(20))
    detection_method_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_detection_methods.id", ondelete="SET NULL")
    )
    failure_mode_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_failure_modes.id", ondelete="SET NULL")
    )
    failure_mechanism_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_failure_mechanisms.id", ondelete="SET NULL")
    )
    failure_cause_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_failure_causes.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(20), server_default="open", nullable=False)
    occurred_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    detected_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    repair_started_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    root_cause_analysis: Mapped[str | None] = mapped_column(Text)
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    man_hours: Mapped[float | None] = mapped_column(Numeric(8, 2))
    downtime_hours: Mapped[float | None] = mapped_column(Numeric(8, 2))
    operational_impact: Mapped[str | None] = mapped_column(String(32))
    reported_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    assigned_to_id: Mapped[int | None] = mapped_column(
        ForeignKey("personnel.id", ondelete="SET NULL")
    )

    cabinet: Mapped["Cabinet"] = relationship(foreign_keys=[cabinet_id])
    reported_by: Mapped["User"] = relationship(foreign_keys=[reported_by_id])
    failure_mode: Mapped["MntFailureMode | None"] = relationship(foreign_keys=[failure_mode_id])
    failure_mechanism: Mapped["MntFailureMechanism | None"] = relationship(foreign_keys=[failure_mechanism_id])
    failure_cause: Mapped["MntFailureCause | None"] = relationship(foreign_keys=[failure_cause_id])
    detection_method: Mapped["MntDetectionMethod | None"] = relationship(foreign_keys=[detection_method_id])
    components: Mapped[list["MntIncidentComponent"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )


class MntIncidentComponent(Base, TimestampMixin):
    __tablename__ = "mnt_incident_components"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(
        ForeignKey("mnt_incidents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cabinet_item_id: Mapped[int] = mapped_column(
        ForeignKey("cabinet_items.id"), index=True, nullable=False
    )
    equipment_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_types.id")
    )
    failure_mode_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_failure_modes.id", ondelete="SET NULL")
    )
    damage_description: Mapped[str | None] = mapped_column(Text)
    action_taken: Mapped[str | None] = mapped_column(String(50))

    incident: Mapped["MntIncident"] = relationship(back_populates="components")
    cabinet_item: Mapped["CabinetItem"] = relationship(foreign_keys=[cabinet_item_id])


# ---------------------------------------------------------------------------
# Work Orders
# ---------------------------------------------------------------------------

class MntWorkOrder(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "mnt_work_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str | None] = mapped_column(String(50), unique=True)
    order_type: Mapped[str] = mapped_column(String(32), nullable=False)
    activity_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_activity_types.id", ondelete="SET NULL")
    )
    priority: Mapped[str] = mapped_column(String(20), server_default="normal", nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="planned", nullable=False)
    cabinet_id: Mapped[int | None] = mapped_column(
        ForeignKey("cabinets.id"), index=True
    )
    incident_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_incidents.id", ondelete="SET NULL")
    )
    plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_plans.id", ondelete="SET NULL")
    )
    planned_start_date: Mapped[Date | None] = mapped_column(Date)
    planned_end_date: Mapped[Date | None] = mapped_column(Date)
    actual_start_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    actual_end_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    estimated_man_hours: Mapped[float | None] = mapped_column(Numeric(8, 2))
    actual_man_hours: Mapped[float | None] = mapped_column(Numeric(8, 2))
    assigned_to_id: Mapped[int | None] = mapped_column(
        ForeignKey("personnel.id", ondelete="SET NULL")
    )
    performed_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    completion_notes: Mapped[str | None] = mapped_column(Text)

    cabinet: Mapped["Cabinet | None"] = relationship(foreign_keys=[cabinet_id])
    incident: Mapped["MntIncident | None"] = relationship(foreign_keys=[incident_id])
    items: Mapped[list["MntWorkOrderItem"]] = relationship(
        back_populates="work_order", cascade="all, delete-orphan"
    )


class MntWorkOrderItem(Base, TimestampMixin):
    __tablename__ = "mnt_work_order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_order_id: Mapped[int] = mapped_column(
        ForeignKey("mnt_work_orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cabinet_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("cabinet_items.id")
    )
    equipment_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_types.id")
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    work_order: Mapped["MntWorkOrder"] = relationship(back_populates="items")


# ---------------------------------------------------------------------------
# Maintenance Plans
# ---------------------------------------------------------------------------

class MntPlan(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "mnt_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50))
    equipment_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_categories.id", ondelete="SET NULL")
    )
    equipment_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_types.id", ondelete="SET NULL")
    )
    cabinet_id: Mapped[int | None] = mapped_column(
        ForeignKey("cabinets.id", ondelete="SET NULL")
    )
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False)
    activity_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("mnt_activity_types.id", ondelete="SET NULL")
    )
    estimated_man_hours: Mapped[float | None] = mapped_column(Numeric(8, 2))
    description: Mapped[str | None] = mapped_column(Text)
    last_generated_date: Mapped[Date | None] = mapped_column(Date)
    next_due_date: Mapped[Date | None] = mapped_column(Date)


# ---------------------------------------------------------------------------
# Operating Time
# ---------------------------------------------------------------------------

class MntOperatingTime(Base, TimestampMixin):
    __tablename__ = "mnt_operating_time"

    id: Mapped[int] = mapped_column(primary_key=True)
    cabinet_id: Mapped[int] = mapped_column(
        ForeignKey("cabinets.id"), index=True, nullable=False
    )
    recorded_date: Mapped[Date] = mapped_column(Date, nullable=False)
    operating_hours: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, server_default="0")
    standby_hours: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, server_default="0")
    downtime_hours: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, server_default="0")
    recorded_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)

    cabinet: Mapped["Cabinet"] = relationship(foreign_keys=[cabinet_id])

    __table_args__ = (
        UniqueConstraint("cabinet_id", "recorded_date", name="uq_mnt_operating_time_cab_date"),
    )


# Avoid circular imports — these are only used for relationship type hints
from app.models.core import Cabinet  # noqa: E402
from app.models.operations import CabinetItem  # noqa: E402
from app.models.security import User  # noqa: E402
