import type { Connection, Edge, Node, NodeChange } from "reactflow";

import type {
  EdgeStyle,
  HealthStatus,
  NetworkEdge,
  NetworkNode,
  NetworkTopologyEligibleEquipment,
  NodeInterface,
  NodeType,
  RouteEntry,
  TopologyDocument,
  TopologyPolicy,
} from "./types";

export const NETWORK_NODE_TYPES: NodeType[] = [
  "router",
  "core-switch",
  "switch",
  "firewall",
  "load-balancer",
  "vpn-gateway",
  "wireless-controller",
  "access-point",
  "server",
  "vm-host",
  "storage",
  "nas",
  "cloud",
  "internet",
  "workstation",
  "printer",
  "camera",
  "iot-gateway",
];

export const NETWORK_EDGE_STYLES: EdgeStyle[] = ["ethernet", "fiber", "vpn", "wireless", "mpls", "trunk"];
export const NETWORK_LAYERS: NetworkNode["layer"][] = ["core", "distribution", "access", "security", "datacenter", "wan", "edge"];
export const ROUTE_PROTOCOLS = ["static", "ospf", "bgp", "eigrp", "rip", "isis"];

export const DEFAULT_DOCUMENT: TopologyDocument = {
  nodes: [],
  edges: [],
  policies: [],
  viewport: { x: 0, y: 0 },
  zoom: 1,
};

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyNodeInterface(): NodeInterface {
  return { name: "", ip: "", vlan: "", status: "up" };
}

export function createEmptyRouteEntry(): RouteEntry {
  return { prefix: "", nextHop: "", protocol: "static", metric: 1 };
}

export function createEmptyPolicy(): TopologyPolicy {
  return { id: createId("policy"), name: "New policy", type: "routing", target: "", state: "active" };
}

export function createManualNode(type: NodeType, position: { x: number; y: number }): NetworkNode {
  const title = type.replace(/-/g, " ");
  return {
    id: createId("node"),
    name: title.charAt(0).toUpperCase() + title.slice(1),
    type,
    x: position.x,
    y: position.y,
    ip: "",
    vlan: "",
    zone: "",
    asn: "",
    layer: guessLayerFromNodeType(type),
    status: "healthy",
    model: "",
    os: "",
    interfaces: [],
    routes: [],
    services: [],
  };
}

export function mapEquipmentTypeToNodeType(name: string): NodeType {
  const normalized = name.toLowerCase();
  if (normalized.includes("firewall")) return "firewall";
  if (normalized.includes("vpn")) return "vpn-gateway";
  if (normalized.includes("core") && normalized.includes("switch")) return "core-switch";
  if (normalized.includes("router")) return "router";
  if (normalized.includes("wireless") || normalized.includes("controller")) return "wireless-controller";
  if (normalized.includes("access point") || normalized.includes("ap ")) return "access-point";
  if (normalized.includes("storage")) return "storage";
  if (normalized.includes("nas")) return "nas";
  if (normalized.includes("vm") || normalized.includes("esxi") || normalized.includes("hypervisor")) return "vm-host";
  if (normalized.includes("server")) return "server";
  if (normalized.includes("camera")) return "camera";
  if (normalized.includes("printer")) return "printer";
  if (normalized.includes("workstation")) return "workstation";
  if (normalized.includes("iot")) return "iot-gateway";
  if (normalized.includes("switch")) return "switch";
  return "switch";
}

export function guessLayerFromNodeType(type: NodeType): NetworkNode["layer"] {
  switch (type) {
    case "core-switch":
      return "core";
    case "switch":
    case "wireless-controller":
    case "access-point":
      return "distribution";
    case "firewall":
    case "vpn-gateway":
      return "security";
    case "server":
    case "vm-host":
    case "storage":
    case "nas":
      return "datacenter";
    case "cloud":
    case "internet":
      return "wan";
    default:
      return "edge";
  }
}

