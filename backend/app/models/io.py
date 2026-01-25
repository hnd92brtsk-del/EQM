import enum
from sqlalchemy import Boolean, String, Enum, ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin, VersionMixin


class SignalType(enum.Enum):
    AI = "AI"
    AO = "AO"
    DI = "DI"
    DO = "DO"


class MeasurementType(enum.Enum):
    mA_4_20_ai = "4-20mA (AI)"
    mA_0_20_ai = "0-20mA (AI)"
    v_0_10_ai = "0-10V (AI)"
    pt100_rtd_ai = "Pt100 (RTD AI)"
    pt1000_rtd_ai = "Pt1000 (RTD AI)"
    m50_rtd_ai = "M50 (RTD AI)"
    v_24_di = "24V (DI)"
    v_220_di = "220V (DI)"
    mA_8_16_di = "8-16mA (DI)"


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
    signal_kind_id: Mapped[int | None] = mapped_column(
        ForeignKey("signal_types.id", ondelete="SET NULL"), index=True
    )
    measurement_type: Mapped[MeasurementType | None] = mapped_column(
        Enum(
            MeasurementType,
            name="measurement_type",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=True,
    )
    measurement_unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("measurement_units.id", ondelete="SET NULL"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    equipment_in_operation: Mapped["CabinetItem"] = relationship()
    signal_kind: Mapped["SignalTypeDictionary | None"] = relationship()
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
