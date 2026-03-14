from app.models.core import EquipmentType


def is_unique_equipment(equipment: EquipmentType) -> bool:
    return bool(
        equipment.is_channel_forming
        or equipment.is_network
        or equipment.has_serial_interfaces
    )


def normalize_operation_quantity(equipment: EquipmentType, quantity: int) -> int:
    return 1 if is_unique_equipment(equipment) else quantity
