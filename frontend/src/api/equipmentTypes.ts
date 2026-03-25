import { listEntity } from "./entities";
import { apiFetch } from "./client";

export type EquipmentTypePowerAttributes = {
  role_in_power_chain?: "source" | "consumer" | "converter" | "passive" | null;
  current_type?: string | null;
  supply_voltage?: string | null;
  top_current_type?: string | null;
  top_supply_voltage?: string | null;
  bottom_current_type?: string | null;
  bottom_supply_voltage?: string | null;
  current_value_a?: number | null;
};

export type EquipmentTypeRecord = {
  id: number;
  name: string;
  article?: string | null;
  nomenclature_number: string;
  role_in_power_chain?: "source" | "consumer" | "converter" | "passive" | null;
  power_attributes?: EquipmentTypePowerAttributes | null;
  current_type?: string | null;
  supply_voltage?: string | null;
  current_consumption_a?: number | null;
  top_current_type?: string | null;
  top_supply_voltage?: string | null;
  bottom_current_type?: string | null;
  bottom_supply_voltage?: string | null;
  current_value_a?: number | null;
  manufacturer_id: number;
  equipment_category_id?: number | null;
  is_channel_forming: boolean;
  channel_count: number;
  ai_count: number;
  di_count: number;
  ao_count: number;
  do_count: number;
  is_network: boolean;
  network_ports?: { type: string; count: number }[] | null;
  has_serial_interfaces: boolean;
  serial_ports?: { type: string; count: number }[] | null;
  mount_type?: string | null;
  mount_width_mm?: number | null;
  power_role?: string | null;
  output_voltage?: string | null;
  max_output_current_a?: number | null;
  is_deleted: boolean;
};

export type EquipmentTypeUpdatePayload = {
  role_in_power_chain: "source" | "consumer" | "converter" | "passive";
  power_attributes: EquipmentTypePowerAttributes;
  mount_type: string | null;
  mount_width_mm: number | null;
  is_channel_forming: boolean;
  ai_count: number;
  di_count: number;
  ao_count: number;
  do_count: number;
  is_network: boolean;
  network_ports?: { type: string; count: number }[] | undefined;
};

export async function listEquipmentTypesForSelect() {
  const pageSize = 200;
  let page = 1;
  let items: EquipmentTypeRecord[] = [];
  while (true) {
    const data = await listEntity<EquipmentTypeRecord>("/equipment-types/", {
      page,
      page_size: pageSize,
      is_deleted: false,
      sort: "name",
    });
    items = items.concat(data.items);
    if (items.length >= data.total) break;
    page += 1;
  }
  return items;
}

export function updateEquipmentType(id: number, payload: Partial<EquipmentTypeUpdatePayload>) {
  return apiFetch<EquipmentTypeRecord>(`/equipment-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
