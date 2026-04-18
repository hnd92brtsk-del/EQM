import { apiFetch } from "../api/client";

export type EquipmentCategoryTreeNode = {
  id: number;
  name: string;
  children?: EquipmentCategoryTreeNode[];
};

export type EquipmentCategoryOption = { label: string; value: number };

export type EquipmentCategoryLookups = {
  options: EquipmentCategoryOption[];
  breadcrumbMap: Map<number, string>;
  leafIds: Set<number>;
};

export async function fetchEquipmentCategoriesTree(includeDeleted = false): Promise<EquipmentCategoryTreeNode[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return apiFetch<EquipmentCategoryTreeNode[]>(`/equipment-categories/tree${query}`);
}

export function buildEquipmentCategoryLookups(
  tree: EquipmentCategoryTreeNode[],
  indentUnit = "--"
): EquipmentCategoryLookups {
  const options: EquipmentCategoryOption[] = [];
  const breadcrumbMap = new Map<number, string>();
  const leafIds = new Set<number>();

  const walk = (node: EquipmentCategoryTreeNode, path: string[], depth: number) => {
    const nextPath = [...path, node.name];
    const labelPrefix = depth > 0 ? `${indentUnit.repeat(depth)} ` : "";
    options.push({ label: `${labelPrefix}${node.name}`, value: node.id });
    breadcrumbMap.set(node.id, nextPath.join(" / "));
    if (!node.children || node.children.length === 0) {
      leafIds.add(node.id);
    }
    (node.children || []).forEach((child) => walk(child, nextPath, depth + 1));
  };

  tree.forEach((node) => walk(node, [], 0));

  return { options, breadcrumbMap, leafIds };
}