export function createNodeFromEquipment(item: NetworkTopologyEligibleEquipment, position: { x: number; y: number }): NetworkNode {
  const type = mapEquipmentTypeToNodeType(item.equipment_type_name);
  const interfaces = (item.network_interfaces || []).map<NodeInterface>((networkInterface) => ({
    name: networkInterface.interface_name,
    ip: item.primary_ip && !networkInterface.is_management ? item.primary_ip : "",
    vlan: "",
    status: networkInterface.is_active ? "up" : "down",
  }));
  return {
    id: createEquipmentNodeId(item),
    name: item.display_name,
    type,
    x: position.x,
    y: position.y,
    ip: item.primary_ip || "",
    vlan: "",
    zone: item.location || "",
    asn: "",
    layer: guessLayerFromNodeType(type),
    status: "healthy",
    model: item.equipment_type_name,
    os: "",
    interfaces,
    routes: [],
    services: [],
  };
}

export function createEquipmentNodeId(item: Pick<NetworkTopologyEligibleEquipment, "equipment_source" | "equipment_item_id">) {
  return `eqm_${item.equipment_source}_${item.equipment_item_id}`;
}

export function isEquipmentAlreadyOnCanvas(document: TopologyDocument, item: Pick<NetworkTopologyEligibleEquipment, "equipment_source" | "equipment_item_id" | "display_name" | "equipment_type_name" | "primary_ip">) {
  const deterministicId = createEquipmentNodeId(item);
  return document.nodes.some((node) => {
    if (node.id === deterministicId) return true;
    if (node.name !== item.display_name) return false;
    if (node.model !== item.equipment_type_name) return false;
    if (item.primary_ip && node.ip) return node.ip === item.primary_ip;
    return true;
  });
}

export function toFlowNode(node: NetworkNode): Node<{ node: NetworkNode }> {
  return {
    id: node.id,
    type: "networkNode",
    position: { x: node.x, y: node.y },
    data: { node },
    draggable: true,
    selectable: true,
    style: {
      width: 168,
      background: "transparent",
      border: "none",
      boxShadow: "none",
    },
  };
}

export function toFlowEdge(edge: NetworkEdge): Edge<{ edge: NetworkEdge }> {
  return {
    id: edge.id,
    type: "networkEdge",
    source: edge.from,
    target: edge.to,
    data: { edge },
  };
}

export function applyNodePositionChanges(document: TopologyDocument, changes: NodeChange[]): TopologyDocument {
  let next = document;
  for (const change of changes) {
    if (change.type === "remove") {
      next = {
        ...next,
        nodes: next.nodes.filter((node) => node.id !== change.id),
        edges: next.edges.filter((edge) => edge.from !== change.id && edge.to !== change.id),
      };
      continue;
    }
    if (change.type === "position" && change.position) {
      next = {
        ...next,
        nodes: next.nodes.map((node) =>
          node.id === change.id ? { ...node, x: change.position!.x, y: change.position!.y } : node
        ),
      };
    }
  }
  return next;
}

export function addEdgeFromConnection(
  document: TopologyDocument,
  connection: Connection,
  style: EdgeStyle = "ethernet"
): TopologyDocument {
  if (!connection.source || !connection.target || connection.source === connection.target) {
    return document;
  }
  const exists = document.edges.some(
    (edge) =>
      (edge.from === connection.source && edge.to === connection.target) ||
      (edge.from === connection.target && edge.to === connection.source)
  );
  if (exists) {
    return document;
  }
  return {
    ...document,
    edges: [
      ...document.edges,
      {
        id: createId("edge"),
        from: connection.source,
        to: connection.target,
        label: "",
        style,
        bandwidth: "",
        latency: "",
        status: "healthy",
        network: "",
      },
    ],
  };
}

export function updateNode(document: TopologyDocument, nodeId: string, patch: Partial<NetworkNode>): TopologyDocument {
  return {
    ...document,
    nodes: document.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
  };
}

export function updateEdge(document: TopologyDocument, edgeId: string, patch: Partial<NetworkEdge>): TopologyDocument {
  return {
    ...document,
    edges: document.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
  };
}

export function deleteNodes(document: TopologyDocument, nodeIds: string[]): TopologyDocument {
  const ids = new Set(nodeIds);
  return {
    ...document,
    nodes: document.nodes.filter((node) => !ids.has(node.id)),
    edges: document.edges.filter((edge) => !ids.has(edge.from) && !ids.has(edge.to)),
  };
}

export function deleteEdge(document: TopologyDocument, edgeId: string): TopologyDocument {
  return { ...document, edges: document.edges.filter((edge) => edge.id !== edgeId) };
}

