from sqlalchemy import DateTime, Integer, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin, VersionMixin


class WarehouseItem(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "warehouse_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), index=True, nullable=False)
    equipment_type_id: Mapped[int] = mapped_column(
        ForeignKey("equipment_types.id"), index=True, nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_updated: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    warehouse: Mapped["Warehouse"] = relationship()
    equipment_type: Mapped["EquipmentType"] = relationship()

    __table_args__ = (
        UniqueConstraint("warehouse_id", "equipment_type_id", name="uq_warehouse_items_wh_eqtype"),
    )


class CabinetItem(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "cabinet_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    cabinet_id: Mapped[int] = mapped_column(ForeignKey("cabinets.id"), index=True, nullable=False)
    equipment_type_id: Mapped[int] = mapped_column(
        ForeignKey("equipment_types.id"), index=True, nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    cabinet: Mapped["Cabinet"] = relationship()
    equipment_type: Mapped["EquipmentType"] = relationship()

    __table_args__ = (
        UniqueConstraint("cabinet_id", "equipment_type_id", name="uq_cabinet_items_cb_eqtype"),
    )
