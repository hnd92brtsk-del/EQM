import { apiFetch } from "../../api/client";
import { buildQuery, type Pagination } from "../../api/entities";
import type { SerialMapDocumentRecord, SerialMapEligibleEquipment, SerialMapProjectDraft } from "./types";

export function listSerialMapDocuments(params: Record<string, string | number | boolean | undefined>) {
  return apiFetch<Pagination<SerialMapDocumentRecord>>(`/serial-map-documents${buildQuery(params)}`);
}

export function getSerialMapDocument(id: number) {
  return apiFetch<SerialMapDocumentRecord>(`/serial-map-documents/${id}`);
}

export function createSerialMapDocument(payload: {
  name: string;
  description?: string | null;
  scope?: string | null;
  location_id?: number | null;
  source_context?: Record<string, unknown> | null;
  document: SerialMapProjectDraft;
}) {
  return apiFetch<SerialMapDocumentRecord>("/serial-map-documents", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSerialMapDocument(
  id: number,
  payload: {
    name?: string;
    description?: string | null;
    scope?: string | null;
    location_id?: number | null;
    source_context?: Record<string, unknown> | null;
    document?: SerialMapProjectDraft;
  }
) {
  return apiFetch<SerialMapDocumentRecord>(`/serial-map-documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteSerialMapDocument(id: number) {
  return apiFetch<void>(`/serial-map-documents/${id}`, { method: "DELETE" });
}

export function duplicateSerialMapDocument(id: number, name?: string) {
  return apiFetch<SerialMapDocumentRecord>(`/serial-map-documents/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify({ name: name || null })
  });
}

export function listSerialMapEligibleEquipment(params: Record<string, string | number | boolean | undefined> = {}) {
  return apiFetch<SerialMapEligibleEquipment[]>(`/serial-map-documents/eligible-equipment/list${buildQuery(params)}`);
}