export function duplicateNodes(document: TopologyDocument, nodeIds: string[]): { document: TopologyDocument; newIds: string[] } {
  const sourceNodes = document.nodes.filter((node) => nodeIds.includes(node.id));
  const clones = sourceNodes.map((node, index) => ({
    ...node,
    id: createId("node"),
    x: node.x + 48 + index * 8,
    y: node.y + 48 + index * 8,
    name: `${node.name} Copy`,
  }));
  return {
    document: { ...document, nodes: [...document.nodes, ...clones] },
    newIds: clones.map((node) => node.id),
  };
}

export function autoLayout(document: TopologyDocument): TopologyDocument {
  return {
    ...document,
    nodes: document.nodes.map((node, index) => ({
      ...node,
      x: 120 + (index % 4) * 220,
      y: 140 + Math.floor(index / 4) * 210,
    })),
  };
}

export function computeTopologyValidation(document: TopologyDocument) {
  const findings: { id: string; severity: "warning" | "critical"; title: string; detail: string }[] = [];
  document.nodes.forEach((node) => {
    if (node.status !== "healthy") {
      findings.push({
        id: `node-${node.id}`,
        severity: node.status === "critical" ? "critical" : "warning",
        title: `${node.name} status is ${node.status}`,
        detail: `Review device health, interfaces and services for ${node.name}.`,
      });
    }
    const degree = document.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length;
    if (degree === 0) {
      findings.push({
        id: `isolated-${node.id}`,
        severity: "warning",
        title: `${node.name} is isolated`,
        detail: "This node has no links in the current topology.",
      });
    }
    if (["router", "core-switch", "firewall"].includes(node.type) && node.routes.length === 0) {
      findings.push({
        id: `routes-${node.id}`,
        severity: "warning",
        title: `${node.name} has no routes`,
        detail: "Critical network devices should expose at least one routing entry.",
      });
    }
  });
  document.edges.forEach((edge) => {
    if (edge.status !== "healthy") {
      findings.push({
        id: `edge-${edge.id}`,
        severity: edge.status === "critical" ? "critical" : "warning",
        title: `${edge.label || edge.network || edge.id} link degraded`,
        detail: `The connection between ${edge.from} and ${edge.to} is marked as ${edge.status}.`,
      });
    }
  });
  return findings;
}

export function computeShortestPath(document: TopologyDocument, startId: string, endId: string) {
  if (!startId || !endId || startId === endId) {
    return { nodeIds: startId && endId && startId === endId ? [startId] : [], edgeIds: [] };
  }
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const neighbors = document.edges
      .filter((edge) => edge.from === nodeId || edge.to === nodeId)
      .map((edge) => ({
        nodeId: edge.from === nodeId ? edge.to : edge.from,
        edgeId: edge.id,
      }));
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) continue;
      visited.add(neighbor.nodeId);
      previous.set(neighbor.nodeId, { nodeId, edgeId: neighbor.edgeId });
      if (neighbor.nodeId === endId) {
        const nodeIds: string[] = [endId];
        const edgeIds: string[] = [];
        let current = endId;
        while (current !== startId) {
          const link = previous.get(current);
          if (!link) break;
          edgeIds.unshift(link.edgeId);
          nodeIds.unshift(link.nodeId);
          current = link.nodeId;
        }
        return { nodeIds, edgeIds };
      }
      queue.push(neighbor.nodeId);
    }
  }
  return { nodeIds: [], edgeIds: [] };
}

export function exportDocument(topologyDocument: TopologyDocument, filename: string) {
  const blob = new Blob([JSON.stringify(topologyDocument, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function importDocumentFromFile(file: File): Promise<TopologyDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}")) as TopologyDocument;
        resolve({
          nodes: parsed.nodes || [],
          edges: parsed.edges || [],
          policies: parsed.policies || [],
          viewport: parsed.viewport || { x: 0, y: 0 },
          zoom: parsed.zoom ?? 1,
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function getStatusPalette(status: HealthStatus) {
  switch (status) {
    case "warning":
      return { stroke: "#f59e0b", soft: "#fff7d6", label: "warning" };
    case "critical":
      return { stroke: "#ef4444", soft: "#ffe3e3", label: "critical" };
    default:
      return { stroke: "#10b981", soft: "#dff8ef", label: "healthy" };
  }
}
