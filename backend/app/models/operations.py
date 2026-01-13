from sqlalchemy import Boolean, DateTime, Integer, ForeignKey, UniqueConstraint, func
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
    is_accounted: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    last_updated: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    warehouse: Mapped["Warehouse"] = relationship()
    equipment_type: Mapped["EquipmentType"] = relationship()

    __table_args__ = (
        UniqueConstraint("warehouse_id", "equipment_type_id", name="uq_warehouse_items_wh_eqtype"),
    )

    @property
    def equipment_type_name(self) -> str | None:
        return self.equipment_type.name if self.equipment_type else None

    @property
    def equipment_category_name(self) -> str | None:
        if not self.equipment_type or not self.equipment_type.equipment_category:
            return None
        return self.equipment_type.equipment_category.name

    @property
    def manufacturer_name(self) -> str | None:
        if not self.equipment_type or not self.equipment_type.manufacturer:
            return None
        return self.equipment_type.manufacturer.name

    @property
    def unit_price_rub(self) -> float | None:
        return self.equipment_type.unit_price_rub if self.equipment_type else None


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

    @property
    def equipment_type_name(self) -> str | None:
        return self.equipment_type.name if self.equipment_type else None

    @property
    def manufacturer_name(self) -> str | None:
        if not self.equipment_type or not self.equipment_type.manufacturer:
            return None
        return self.equipment_type.manufacturer.name


class AssemblyItem(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "assembly_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    assembly_id: Mapped[int] = mapped_column(ForeignKey("assemblies.id"), index=True, nullable=False)
    equipment_type_id: Mapped[int] = mapped_column(
        ForeignKey("equipment_types.id"), index=True, nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    assembly: Mapped["Assembly"] = relationship()
    equipment_type: Mapped["EquipmentType"] = relationship()

    __table_args__ = (
        UniqueConstraint("assembly_id", "equipment_type_id", name="uq_assembly_items_as_eqtype"),
    )

    @property
    def equipment_type_name(self) -> str | None:
        return self.equipment_type.name if self.equipment_type else None

    @property
    def manufacturer_name(self) -> str | None:
        if not self.equipment_type or not self.equipment_type.manufacturer:
            return None
        return self.equipment_type.manufacturer.name
