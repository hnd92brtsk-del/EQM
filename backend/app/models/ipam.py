from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, VersionMixin


class Vlan(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "vlans"

    id: Mapped[int] = mapped_column(primary_key=True)
    vlan_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    purpose: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    location: Mapped["Location | None"] = relationship()


Index(
    "ix_vlans_vlan_number_active_unique",
    Vlan.vlan_number,
    unique=True,
    postgresql_where=(Vlan.is_deleted == False),
)
Index("ix_vlans_name", Vlan.name)


class Subnet(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "subnets"

    id: Mapped[int] = mapped_column(primary_key=True)
    vlan_id: Mapped[int | None] = mapped_column(ForeignKey("vlans.id", ondelete="SET NULL"), index=True)
    cidr: Mapped[str] = mapped_column(String(64), nullable=False)
    prefix: Mapped[int] = mapped_column(Integer, nullable=False)
    network_address: Mapped[str] = mapped_column(String(64), nullable=False)
    gateway_ip: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    vrf: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    vlan: Mapped["Vlan | None"] = relationship()
    location: Mapped["Location | None"] = relationship()

    __table_args__ = (
        CheckConstraint("prefix IN (16, 20, 24)", name="ck_subnets_prefix_allowed"),
    )


Index(
    "ix_subnets_cidr_active_unique",
    Subnet.cidr,
    unique=True,
    postgresql_where=(Subnet.is_deleted == False),
)
Index("ix_subnets_name", Subnet.name)


class EquipmentNetworkInterface(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "equipment_network_interfaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_instance_id: Mapped[int] = mapped_column(
        ForeignKey("cabinet_items.id", ondelete="CASCADE"), index=True, nullable=False
    )
    interface_name: Mapped[str] = mapped_column(String(255), nullable=False)
    interface_index: Mapped[int | None] = mapped_column(Integer)
    interface_type: Mapped[str | None] = mapped_column(String(100))
    connector_spec: Mapped[str | None] = mapped_column(String(100))
    mac_address: Mapped[str | None] = mapped_column(String(100))
    is_management: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    equipment_instance: Mapped["CabinetItem"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "equipment_instance_id",
            "interface_name",
            "interface_index",
            name="uq_equipment_network_interfaces_identity",
        ),
    )


class IPAddress(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "ip_addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    subnet_id: Mapped[int] = mapped_column(ForeignKey("subnets.id", ondelete="CASCADE"), index=True, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False)
    ip_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    hostname: Mapped[str | None] = mapped_column(String(255), index=True)
    dns_name: Mapped[str | None] = mapped_column(String(255))
    mac_address: Mapped[str | None] = mapped_column(String(100))
    comment: Mapped[str | None] = mapped_column(Text)
    equipment_instance_id: Mapped[int | None] = mapped_column(
        ForeignKey("cabinet_items.id", ondelete="SET NULL"), index=True
    )
    equipment_interface_id: Mapped[int | None] = mapped_column(
        ForeignKey("equipment_network_interfaces.id", ondelete="SET NULL"), index=True
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    source: Mapped[str | None] = mapped_column(String(32))
    last_seen_at: Mapped[datetime | None] = mapped_column(nullable=True)

    subnet: Mapped["Subnet"] = relationship()
    equipment_instance: Mapped["CabinetItem | None"] = relationship(foreign_keys=[equipment_instance_id])
    equipment_interface: Mapped["EquipmentNetworkInterface | None"] = relationship()

    __table_args__ = (
        UniqueConstraint("subnet_id", "ip_offset", name="uq_ip_addresses_subnet_offset"),
        CheckConstraint(
            "status IN ('free','used','reserved','gateway','broadcast','network')",
            name="ck_ip_addresses_status_allowed",
        ),
    )


Index(
    "ix_ip_addresses_ip_address_active_unique",
    IPAddress.ip_address,
    unique=True,
    postgresql_where=(IPAddress.is_deleted == False),
)


class IPAddressAuditLog(Base, TimestampMixin):
    __tablename__ = "ip_address_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    ip_address_id: Mapped[int | None] = mapped_column(
        ForeignKey("ip_addresses.id", ondelete="SET NULL"), index=True
    )
    subnet_id: Mapped[int] = mapped_column(ForeignKey("subnets.id", ondelete="CASCADE"), index=True, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    old_status: Mapped[str | None] = mapped_column(String(32))
    new_status: Mapped[str | None] = mapped_column(String(32))
    old_hostname: Mapped[str | None] = mapped_column(String(255))
    new_hostname: Mapped[str | None] = mapped_column(String(255))
    old_equipment_instance_id: Mapped[int | None] = mapped_column(Integer)
    new_equipment_instance_id: Mapped[int | None] = mapped_column(Integer)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    ip_address_record: Mapped["IPAddress | None"] = relationship(foreign_keys=[ip_address_id])
    subnet: Mapped["Subnet"] = relationship()
    actor: Mapped["User | None"] = relationship(foreign_keys=[actor_user_id])
