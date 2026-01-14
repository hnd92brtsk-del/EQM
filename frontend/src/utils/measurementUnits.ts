import { apiFetch } from "../api/client";

export type MeasurementUnitTreeNode = {
  id: number;
  name: string;
  children?: MeasurementUnitTreeNode[];
};

export type MeasurementUnitOption = { label: string; value: number };

export type MeasurementUnitLookups = {
  options: MeasurementUnitOption[];
  breadcrumbMap: Map<number, string>;
  leafIds: Set<number>;
};

export async function fetchMeasurementUnitsTree(
  includeDeleted = false
): Promise<MeasurementUnitTreeNode[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return apiFetch<MeasurementUnitTreeNode[]>(`/measurement-units/tree${query}`);
}

export function buildMeasurementUnitLookups(
  tree: MeasurementUnitTreeNode[],
  indentUnit = "--"
): MeasurementUnitLookups {
  const options: MeasurementUnitOption[] = [];
  const breadcrumbMap = new Map<number, string>();
  const leafIds = new Set<number>();

  const walk = (node: MeasurementUnitTreeNode, path: string[], depth: number) => {
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
