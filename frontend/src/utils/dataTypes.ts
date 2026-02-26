import { apiFetch } from "../api/client";

export type DataTypeTreeNode = {
  id: number;
  name: string;
  tooltip?: string | null;
  children?: DataTypeTreeNode[];
};

export type DataTypeOption = { label: string; value: number };

export type DataTypeLookups = {
  options: DataTypeOption[];
  breadcrumbMap: Map<number, string>;
};

export async function fetchDataTypesTree(includeDeleted = false): Promise<DataTypeTreeNode[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return apiFetch<DataTypeTreeNode[]>(`/data-types/tree${query}`);
}

export function buildDataTypeLookups(
  tree: DataTypeTreeNode[],
  indentUnit = "--"
): DataTypeLookups {
  const options: DataTypeOption[] = [];
  const breadcrumbMap = new Map<number, string>();

  const walk = (node: DataTypeTreeNode, path: string[], depth: number) => {
    const nextPath = [...path, node.name];
    const labelPrefix = depth > 0 ? `${indentUnit.repeat(depth)} ` : "";
    options.push({ label: `${labelPrefix}${node.name}`, value: node.id });
    breadcrumbMap.set(node.id, nextPath.join(" / "));
    (node.children || []).forEach((child) => walk(child, nextPath, depth + 1));
  };

  tree.forEach((node) => walk(node, [], 0));

  return { options, breadcrumbMap };
}
