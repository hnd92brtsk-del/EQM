import { apiFetch } from "./client";

export type CabinetItemRecord = {
  id: number;
  cabinet_id: number;
  equipment_type_id: number;
  quantity: number;
  equipment_type_name?: string | null;
  manufacturer_name?: string | null;
};

export function createCabinetItem(payload: { cabinet_id: number; equipment_type_id: number; quantity: number }) {
  return apiFetch<CabinetItemRecord>("/cabinet-items/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteCabinetItem(itemId: number) {
  return apiFetch<{ status: string }>(`/cabinet-items/${itemId}`, {
    method: "DELETE",
  });
}
