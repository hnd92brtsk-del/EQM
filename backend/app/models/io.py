import enum
from sqlalchemy import Boolean, String, Enum, ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin, VersionMixin


class SignalType(enum.Enum):
    AI = "AI"
    AO = "AO"
    DI = "DI"
    DO = "DO"


class IOSignal(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "io_signals"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_in_operation_id: Mapped[int] = mapped_column(
        ForeignKey("cabinet_items.id"), index=True, nullable=False
    )
    signal_type: Mapped[SignalType] = mapped_column(
        Enum(
            SignalType,
            name="signal_type",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
    )
    channel_index: Mapped[int] = mapped_column(Integer, nullable=False)

    tag: Mapped[str | None] = mapped_column(String(200))
    signal: Mapped[str | None] = mapped_column(String(500))
    plc_absolute_address: Mapped[str | None] = mapped_column(String(255))
    data_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_types.id", ondelete="SET NULL"), index=True
    )
    signal_kind_id: Mapped[int | None] = mapped_column(
        ForeignKey("signal_types.id", ondelete="SET NULL"), index=True
    )
    equipment_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_categories.id", ondelete="SET NULL"), index=True
    )
    connection_point: Mapped[str | None] = mapped_column(String(255))
    range_from: Mapped[str | None] = mapped_column(String(255))
    range_to: Mapped[str | None] = mapped_column(String(255))
    full_range: Mapped[str | None] = mapped_column(String(255))
    measurement_unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("measurement_units.id", ondelete="SET NULL"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    equipment_in_operation: Mapped["CabinetItem"] = relationship()
    data_type: Mapped["DataType | None"] = relationship()
    signal_kind: Mapped["SignalTypeDictionary | None"] = relationship()
    equipment_category: Mapped["EquipmentCategory | None"] = relationship()
    measurement_unit: Mapped["MeasurementUnit | None"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "equipment_in_operation_id",
            "signal_type",
            "channel_index",
            name="uq_io_signals_eio_type_channel",
        ),
        Index(
            "ix_io_signals_eio_signal_type",
            "equipment_in_operation_id",
            "signal_type",
        ),
    )
