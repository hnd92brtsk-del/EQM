import enum
from sqlalchemy import String, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin, VersionMixin


class SignalType(enum.Enum):
    AI = "AI"
    AO = "AO"
    DI = "DI"
    DO = "DO"


class MeasurementType(enum.Enum):
    mA_4_20 = "4-20mA"
    v_0_10 = "0-10V"
    other = "other"


class IOSignal(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "io_signals"

    id: Mapped[int] = mapped_column(primary_key=True)
    cabinet_component_id: Mapped[int] = mapped_column(
        ForeignKey("cabinet_items.id"), index=True, nullable=False
    )

    tag_name: Mapped[str | None] = mapped_column(String(200))
    signal_name: Mapped[str | None] = mapped_column(String(500))
    plc_channel_address: Mapped[str | None] = mapped_column(String(100))

    signal_type: Mapped[SignalType] = mapped_column(
        Enum(
            SignalType,
            name="signal_type",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
    )
    measurement_type: Mapped[MeasurementType] = mapped_column(
        Enum(
            MeasurementType,
            name="measurement_type",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
    )

    terminal_connection: Mapped[str | None] = mapped_column(String(100))
    sensor_range: Mapped[str | None] = mapped_column(String(100))
    engineering_units: Mapped[str | None] = mapped_column(String(50))

    cabinet_component: Mapped["CabinetItem"] = relationship()
