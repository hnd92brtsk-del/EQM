import { apiFetch } from "../api/client";

export type LocationTreeNode = {
  id: number;
  name: string;
  children?: LocationTreeNode[];
};

export type LocationOption = { label: string; value: number };

export type LocationLookups = {
  options: LocationOption[];
  breadcrumbMap: Map<number, string>;
};

export async function fetchLocationsTree(includeDeleted = false): Promise<LocationTreeNode[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return apiFetch<LocationTreeNode[]>(`/locations/tree${query}`);
}

export function buildLocationLookups(tree: LocationTreeNode[], indentUnit = "--"): LocationLookups {
  const options: LocationOption[] = [];
  const breadcrumbMap = new Map<number, string>();

  const walk = (node: LocationTreeNode, path: string[], depth: number) => {
    const nextPath = [...path, node.name];
    const labelPrefix = depth > 0 ? `${indentUnit.repeat(depth)} ` : "";
    options.push({ label: `${labelPrefix}${node.name}`, value: node.id });
    breadcrumbMap.set(node.id, nextPath.join(" / "));
    (node.children || []).forEach((child) => walk(child, nextPath, depth + 1));
  };

  tree.forEach((node) => walk(node, [], 0));

  return { options, breadcrumbMap };
}
