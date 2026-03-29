import { apiFetch } from "./client";

export type BatchDirectToCabinetItem = {
  equipment_type_id: number;
  quantity: number;
  reference?: string | null;
  comment?: string | null;
};

export type MovementRecord = {
  id: number;
  movement_type: string;
  equipment_type_id: number;
  quantity: number;
  from_warehouse_id?: number | null;
  to_warehouse_id?: number | null;
  from_cabinet_id?: number | null;
  to_cabinet_id?: number | null;
  to_assembly_id?: number | null;
  reference?: string | null;
  comment?: string | null;
  performed_by_id: number;
};

export function createDirectToCabinetBatch(payload: {
  movement_type: "direct_to_cabinet";
  to_cabinet_id: number;
  items: BatchDirectToCabinetItem[];
}) {
  return apiFetch<MovementRecord[]>("/movements/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
