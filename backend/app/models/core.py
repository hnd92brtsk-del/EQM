from sqlalchemy import String, Integer, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, SoftDeleteMixin, VersionMixin


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
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    meta_data: Mapped[dict | None] = mapped_column(JSONB)

    location: Mapped[Location | None] = relationship()


