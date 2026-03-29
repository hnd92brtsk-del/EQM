import type { DigitalTwinDocument, DigitalTwinItem, DigitalTwinPowerEdge, DigitalTwinPowerNode } from "../../api/digitalTwins";

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

export const CABINET_INPUT_NODE_ID = "cabinet-input";

const defaultWalls = [
  { id: "back", name: "Задняя панель" },
  { id: "left", name: "Левая стенка" },
  { id: "right", name: "Правая стенка" },
  { id: "top", name: "Верхняя панель" },
];

export const wallColors: Record<string, { border: string; bg: string }> = {
  back: { border: "#2f6fed", bg: "rgba(47,111,237,0.08)" },
  left: { border: "#0f9d8a", bg: "rgba(15,157,138,0.08)" },
  right: { border: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  top: { border: "#8b5cf6", bg: "rgba(139,92,246,0.10)" },
};

export const powerBucketStyles = {
  undefined: { label: "Не задано", tone: "#9ca3af", bg: "rgba(156,163,175,0.22)", alert: true },
  "24VDC": { label: "24VDC", tone: "#16a34a", bg: "rgba(22,163,74,0.18)", alert: false },
  "220VAC": { label: "220VAC", tone: "#f59e0b", bg: "rgba(245,158,11,0.18)", alert: false },
  "380VAC": { label: "380VAC", tone: "#dc2626", bg: "rgba(220,38,38,0.18)", alert: false },
  Other: { label: "Other", tone: "#64748b", bg: "rgba(100,116,139,0.18)", alert: false },
} as const;

export type PowerBucket = keyof typeof powerBucketStyles;

export function createManualDraft(): ManualItemDraft {
  return {
    name: "",
    mount_type: "din-rail",
    mount_width_mm: "",
    current_type: "dc",
    supply_voltage: "24В",
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

export function normalizeDigitalTwinDocument(
  raw: Partial<DigitalTwinDocument> | null | undefined,
): DigitalTwinDocument {
  const walls = Array.isArray(raw?.walls) && raw?.walls.length
    ? raw.walls.map((wall) => ({
      id: String(wall?.id || "").trim() || `wall-${Math.random().toString(36).slice(2, 8)}`,
      name: String(wall?.name || "").trim() || "Панель",
    }))
    : defaultWalls.map((wall) => ({ ...wall }));
  const requestedActiveWallId = raw?.ui?.active_wall_id;
  const activeWallId = requestedActiveWallId && walls.some((wall) => wall.id === requestedActiveWallId)
    ? requestedActiveWallId
    : walls[0]?.id || "back";

  return {
    version: 2,
    walls,
    rails: Array.isArray(raw?.rails)
      ? raw.rails.map((rail, index) => ({
        id: String(rail?.id || "").trim() || `rail-${index + 1}`,
        wall_id: walls.some((wall) => wall.id === rail?.wall_id) ? String(rail?.wall_id) : activeWallId,
        name: String(rail?.name || "").trim() || `DIN-рейка ${index + 1}`,
        length_mm: Number.isFinite(Number(rail?.length_mm)) ? Number(rail?.length_mm) : 600,
        sort_order: Number.isFinite(Number(rail?.sort_order)) ? Number(rail?.sort_order) : index,
      }))
      : [],
    items: Array.isArray(raw?.items) ? raw.items.map((item, index) => ({
      id: String(item?.id || "").trim() || `manual-${index + 1}`,
      item_kind: item?.item_kind === "manual" ? "manual" : "source-backed",
      source_status: item?.source_status === "out_of_operation" ? "out_of_operation" : "active",
      placement_mode:
        item?.placement_mode === "rail" || item?.placement_mode === "wall" || item?.placement_mode === "unplaced"
          ? item.placement_mode
          : "unplaced",
      name: String(item?.name || "").trim() || "Без названия",
      user_label: item?.user_label ?? null,
      equipment_item_source: item?.equipment_item_source ?? null,
      equipment_item_id: item?.equipment_item_id ?? null,
      equipment_type_id: item?.equipment_type_id ?? null,
      manufacturer_name: item?.manufacturer_name ?? null,
      article: item?.article ?? null,
      nomenclature_number: item?.nomenclature_number ?? null,
      quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(Number(item?.quantity), 1) : 1,
      current_type: item?.current_type ?? null,
      supply_voltage: item?.supply_voltage ?? null,
      current_consumption_a: item?.current_consumption_a ?? null,
      mount_type: item?.mount_type ?? null,
      mount_width_mm: item?.mount_width_mm ?? null,
      power_role: item?.power_role ?? null,
      output_voltage: item?.output_voltage ?? null,
      max_output_current_a: item?.max_output_current_a ?? null,
      is_channel_forming: Boolean(item?.is_channel_forming),
      channel_count: Number.isFinite(Number(item?.channel_count)) ? Number(item?.channel_count) : 0,
      ai_count: Number.isFinite(Number(item?.ai_count)) ? Number(item?.ai_count) : 0,
      di_count: Number.isFinite(Number(item?.di_count)) ? Number(item?.di_count) : 0,
      ao_count: Number.isFinite(Number(item?.ao_count)) ? Number(item?.ao_count) : 0,
      do_count: Number.isFinite(Number(item?.do_count)) ? Number(item?.do_count) : 0,
      is_network: Boolean(item?.is_network),
      network_ports: Array.isArray(item?.network_ports) ? item.network_ports : [],
      has_serial_interfaces: Boolean(item?.has_serial_interfaces),
      serial_ports: Array.isArray(item?.serial_ports) ? item.serial_ports : [],
      wall_id: item?.wall_id ?? null,
      rail_id: item?.rail_id ?? null,
      sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item?.sort_order) : index,
    })) : [],
    cabinet_properties: {
      incoming_voltage: raw?.cabinet_properties?.incoming_voltage ?? null,
      incoming_current_type: raw?.cabinet_properties?.incoming_current_type ?? null,
      incoming_label: raw?.cabinet_properties?.incoming_label ?? null,
    },
    powerGraph: {
      nodes: Array.isArray(raw?.powerGraph?.nodes) ? raw.powerGraph.nodes.map((node, index) => ({
        id: String(node?.id || "").trim() || `pnode-${index + 1}`,
        kind: node?.kind === "cabinet-input" ? "cabinet-input" : "item",
        item_id: node?.item_id ?? null,
        label: String(node?.label || "").trim() || "Узел",
        x: Number.isFinite(Number(node?.x)) ? Number(node?.x) : 0,
        y: Number.isFinite(Number(node?.y)) ? Number(node?.y) : 0,
        voltage: node?.voltage ?? null,
        role: node?.role ?? null,
        status: node?.status === "out_of_operation" ? "out_of_operation" : "active",
      })) : [],
      edges: Array.isArray(raw?.powerGraph?.edges) ? raw.powerGraph.edges.map((edge, index) => ({
        id: String(edge?.id || "").trim() || `edge-${index + 1}`,
        source: String(edge?.source || "").trim(),
        target: String(edge?.target || "").trim(),
        label: String(edge?.label || ""),
        voltage: edge?.voltage ?? null,
        role: edge?.role ?? null,
      })).filter((edge) => edge.source && edge.target) : [],
    },
    viewport: {
      x: Number.isFinite(Number(raw?.viewport?.x)) ? Number(raw?.viewport?.x) : 0,
      y: Number.isFinite(Number(raw?.viewport?.y)) ? Number(raw?.viewport?.y) : 0,
      zoom: Number.isFinite(Number(raw?.viewport?.zoom)) && Number(raw?.viewport?.zoom) > 0
        ? Number(raw?.viewport?.zoom)
        : 1,
    },
    ui: {
      active_wall_id: activeWallId,
      active_layer: String(raw?.ui?.active_layer || "").trim() || "all",
      selected_item_id: raw?.ui?.selected_item_id ?? null,
    },
  };
}

export function itemDisplayName(item: Pick<DigitalTwinItem, "name" | "user_label">) {
  return item.user_label?.trim() || item.name;
}

export function normalizeCurrentType(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "dc" || normalized.includes("постоян")) return "dc";
  if (normalized === "ac" || normalized.includes("перемен")) return "ac";
  return "other";
}

export function normalizeVoltageLabel(value?: string | null, currentType?: string | null): PowerBucket | null {
  const text = `${value || ""} ${currentType || ""}`.toLowerCase();
  if (!text.trim()) return null;
  if (text.includes("380")) return "380VAC";
  if (text.includes("220")) return "220VAC";
  if (text.includes("24")) {
    const current = normalizeCurrentType(currentType);
    return current === "ac" ? "Other" : "24VDC";
  }
  return "Other";
}

export function getPowerBucketStyle(value?: string | null, currentType?: string | null) {
  const bucket = normalizeVoltageLabel(value, currentType);
  return bucket ? powerBucketStyles[bucket] : powerBucketStyles.undefined;
}

export function voltageToNumber(value?: string | null) {
  if (!value) return null;
  const match = value.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function resolveNodeItem(document: DigitalTwinDocument, node: DigitalTwinPowerNode) {
  return node.item_id ? document.items.find((item) => item.id === node.item_id) || null : null;
}

function resolveNodeVoltage(document: DigitalTwinDocument, node: DigitalTwinPowerNode) {
  if (node.kind === "cabinet-input") {
    return normalizeVoltageLabel(
      document.cabinet_properties.incoming_voltage,
      document.cabinet_properties.incoming_current_type,
    );
  }
  const item = resolveNodeItem(document, node);
  if (!item) return null;
  if (item.power_role === "converter") {
    return normalizeVoltageLabel(item.output_voltage, item.current_type);
  }
  return normalizeVoltageLabel(item.output_voltage || item.supply_voltage, item.current_type);
}

function resolveNodeSupplyVoltage(document: DigitalTwinDocument, node: DigitalTwinPowerNode) {
  if (node.kind === "cabinet-input") {
    return normalizeVoltageLabel(
      document.cabinet_properties.incoming_voltage,
      document.cabinet_properties.incoming_current_type,
    );
  }
  const item = resolveNodeItem(document, node);
  return item ? normalizeVoltageLabel(item.supply_voltage, item.current_type) : null;
}

export function buildValidation(document: DigitalTwinDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activeItems = document.items.filter((item) => item.source_status !== "out_of_operation");
  const activeItemIds = new Set(activeItems.map((item) => item.id));
  const nodes = document.powerGraph.nodes.filter((node) => node.kind === "cabinet-input" || (node.item_id && activeItemIds.has(node.item_id)));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, typeof document.powerGraph.edges>();
  const outgoingBySource = new Map<string, typeof document.powerGraph.edges>();

  document.powerGraph.edges.forEach((edge) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return;
    incomingByTarget.set(edge.target, [...(incomingByTarget.get(edge.target) || []), edge]);
    outgoingBySource.set(edge.source, [...(outgoingBySource.get(edge.source) || []), edge]);
  });

  activeItems.forEach((item) => {
    if (item.power_role === "passive") return;
    const node = nodes.find((current) => current.item_id === item.id);
    if (!node) {
      issues.push({
        id: `missing-node-${item.id}`,
        severity: "warning",
        title: "Объект отсутствует на графе питания",
        detail: `${itemDisplayName(item)} не отображается на графе питания.`,
      });
      return;
    }
    if (!(incomingByTarget.get(node.id) || []).length && item.power_role !== "source" && item.power_role !== "consumer" && item.power_role !== "converter") return;
    if (!(incomingByTarget.get(node.id) || []).length) {
      issues.push({
        id: `missing-feed-${item.id}`,
        severity: "warning",
        title: "Нет источника питания",
        detail: `${itemDisplayName(item)} не подключен к источнику.`,
      });
    }
  });

  document.powerGraph.edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return;
    const sourceBucket = edge.voltage
      ? normalizeVoltageLabel(edge.voltage, sourceNode.kind === "cabinet-input" ? document.cabinet_properties.incoming_current_type : resolveNodeItem(document, sourceNode)?.current_type)
      : resolveNodeVoltage(document, sourceNode);
    const targetBucket = resolveNodeSupplyVoltage(document, targetNode);
    if (sourceBucket && targetBucket && sourceBucket !== targetBucket) {
      const sourceItem = resolveNodeItem(document, sourceNode);
      const targetItem = resolveNodeItem(document, targetNode);
      issues.push({
        id: `voltage-${edge.id}`,
        severity: "error",
        title: "Несовпадение напряжения",
        detail: `${sourceNode.kind === "cabinet-input" ? "Ввод шкафа" : itemDisplayName(sourceItem!)} -> ${targetItem ? itemDisplayName(targetItem) : targetNode.label}: ${sourceBucket} != ${targetBucket}.`,
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
  nodes.forEach((node) => {
    if (!visitState.has(node.id)) dfs(node.id, []);
  });

  nodes.forEach((node) => {
    if (node.kind === "cabinet-input") return;
    const sourceItem = resolveNodeItem(document, node);
    if (!sourceItem || (sourceItem.power_role !== "source" && sourceItem.power_role !== "converter")) return;
    if (!sourceItem.max_output_current_a || sourceItem.max_output_current_a <= 0) return;
    const load = (outgoingBySource.get(node.id) || []).reduce((sum, edge) => {
      const targetNode = nodeById.get(edge.target);
      const targetItem = targetNode ? resolveNodeItem(document, targetNode) : null;
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

export type GraphClipboardPayload = {
  kind: "manual-node";
  item: DigitalTwinItem;
  node: DigitalTwinPowerNode;
};

export function findPowerNodeByItemId(document: DigitalTwinDocument, itemId: string) {
  return document.powerGraph.nodes.find((node) => node.item_id === itemId) || null;
}

export function createPowerNodeForItem(item: DigitalTwinItem, position: { x: number; y: number }): DigitalTwinPowerNode {
  return {
    id: `pnode-${item.id}`,
    kind: "item",
    item_id: item.id,
    label: itemDisplayName(item),
    x: position.x,
    y: position.y,
    voltage: item.output_voltage || item.supply_voltage || null,
    role: item.power_role,
    status: item.source_status,
  };
}

export function removePowerNodeFromDocument(document: DigitalTwinDocument, nodeId: string) {
  document.powerGraph.nodes = document.powerGraph.nodes.filter((node) => node.id !== nodeId);
  document.powerGraph.edges = document.powerGraph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
  return document;
}

export function removePowerEdgeFromDocument(document: DigitalTwinDocument, edgeId: string) {
  document.powerGraph.edges = document.powerGraph.edges.filter((edge) => edge.id !== edgeId);
  return document;
}

export function duplicateManualItemWithNode(
  document: DigitalTwinDocument,
  itemId: string,
  offset = { x: 48, y: 48 },
) {
  const item = document.items.find((entry) => entry.id === itemId);
  const node = findPowerNodeByItemId(document, itemId);
  if (!item || item.item_kind !== "manual" || !node) return null;

  const nextItem: DigitalTwinItem = {
    ...item,
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: item.name,
    user_label: item.user_label,
    sort_order: document.items.length,
  };
  const nextNode: DigitalTwinPowerNode = {
    ...node,
    id: `pnode-${nextItem.id}`,
    item_id: nextItem.id,
    label: itemDisplayName(nextItem),
    x: node.x + offset.x,
    y: node.y + offset.y,
  };
  return { item: nextItem, node: nextNode };
}

export function canCopyPowerSelection(document: DigitalTwinDocument, selectedNodeId: string | null) {
  if (!selectedNodeId) return false;
  const node = document.powerGraph.nodes.find((entry) => entry.id === selectedNodeId);
  if (!node?.item_id) return false;
  const item = document.items.find((entry) => entry.id === node.item_id);
  return item?.item_kind === "manual";
}

export function canDeletePowerSelection(selectedNodeId: string | null, selectedEdgeId: string | null) {
  return Boolean(selectedNodeId || selectedEdgeId);
}

export function getPowerNodeSize(node: DigitalTwinPowerNode) {
  return node.kind === "cabinet-input"
    ? { width: 208, height: 76 }
    : { width: 188, height: 76 };
}

export function getPowerNodeCenter(node: DigitalTwinPowerNode) {
  const size = getPowerNodeSize(node);
  return {
    x: node.x + size.width / 2,
    y: node.y + size.height / 2,
  };
}

export function boundsOfPowerNodes(nodes: DigitalTwinPowerNode[]) {
  if (!nodes.length) {
    return { x: 0, y: 0, width: 960, height: 540 };
  }
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + getPowerNodeSize(node).width));
  const bottom = Math.max(...nodes.map((node) => node.y + getPowerNodeSize(node).height));
  return {
    x: left,
    y: top,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  };
}

export function edgePathForPowerGraph(edge: DigitalTwinPowerEdge, nodes: DigitalTwinPowerNode[]) {
  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);
  if (!source || !target) return "";
  const a = getPowerNodeCenter(source);
  const b = getPowerNodeCenter(target);
  const dx = Math.max(Math.abs(b.x - a.x) * 0.4, 56);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function fitPowerGraphViewport(
  nodes: DigitalTwinPowerNode[],
  canvas: { width: number; height: number },
  padding = 120,
) {
  const bounds = boundsOfPowerNodes(nodes);
  const zoom = Math.max(
    0.2,
    Math.min(
      2.5,
      Math.min(
        canvas.width / (bounds.width + padding * 2),
        canvas.height / (bounds.height + padding * 2),
      ),
    ),
  );
  return {
    x: canvas.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: canvas.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  };
}
