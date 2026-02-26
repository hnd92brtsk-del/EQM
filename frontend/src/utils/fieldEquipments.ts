import { apiFetch } from "../api/client";

export type FieldEquipmentTreeNode = {
  id: number;
  name: string;
  children?: FieldEquipmentTreeNode[];
};

export type FieldEquipmentOption = { label: string; value: number };

export type FieldEquipmentLookups = {
  options: FieldEquipmentOption[];
  breadcrumbMap: Map<number, string>;
};

export async function fetchFieldEquipmentsTree(includeDeleted = false): Promise<FieldEquipmentTreeNode[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return apiFetch<FieldEquipmentTreeNode[]>(`/field-equipments/tree${query}`);
}

export function buildFieldEquipmentLookups(
  tree: FieldEquipmentTreeNode[],
  indentUnit = "--"
): FieldEquipmentLookups {
  const options: FieldEquipmentOption[] = [];
  const breadcrumbMap = new Map<number, string>();

  const walk = (node: FieldEquipmentTreeNode, path: string[], depth: number) => {
    const nextPath = [...path, node.name];
    const labelPrefix = depth > 0 ? `${indentUnit.repeat(depth)} ` : "";
    options.push({ label: `${labelPrefix}${node.name}`, value: node.id });
    breadcrumbMap.set(node.id, nextPath.join(" / "));
    (node.children || []).forEach((child) => walk(child, nextPath, depth + 1));
  };

  tree.forEach((node) => walk(node, [], 0));

  return { options, breadcrumbMap };
}
