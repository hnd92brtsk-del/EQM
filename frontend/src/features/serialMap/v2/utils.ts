import type { Connection, Edge, Node } from "reactflow";

import {
  SERIAL_MAP_PROTOCOLS,
  createId,
  getProtocolMeta,
  inferBaudRateFromProtocol,
  resolveNodeName,
} from "../model";
import type {
  SerialMapDocumentData,
  SerialMapEdge,
  SerialMapEligibleEquipment,
  SerialMapNode,
  SerialMapNodeKind,
  SerialMapProtocol,
} from "../types";

export type SerialMapFlowNodeData = {
  node: SerialMapNode;
  title: string;
  hasConflict: boolean;
};

export type SerialMapFlowEdgeData = {
  edge: SerialMapEdge;
};

export const SERIAL_MAP_NODE_WIDTH = 196;
export const SERIAL_MAP_NODE_HEIGHT = 108;

export const SERIAL_MAP_NODE_TYPES: Exclude<SerialMapNodeKind, "equipment">[] = [
  "master",
  "slave",
  "sensor",
  "bus",
  "repeater",
  "gateway",
];

export function buildEquipmentMap(items: SerialMapEligibleEquipment[]) {
  return new Map(items.map((item) => [`${item.source}:${item.id}`, item]));
}

export function toFlowNode(
  node: SerialMapNode,
  equipmentMap: Map<string, SerialMapEligibleEquipment>,
  conflictedNodeIds: Set<string>,
): Node<SerialMapFlowNodeData> {
  return {
    id: node.id,
    type: "serialMapNode",
    position: node.position,
    draggable: true,
    selectable: true,
    data: {
      node,
      title: resolveNodeName(node, equipmentMap),
      hasConflict: conflictedNodeIds.has(node.id),
    },
    style: {
      width: node.width || SERIAL_MAP_NODE_WIDTH,
      height: node.height || SERIAL_MAP_NODE_HEIGHT,
      border: "none",
      background: "transparent",
      boxShadow: "none",
    },
  };
}

export function toFlowEdge(edge: SerialMapEdge): Edge<SerialMapFlowEdgeData> {
  return {
    id: edge.id,
    type: "serialMapEdge",
    source: edge.fromNodeId,
    target: edge.toNodeId,
    data: {
      edge,
    },
  };
}

export function exportSerialMapXml(document: SerialMapDocumentData) {
  return `<?xml version="1.0" encoding="UTF-8"?><SerialMap><Nodes>${document.nodes
    .map(
      (node) =>
        `<Node id="${xmlSafe(node.id)}" type="${xmlSafe(node.kind)}" name="${xmlSafe(node.name)}" address="${node.address ?? ""}" protocol="${xmlSafe(node.protocol)}" baudRate="${node.baudRate}" parity="${xmlSafe(node.parity)}" dataBits="${node.dataBits}" stopBits="${node.stopBits}" segment="${node.segment}"><Note>${xmlSafe(node.note)}</Note></Node>`,
    )
    .join("")}</Nodes><Edges>${document.edges
    .map(
      (edge) =>
        `<Edge id="${xmlSafe(edge.id)}" from="${xmlSafe(edge.fromNodeId)}" to="${xmlSafe(edge.toNodeId)}" protocol="${xmlSafe(edge.protocol)}" baudRate="${edge.baudRate}" label="${xmlSafe(edge.label)}" cableMark="${xmlSafe(edge.cableMark)}" />`,
    )
    .join("")}</Edges></SerialMap>`;
}

export function exportSerialMapCsv(document: SerialMapDocumentData) {
  const header =
    "ID,Type,Name,Address,Protocol,BaudRate,Parity,DataBits,StopBits,Segment,Note,BridgeProtocol";
  const rows = document.nodes.map((node) =>
    [
      node.id,
      node.kind,
      node.name,
      node.address ?? "",
      node.protocol,
      node.baudRate,
      node.parity,
      node.dataBits,
      node.stopBits,
      node.segment,
      node.note,
      node.bridgeProtocol || "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return `\uFEFF${[header, ...rows].join("\n")}`;
}

export function downloadTextFile(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function createEdgeFromConnection(
  connection: Connection,
  nodes: SerialMapNode[],
): SerialMapEdge | null {
  if (!connection.source || !connection.target) return null;
  if (connection.source === connection.target) return null;

  const sourceNode = nodes.find((item) => item.id === connection.source);
  const targetNode = nodes.find((item) => item.id === connection.target);
  const protocol = resolveEdgeProtocol(sourceNode, targetNode);
  const baudRate = resolveEdgeBaudRate(sourceNode, targetNode, protocol);

  return {
    id: createId("edge"),
    fromNodeId: connection.source,
    toNodeId: connection.target,
    protocol,
    baudRate,
    label: "",
    cableMark: "",
    meta: {},
  };
}

export function getDefaultNodeName(kind: Exclude<SerialMapNodeKind, "equipment">, index: number) {
  switch (kind) {
    case "master":
      return `Master ${index}`;
    case "slave":
      return `Slave ${index}`;
    case "sensor":
      return `Sensor ${index}`;
    case "bus":
      return `Bus ${index}`;
    case "repeater":
      return `Repeater ${index}`;
    case "gateway":
      return `Gateway ${index}`;
    default:
      return `Node ${index}`;
  }
}

export function createManualSerialNode(
  kind: Exclude<SerialMapNodeKind, "equipment">,
  position: { x: number; y: number },
  index: number,
): SerialMapNode {
  const protocol = kind === "gateway" ? "Profibus DP" : kind === "bus" || kind === "repeater" ? "RS-485" : "Modbus RTU";

  return {
    id: createId("node"),
    kind,
    name: getDefaultNodeName(kind, index),
    protocol,
    baudRate: inferBaudRateFromProtocol(protocol),
    address: kind === "bus" || kind === "repeater" ? null : kind === "master" ? 0 : index,
    parity: "None",
    dataBits: 8,
    stopBits: 1,
    segment: 1,
    note: "",
    width: kind === "bus" ? 244 : SERIAL_MAP_NODE_WIDTH,
    height: kind === "bus" ? 72 : SERIAL_MAP_NODE_HEIGHT,
    position,
    dataPool: [],
    serialPorts: [],
    sourceRef: null,
    bridgeProtocol: kind === "gateway" ? "Profibus DP" : null,
    converterMappings: [],
  };
}

function resolveEdgeProtocol(
  sourceNode: SerialMapNode | undefined,
  targetNode: SerialMapNode | undefined,
): SerialMapProtocol {
  const candidates = [sourceNode?.protocol, targetNode?.protocol].filter(Boolean) as SerialMapProtocol[];
  if (!candidates.length) return "Modbus RTU";
  const exact = candidates.find((item) => SERIAL_MAP_PROTOCOLS.some((entry) => entry.value === item));
  return exact || "Modbus RTU";
}

function resolveEdgeBaudRate(
  sourceNode: SerialMapNode | undefined,
  targetNode: SerialMapNode | undefined,
  protocol: SerialMapProtocol,
) {
  const baudCandidates = [sourceNode?.baudRate, targetNode?.baudRate].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return baudCandidates[0] ?? getProtocolMeta(protocol).baudRates[0] ?? inferBaudRateFromProtocol(protocol);
}

function xmlSafe(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
