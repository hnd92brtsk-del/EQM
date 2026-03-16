export type IPAMRole = "viewer" | "engineer" | "admin";

export type Vlan = {
  id: number;
  vlan_number: number;
  name: string;
  purpose?: string | null;
  description?: string | null;
  location_id?: number | null;
  is_active: boolean;
};

export type Subnet = {
  id: number;
  vlan_id?: number | null;
  vlan_number?: number | null;
  vlan_name?: string | null;
  cidr: string;
  prefix: number;
  network_address: string;
  gateway_ip?: string | null;
  name?: string | null;
  description?: string | null;
  location_id?: number | null;
  vrf?: string | null;
  is_active: boolean;
};

export type AddressSummary = {
  total: number;
  free: number;
  used: number;
  reserved: number;
  gateway: number;
  broadcast: number;
  network: number;
};

export type NetworkInterface = {
  id: number;
  equipment_instance_id: number;
  interface_name: string;
  interface_index?: number | null;
  interface_type?: string | null;
  connector_spec?: string | null;
  mac_address?: string | null;
  is_management: boolean;
  is_active: boolean;
};

export type EligibleEquipment = {
  equipment_instance_id: number;
  display_name: string;
  source: "cabinet";
  cabinet_id: number;
  cabinet_name: string;
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
  network_interfaces: NetworkInterface[];
};

export type IPAddressDetails = {
  id?: number | null;
  subnet_id: number;
  ip_address: string;
  ip_offset: number;
  status: "free" | "used" | "reserved" | "gateway" | "broadcast" | "network";
  hostname?: string | null;
  dns_name?: string | null;
  mac_address?: string | null;
  comment?: string | null;
  equipment_instance_id?: number | null;
  equipment_interface_id?: number | null;
  equipment_interface_name?: string | null;
  is_primary: boolean;
  source?: string | null;
  last_seen_at?: string | null;
  is_service: boolean;
  is_editable: boolean;
};

export type HeatmapAggregate = {
  block_cidr: string;
  offset_start: number;
  offset_end: number;
  free: number;
  used: number;
  reserved: number;
  gateway: number;
  broadcast: number;
  network: number;
};

export type AddressGridResponse = {
  subnet: Subnet;
  summary: AddressSummary;
  mode: "grid" | "list" | "heatmap";
  items: IPAddressDetails[];
  aggregates: HeatmapAggregate[];
  pagination?: {
    items: never[];
    page: number;
    page_size: number;
    total: number;
  } | null;
};

export type CabinetItemIPAMSummary = {
  eligible_for_ipam: boolean;
  network_interfaces_count: number;
  linked_ip_addresses: string[];
  linked_subnets: string[];
  current_ip_links_count: number;
};
