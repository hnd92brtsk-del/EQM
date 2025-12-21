import enum
from sqlalchemy import String, Enum, CheckConstraint, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class MovementType(enum.Enum):
    inbound = "inbound"
    transfer = "transfer"
    to_cabinet = "to_cabinet"
    from_cabinet = "from_cabinet"
    direct_to_cabinet = "direct_to_cabinet"
    writeoff = "writeoff"
    adjustment = "adjustment"


class EquipmentMovement(Base, TimestampMixin):
    __tablename__ = "equipment_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    movement_type: Mapped[MovementType] = mapped_column(
        Enum(MovementType, name="movement_type"), nullable=False, index=True
    )

    equipment_type_id: Mapped[int] = mapped_column(
        ForeignKey("equipment_types.id"), index=True, nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    from_warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"), index=True)
    to_warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"), index=True)

    from_cabinet_id: Mapped[int | None] = mapped_column(ForeignKey("cabinets.id"), index=True)
    to_cabinet_id: Mapped[int | None] = mapped_column(ForeignKey("cabinets.id"), index=True)

    reference: Mapped[str | None] = mapped_column(String(200))
    comment: Mapped[str | None] = mapped_column(String(1000))

    performed_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_equipment_movements_qty_positive"),
    )
