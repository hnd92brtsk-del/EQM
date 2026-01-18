import { apiFetch } from "../api/client";

export type SignalTypeTreeNode = {
  id: number;
  name: string;
  children?: SignalTypeTreeNode[];
};

export type SignalTypeOption = { label: string; value: number };

export type SignalTypeLookups = {
  options: SignalTypeOption[];
  breadcrumbMap: Map<number, string>;
  leafIds: Set<number>;
};

export async function fetchSignalTypesTree(
  includeDeleted = false
): Promise<SignalTypeTreeNode[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return apiFetch<SignalTypeTreeNode[]>(`/signal-types/tree${query}`);
}

export function buildSignalTypeLookups(
  tree: SignalTypeTreeNode[],
  indentUnit = "--"
): SignalTypeLookups {
  const options: SignalTypeOption[] = [];
  const breadcrumbMap = new Map<number, string>();
  const leafIds = new Set<number>();

  const walk = (node: SignalTypeTreeNode, path: string[], depth: number) => {
    const nextPath = [...path, node.name];
    const labelPrefix = depth > 0 ? `${indentUnit.repeat(depth)} ` : "";
    const breadcrumb = nextPath.join(" / ");
    options.push({ label: `${labelPrefix}${node.name}`, value: node.id });
    breadcrumbMap.set(node.id, breadcrumb);
    if (!node.children || node.children.length === 0) {
      leafIds.add(node.id);
    }
    (node.children || []).forEach((child) => walk(child, nextPath, depth + 1));
  };

  tree.forEach((node) => walk(node, [], 0));

  return { options, breadcrumbMap, leafIds };
}
