import { apiFetch } from "../../../api/client";
import type { CadDocument, CadDocumentRecord } from "../../../cad";

type ApiCadRecord = Omit<CadDocumentRecord, "rowVersion" | "locationId" | "createdAt" | "updatedAt"> & {
  row_version: number; location_id: number | null; created_at: string; updated_at: string;
};

const normalize = (item: ApiCadRecord): CadDocumentRecord => ({
  ...item, rowVersion: item.row_version, locationId: item.location_id, createdAt: item.created_at, updatedAt: item.updated_at
});

export const getCadDocument = async (id: string) => normalize(await apiFetch<ApiCadRecord>(`/cad/documents/${id}`));
export const updateCadDocument = async (id: number, expectedVersion: number, document: CadDocument) =>
  normalize(await apiFetch<ApiCadRecord>(`/cad/documents/${id}`, { method: "PATCH", body: JSON.stringify({ expectedVersion, document }) }));
