import { apiFetch } from "./client";

export type IOTreeChannelDevice = {
  equipment_in_operation_id: number;
  equipment_name: string;
  manufacturer_name?: string | null;
  nomenclature_number?: string | null;
  article?: string | null;
  ai_count: number;
  di_count: number;
  ao_count: number;
  do_count: number;
  signals_total: number;
};

export type IOTreeCabinet = {
  id: number;
  name: string;
  factory_number?: string | null;
  inventory_number?: string | null;
  channel_devices: IOTreeChannelDevice[];
};

export type IOTreeLocation = {
  id: number;
  name: string;
  children: IOTreeLocation[];
  cabinets: IOTreeCabinet[];
};

export type IOTreeResponse = {
  locations: IOTreeLocation[];
};

export async function fetchIOTree(): Promise<IOTreeResponse> {
  return apiFetch<IOTreeResponse>("/io-tree");
}
