import type { NetworkInterface as IPAMNetworkInterface } from "../ipam/types";

export type HealthStatus = "healthy" | "warning" | "critical";
export type EdgeStyle = "ethernet" | "fiber" | "vpn" | "wireless" | "mpls" | "trunk";
export type NetworkLayer = "core" | "distribution" | "access" | "security" | "datacenter" | "wan" | "edge";
export type NodeType =
  | "router"
  | "core-switch"
  | "switch"
  | "firewall"
  | "load-balancer"
  | "vpn-gateway"
  | "wireless-controller"
  | "access-point"
  | "server"
  | "vm-host"
  | "storage"
  | "nas"
  | "cloud"
  | "internet"
  | "workstation"
  | "printer"
  | "camera"
  | "iot-gateway";

export interface TopologyDocument {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  policies: TopologyPolicy[];
  viewport?: { x: number; y: number };
  zoom?: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  ip: string;
  vlan: string;
  zone: string;
  asn: string;
  layer: NetworkLayer;
  status: HealthStatus;
  model: string;
  os: string;
  interfaces: NodeInterface[];
  routes: RouteEntry[];
  services: string[];
}

export interface NetworkEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  style: EdgeStyle;
  bandwidth: string;
  latency: string;
  status: HealthStatus;
  network: string;
}

export interface TopologyPolicy {
  id: string;
  name: string;
  type: string;
  target: string;
  state: "active" | "triggered" | "disabled";
}

export interface NodeInterface {
  name: string;
  ip: string;
  vlan: string;
  status: "up" | "down" | "degraded";
}

export interface RouteEntry {
  prefix: string;
  nextHop: string;
  protocol: "static" | "ospf" | "bgp" | "eigrp" | "rip" | "isis" | string;
  metric: number | string;
}

export type NetworkTopologyDocumentRecord = {
  id: number;
  name: string;
  description?: string | null;
  scope?: string | null;
  location_id?: number | null;
  source_context?: Record<string, unknown> | null;
  document: TopologyDocument;
  created_by_id?: number | null;
  updated_by_id?: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at?: string | null;
};

export type NetworkTopologyEligibleEquipment = {
  equipment_source: "cabinet" | "assembly";
  equipment_item_id: number;
  equipment_instance_id?: number | null;
  display_name: string;
  source: "cabinet" | "assembly";
  cabinet_id?: number | null;
  cabinet_name?: string | null;
  assembly_id?: number | null;
  assembly_name?: string | null;
  location?: string | null;
  manufacturer_id?: number | null;
  manufacturer_name?: string | null;
  equipment_type_id: number;
  equipment_type_name: string;
  inventory_number?: string | null;
  serial?: string | null;
  tag?: string | null;
  has_network_interfaces: boolean;
  current_ip_links_count: number;
  network_interfaces: IPAMNetworkInterface[];
  linked_ip_addresses: string[];
  primary_ip?: string | null;
};

export type SaveState = "idle" | "saving" | "saved" | "error";
