import { listEntity } from "../../api/entities";
import type { SerialMapEligibleEquipment } from "./types";

type EquipmentInOperationItem = {
  id: number;
  source: "cabinet" | "assembly";
  container_id: number;
  container_name: string;
  equipment_type_id: number;
  equipment_type_name?: string | null;
  manufacturer_name?: string | null;
  serial_ports?: { type: string; count: number }[] | null;
  location_full_path?: string | null;
  is_deleted: boolean;
};

export async function listSerialMapEligibleEquipment(): Promise<SerialMapEligibleEquipment[]> {
  const pageSize = 200;
  let page = 1;
  let total = 0;
  const items: EquipmentInOperationItem[] = [];

  do {
    const response = await listEntity<EquipmentInOperationItem>("/equipment-in-operation", {
      page,
      page_size: pageSize,
      is_deleted: false
    });
    total = response.total;
    items.push(...response.items);
    page += 1;
  } while (items.length < total);

  return items
    .filter((item) => !item.is_deleted && Array.isArray(item.serial_ports) && item.serial_ports.length > 0)
    .map((item) => ({
      key: `${item.source}:${item.id}`,
      id: item.id,
      source: item.source,
      containerId: item.container_id,
      containerName: item.container_name,
      equipmentTypeId: item.equipment_type_id,
      equipmentTypeName: item.equipment_type_name || `#${item.equipment_type_id}`,
      manufacturerName: item.manufacturer_name || null,
      displayName: item.equipment_type_name || `Оборудование #${item.id}`,
      serialPorts: item.serial_ports || [],
      locationFullPath: item.location_full_path || null
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "ru"));
}
