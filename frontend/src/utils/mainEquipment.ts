import { apiFetch } from "../api/client";

export type MainEquipmentTreeNode = {
  id: number;
  name: string;
  level: number;
  code: string;
  children?: MainEquipmentTreeNode[];
};

export type MainEquipmentOption = { label: string; value: number; disabled?: boolean };

export type MainEquipmentLookups = {
  options: MainEquipmentOption[];
  breadcrumbMap: Map<number, string>;
  levelMap: Map<number, number>;
};

export async function fetchMainEquipmentTree(includeDeleted = false): Promise<MainEquipmentTreeNode[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return apiFetch<MainEquipmentTreeNode[]>(`/main-equipment/tree${query}`);
}

export function buildMainEquipmentLookups(
  tree: MainEquipmentTreeNode[],
  indentUnit = "--"
): MainEquipmentLookups {
  const options: MainEquipmentOption[] = [];
  const breadcrumbMap = new Map<number, string>();
  const levelMap = new Map<number, number>();

  const walk = (node: MainEquipmentTreeNode, path: string[], depth: number) => {
    const nextPath = [...path, node.name];
    const labelPrefix = depth > 0 ? `${indentUnit.repeat(depth)} ` : "";
    options.push({ label: `${labelPrefix}${node.name}`, value: node.id });
    breadcrumbMap.set(node.id, nextPath.join(" / "));
    levelMap.set(node.id, node.level);
    (node.children || []).forEach((child) => walk(child, nextPath, depth + 1));
  };

  tree.forEach((node) => walk(node, [], 0));

  return { options, breadcrumbMap, levelMap };
}

