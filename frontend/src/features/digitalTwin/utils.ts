import type { DigitalTwinDocument, DigitalTwinItem } from "../../api/digitalTwins";

export type ValidationIssue = {
  id: string;
  severity: "warning" | "error";
  title: string;
  detail: string;
};

export type ManualItemDraft = {
  name: string;
  mount_type: "din-rail" | "wall" | "other";
  mount_width_mm: string;
  current_type: string;
  supply_voltage: string;
  current_consumption_a: string;
  power_role: "consumer" | "source" | "converter" | "passive";
  output_voltage: string;
  max_output_current_a: string;
  ai_count: string;
  di_count: string;
  ao_count: string;
  do_count: string;
  network_port_count: string;
};

export const wallColors: Record<string, { border: string; bg: string }> = {
  back: { border: "#2f6fed", bg: "rgba(47,111,237,0.08)" },
  left: { border: "#0f9d8a", bg: "rgba(15,157,138,0.08)" },
  right: { border: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  top: { border: "#8b5cf6", bg: "rgba(139,92,246,0.10)" },
};

export function createManualDraft(): ManualItemDraft {
  return {
    name: "",
    mount_type: "din-rail",
    mount_width_mm: "",
    current_type: "dc",
    supply_voltage: "24V",
    current_consumption_a: "",
    power_role: "consumer",
    output_voltage: "",
    max_output_current_a: "",
    ai_count: "0",
    di_count: "0",
    ao_count: "0",
    do_count: "0",
    network_port_count: "0",
  };
}

export function cloneDocument(document: DigitalTwinDocument): DigitalTwinDocument {
  return JSON.parse(JSON.stringify(document)) as DigitalTwinDocument;
}

export function itemDisplayName(item: DigitalTwinItem) {
  return item.user_label?.trim() || item.name;
}

export function normalizeVoltageLabel(value?: string | null, currentType?: string | null) {
  const text = `${value || ""} ${currentType || ""}`.toLowerCase();
  if (!text.trim()) return null;
  if (text.includes("380")) return "380VAC";
  if (text.includes("220")) return "220VAC";
  if (text.includes("24")) return "24VDC";
  return "Other";
}

export function voltageToNumber(value?: string | null) {
  if (!value) return null;
  const match = value.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

export function buildValidation(document: DigitalTwinDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activeItems = document.items.filter((item) => item.source_status !== "out_of_operation");
  const itemById = new Map(activeItems.map((item) => [item.id, item]));
  const nodeById = new Map(document.powerGraph.nodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, typeof document.powerGraph.edges>();
  const outgoingBySource = new Map<string, typeof document.powerGraph.edges>();

  document.powerGraph.edges.forEach((edge) => {
    incomingByTarget.set(edge.target, [...(incomingByTarget.get(edge.target) || []), edge]);
    outgoingBySource.set(edge.source, [...(outgoingBySource.get(edge.source) || []), edge]);
  });

  activeItems.forEach((item) => {
    if (item.power_role !== "consumer") return;
    const node = document.powerGraph.nodes.find((current) => current.item_id === item.id);
    if (!node || !(incomingByTarget.get(node.id) || []).length) {
      issues.push({
        id: `missing-${item.id}`,
        severity: "warning",
        title: "Нет источника питания",
        detail: `${itemDisplayName(item)} не подключен к источнику.`,
      });
    }
  });

  document.powerGraph.edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    const sourceItem = sourceNode ? itemById.get(sourceNode.item_id) : null;
    const targetItem = targetNode ? itemById.get(targetNode.item_id) : null;
    if (!sourceItem || !targetItem) return;
    const sourceVoltage = normalizeVoltageLabel(
      edge.voltage || sourceItem.output_voltage || sourceItem.supply_voltage,
      sourceItem.current_type,
    );
    const targetVoltage = normalizeVoltageLabel(targetItem.supply_voltage, targetItem.current_type);
    if (sourceVoltage && targetVoltage && sourceVoltage !== targetVoltage) {
      issues.push({
        id: `voltage-${edge.id}`,
        severity: "error",
        title: "Несовпадение напряжения",
        detail: `${itemDisplayName(sourceItem)} -> ${itemDisplayName(targetItem)}: ${sourceVoltage} != ${targetVoltage}.`,
      });
    }
  });

  const visitState = new Map<string, "visiting" | "done">();
  const dfs = (nodeId: string, stack: string[]) => {
    visitState.set(nodeId, "visiting");
    const nextStack = [...stack, nodeId];
    for (const edge of outgoingBySource.get(nodeId) || []) {
      if (!nodeById.has(edge.target)) continue;
      const state = visitState.get(edge.target);
      if (state === "visiting") {
        issues.push({
          id: `cycle-${edge.id}`,
          severity: "error",
          title: "Обнаружен цикл питания",
          detail: `Цикл найден в цепочке ${[...nextStack, edge.target].join(" -> ")}.`,
        });
      } else if (!state) {
        dfs(edge.target, nextStack);
      }
    }
    visitState.set(nodeId, "done");
  };
  document.powerGraph.nodes.forEach((node) => {
    if (!visitState.has(node.id)) dfs(node.id, []);
  });

  document.powerGraph.nodes.forEach((node) => {
    const sourceItem = itemById.get(node.item_id);
    if (!sourceItem || (sourceItem.power_role !== "source" && sourceItem.power_role !== "converter")) return;
    if (!sourceItem.max_output_current_a || sourceItem.max_output_current_a <= 0) return;
    const load = (outgoingBySource.get(node.id) || []).reduce((sum, edge) => {
      const targetNode = nodeById.get(edge.target);
      const targetItem = targetNode ? itemById.get(targetNode.item_id) : null;
      return sum + ((targetItem?.current_consumption_a || 0) * Math.max(targetItem?.quantity || 1, 1));
    }, 0);
    if (load > sourceItem.max_output_current_a) {
      issues.push({
        id: `capacity-${sourceItem.id}`,
        severity: "error",
        title: "Превышена нагрузка источника",
        detail: `${itemDisplayName(sourceItem)}: ${load.toFixed(2)}A > ${sourceItem.max_output_current_a.toFixed(2)}A.`,
      });
    }
  });

  return issues;
}

export function buildLoadSummary(document: DigitalTwinDocument) {
  return document.items.reduce<Record<string, { current: number; power: number }>>((acc, item) => {
    if (item.source_status === "out_of_operation") return acc;
    const bucket = normalizeVoltageLabel(item.supply_voltage, item.current_type) || "Other";
    const current = (item.current_consumption_a || 0) * Math.max(item.quantity || 1, 1);
    const power = (voltageToNumber(item.supply_voltage) || 0) * current;
    acc[bucket] = acc[bucket] || { current: 0, power: 0 };
    acc[bucket].current += current;
    acc[bucket].power += power;
    return acc;
  }, {});
}

export function buildIoSummary(document: DigitalTwinDocument) {
  return document.items.reduce(
    (acc, item) => {
      if (item.source_status === "out_of_operation") return acc;
      const qty = Math.max(item.quantity || 1, 1);
      acc.ai += (item.ai_count || 0) * qty;
      acc.di += (item.di_count || 0) * qty;
      acc.ao += (item.ao_count || 0) * qty;
      acc.do += (item.do_count || 0) * qty;
      return acc;
    },
    { ai: 0, di: 0, ao: 0, do: 0 },
  );
}

export function buildNetworkSummary(document: DigitalTwinDocument) {
  const rows = document.items
    .filter((item) => item.source_status !== "out_of_operation" && item.is_network)
    .map((item) => ({
      id: item.id,
      label: itemDisplayName(item),
      ports: item.network_ports.reduce((sum, port) => sum + (port.count || 0), 0),
      detail: item.network_ports.map((port) => `${port.type} x${port.count}`).join(", "),
    }));
  return { rows, total: rows.reduce((sum, row) => sum + row.ports, 0) };
}

export function buildManualItem(draft: ManualItemDraft, wallId: string): DigitalTwinItem {
  const networkCount = Number(draft.network_port_count || 0);
  const channelCount =
    Number(draft.ai_count || 0) +
    Number(draft.di_count || 0) +
    Number(draft.ao_count || 0) +
    Number(draft.do_count || 0);
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    item_kind: "manual",
    source_status: "active",
    placement_mode: draft.mount_type === "wall" ? "wall" : "unplaced",
    name: draft.name.trim(),
    user_label: null,
    equipment_item_source: null,
    equipment_item_id: null,
    equipment_type_id: null,
    manufacturer_name: null,
    article: null,
    nomenclature_number: null,
    quantity: 1,
    current_type: draft.current_type || null,
    supply_voltage: draft.supply_voltage || null,
    current_consumption_a: draft.current_consumption_a ? Number(draft.current_consumption_a) : null,
    mount_type: draft.mount_type,
    mount_width_mm: draft.mount_width_mm ? Number(draft.mount_width_mm) : null,
    power_role: draft.power_role,
    output_voltage: draft.output_voltage || null,
    max_output_current_a: draft.max_output_current_a ? Number(draft.max_output_current_a) : null,
    is_channel_forming: channelCount > 0,
    channel_count: channelCount,
    ai_count: Number(draft.ai_count || 0),
    di_count: Number(draft.di_count || 0),
    ao_count: Number(draft.ao_count || 0),
    do_count: Number(draft.do_count || 0),
    is_network: networkCount > 0,
    network_ports: networkCount > 0 ? [{ type: "RJ-45 (8p8c)", count: networkCount }] : [],
    has_serial_interfaces: false,
    serial_ports: [],
    wall_id: draft.mount_type === "wall" ? wallId : null,
    rail_id: null,
    sort_order: 0,
  };
}
