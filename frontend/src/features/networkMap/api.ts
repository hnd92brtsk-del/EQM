import { apiFetch } from "../../api/client";
import { buildQuery, type Pagination } from "../../api/entities";
import type { NetworkTopologyDocumentRecord, NetworkTopologyEligibleEquipment, TopologyDocument } from "./types";

export function listNetworkTopologies(params: Record<string, string | number | boolean | undefined>) {
  return apiFetch<Pagination<NetworkTopologyDocumentRecord>>(`/network-topologies${buildQuery(params)}`);
}

export function getNetworkTopology(id: number) {
  return apiFetch<NetworkTopologyDocumentRecord>(`/network-topologies/${id}`);
}

export function createNetworkTopology(payload: {
  name: string;
  description?: string | null;
  scope?: string | null;
  location_id?: number | null;
  source_context?: Record<string, unknown> | null;
  document: TopologyDocument;
}) {
  return apiFetch<NetworkTopologyDocumentRecord>("/network-topologies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateNetworkTopology(
  id: number,
  payload: {
    name?: string;
    description?: string | null;
    scope?: string | null;
    location_id?: number | null;
    source_context?: Record<string, unknown> | null;
    document?: TopologyDocument;
  }
) {
  return apiFetch<NetworkTopologyDocumentRecord>(`/network-topologies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listNetworkTopologyEligibleEquipment(params: Record<string, string | number | boolean | undefined>) {
  return apiFetch<NetworkTopologyEligibleEquipment[]>(`/network-topologies/eligible-equipment/list${buildQuery(params)}`);
}
