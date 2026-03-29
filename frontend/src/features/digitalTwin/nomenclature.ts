import type { TFunction } from "i18next";

import type { EquipmentTypeRecord, EquipmentTypeUpdatePayload } from "../../api/equipmentTypes";

export type NomenclaturePowerRole = "source" | "consumer" | "converter" | "passive";

export type NomenclatureDraft = {
  equipment_type_id: number | "";
  name: string;
  nomenclature_number: string;
  article: string;
  role_in_power_chain: NomenclaturePowerRole;
  current_type: string;
  supply_voltage: string;
  top_current_type: string;
  top_supply_voltage: string;
  bottom_current_type: string;
  bottom_supply_voltage: string;
  current_value_a: string;
  mount_type: "din-rail" | "wall" | "other" | "";
  mount_width_mm: string;
  ai_count: string;
  di_count: string;
  ao_count: string;
  do_count: string;
  network_port_count: string;
};

export const powerRoleValues: NomenclaturePowerRole[] = ["consumer", "source", "converter", "passive"];

export function buildCurrentTypeOptions(t: TFunction) {
  return [
    { value: "Постоянный", label: t("pagesUi.equipmentTypes.options.currentType.direct") },
    { value: "Переменный", label: t("pagesUi.equipmentTypes.options.currentType.alternating") },
    { value: "N/A", label: t("pagesUi.equipmentTypes.options.currentType.na") },
  ];
}

export function buildSupplyVoltageOptions(t: TFunction) {
  return [
    { value: "380В", label: "380 В" },
    { value: "220В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v220") },
    { value: "24В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v24") },
    { value: "220В/24В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v220v24") },
    { value: "12В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v12") },
    { value: "9В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v9") },
    { value: "5В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v5") },
    { value: "3В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v3") },
    { value: "N/A", label: t("pagesUi.equipmentTypes.options.supplyVoltage.na") },
  ];
}

export function createNomenclatureDraft(equipment?: EquipmentTypeRecord | null): NomenclatureDraft {
  const attrs = equipment?.power_attributes;
  return {
    equipment_type_id: equipment?.id ?? "",
    name: equipment?.name ?? "",
    nomenclature_number: equipment?.nomenclature_number ?? "",
    article: equipment?.article ?? "",
    role_in_power_chain: (attrs?.role_in_power_chain || equipment?.role_in_power_chain || equipment?.power_role || "passive") as NomenclaturePowerRole,
    current_type: attrs?.current_type ?? equipment?.current_type ?? "",
    supply_voltage: attrs?.supply_voltage ?? equipment?.supply_voltage ?? "",
    top_current_type: attrs?.top_current_type ?? equipment?.top_current_type ?? "",
    top_supply_voltage: attrs?.top_supply_voltage ?? equipment?.top_supply_voltage ?? "",
    bottom_current_type: attrs?.bottom_current_type ?? equipment?.bottom_current_type ?? "",
    bottom_supply_voltage: attrs?.bottom_supply_voltage ?? equipment?.bottom_supply_voltage ?? "",
    current_value_a: attrs?.current_value_a != null
      ? String(attrs.current_value_a)
      : equipment?.current_value_a != null
        ? String(equipment.current_value_a)
        : "",
    mount_type: (equipment?.mount_type as NomenclatureDraft["mount_type"]) || "",
    mount_width_mm: equipment?.mount_width_mm != null ? String(equipment.mount_width_mm) : "",
    ai_count: String(equipment?.ai_count ?? 0),
    di_count: String(equipment?.di_count ?? 0),
    ao_count: String(equipment?.ao_count ?? 0),
    do_count: String(equipment?.do_count ?? 0),
    network_port_count: String((equipment?.network_ports || []).reduce((sum, port) => sum + (port.count || 0), 0)),
  };
}

export function formatEquipmentTypeOptionLabel(item: EquipmentTypeRecord) {
  return [item.name, item.article, item.nomenclature_number].filter(Boolean).join(" • ");
}

export function buildEquipmentTypeUpdatePayload(draft: NomenclatureDraft): EquipmentTypeUpdatePayload {
  const parseNullableNumber = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const aiCount = Number(draft.ai_count || 0);
  const diCount = Number(draft.di_count || 0);
  const aoCount = Number(draft.ao_count || 0);
  const doCount = Number(draft.do_count || 0);
  const networkPortCount = Number(draft.network_port_count || 0);

  return {
    role_in_power_chain: draft.role_in_power_chain,
    power_attributes: {
      role_in_power_chain: draft.role_in_power_chain,
      current_type: draft.current_type || null,
      supply_voltage: draft.supply_voltage || null,
      top_current_type: draft.top_current_type || null,
      top_supply_voltage: draft.top_supply_voltage || null,
      bottom_current_type: draft.bottom_current_type || null,
      bottom_supply_voltage: draft.bottom_supply_voltage || null,
      current_value_a: parseNullableNumber(draft.current_value_a),
    },
    mount_type: draft.mount_type || null,
    mount_width_mm: parseNullableNumber(draft.mount_width_mm),
    is_channel_forming: aiCount + diCount + aoCount + doCount > 0,
    ai_count: aiCount,
    di_count: diCount,
    ao_count: aoCount,
    do_count: doCount,
    is_network: networkPortCount > 0,
    network_ports: networkPortCount > 0 ? [{ type: "RJ-45 (8p8c)", count: networkPortCount }] : undefined,
  };
}

export function getCurrentTypeLabel(value: string | null | undefined, t: TFunction) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "dc" || normalized === "постоянный") return t("pagesUi.digitalTwin.enums.currentType.dc");
  if (normalized === "ac" || normalized === "переменный") return t("pagesUi.digitalTwin.enums.currentType.ac");
  if (normalized === "n/a" || normalized === "other" || normalized === "другое") return t("pagesUi.digitalTwin.enums.currentType.other");
  return value || "";
}
