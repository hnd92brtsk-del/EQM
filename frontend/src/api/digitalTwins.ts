import { apiFetch } from "./client";

export type DigitalTwinScope = "cabinet" | "assembly";
export type TwinMountType = "din-rail" | "wall" | "other";
export type TwinPowerRole = "consumer" | "source" | "converter" | "passive";
export type TwinItemStatus = "active" | "out_of_operation";
export type TwinPlacementMode = "unplaced" | "rail" | "wall";

export type DigitalTwinWall = {
  id: string;
  name: string;
};

export type DigitalTwinRail = {
  id: string;
  wall_id: string;
  name: string;
  length_mm: number;
  sort_order: number;
};

export type DigitalTwinPort = {
  type: string;
  count: number;
};

export type DigitalTwinItem = {
  id: string;
  item_kind: "source-backed" | "manual";
  source_status: TwinItemStatus;
  placement_mode: TwinPlacementMode;
  name: string;
  user_label?: string | null;
  equipment_item_source?: DigitalTwinScope | null;
  equipment_item_id?: number | null;
  equipment_type_id?: number | null;
  manufacturer_name?: string | null;
  article?: string | null;
  nomenclature_number?: string | null;
  quantity: number;
  current_type?: string | null;
  supply_voltage?: string | null;
  current_consumption_a?: number | null;
  mount_type?: TwinMountType | null;
  mount_width_mm?: number | null;
  power_role?: TwinPowerRole | null;
  output_voltage?: string | null;
  max_output_current_a?: number | null;
  is_channel_forming: boolean;
  channel_count: number;
  ai_count: number;
  di_count: number;
  ao_count: number;
  do_count: number;
  is_network: boolean;
  network_ports: DigitalTwinPort[];
  has_serial_interfaces: boolean;
  serial_ports: DigitalTwinPort[];
  wall_id?: string | null;
  rail_id?: string | null;
  sort_order: number;
};

export type DigitalTwinPowerNode = {
  id: string;
  item_id: string;
  label: string;
  x: number;
  y: number;
  voltage?: string | null;
  role?: TwinPowerRole | null;
  status: TwinItemStatus;
};

export type DigitalTwinPowerEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  voltage?: string | null;
  role?: string | null;
};

export type DigitalTwinDocument = {
  version: number;
  walls: DigitalTwinWall[];
  rails: DigitalTwinRail[];
  items: DigitalTwinItem[];
  powerGraph: {
    nodes: DigitalTwinPowerNode[];
    edges: DigitalTwinPowerEdge[];
  };
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  ui: {
    active_wall_id?: string | null;
    active_layer: string;
    selected_item_id?: string | null;
  };
};

export type DigitalTwinRecord = {
  id: number;
  scope: DigitalTwinScope;
  source_id: number;
  source_context?: Record<string, unknown> | null;
  document: DigitalTwinDocument;
  created_by_id?: number | null;
  updated_by_id?: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at?: string | null;
};

export function ensureDigitalTwin(scope: DigitalTwinScope, sourceId: number) {
  return apiFetch<DigitalTwinRecord>(`/digital-twins/${scope}/${sourceId}/ensure`, {
    method: "POST",
  });
}

export function getDigitalTwin(scope: DigitalTwinScope, sourceId: number) {
  return apiFetch<DigitalTwinRecord>(`/digital-twins/${scope}/${sourceId}`);
}

export function syncDigitalTwinFromOperation(scope: DigitalTwinScope, sourceId: number) {
  return apiFetch<DigitalTwinRecord>(`/digital-twins/${scope}/${sourceId}/sync-from-operation`, {
    method: "POST",
  });
}

export function updateDigitalTwin(id: number, payload: { source_context?: Record<string, unknown> | null; document: DigitalTwinDocument }) {
  return apiFetch<DigitalTwinRecord>(`/digital-twins/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
