import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "./entities";

export type TechnologicalEquipment = {
  id: number;
  name: string;
  main_equipment_id: number;
  main_equipment_name?: string | null;
  tag?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  location_path?: string | null;
  description?: string | null;
  is_deleted: boolean;
};

export function listTechnologicalEquipment(params: Record<string, unknown>) {
  return listEntity<TechnologicalEquipment>("/technological-equipment", params);
}

export function createTechnologicalEquipment(payload: Partial<TechnologicalEquipment>) {
  return createEntity<TechnologicalEquipment>("/technological-equipment", payload);
}

export function updateTechnologicalEquipment(id: number, payload: Partial<TechnologicalEquipment>) {
  return updateEntity<TechnologicalEquipment>("/technological-equipment", id, payload);
}

export function deleteTechnologicalEquipment(id: number) {
  return deleteEntity("/technological-equipment", id);
}

export function restoreTechnologicalEquipment(id: number) {
  return restoreEntity("/technological-equipment", id);
}
