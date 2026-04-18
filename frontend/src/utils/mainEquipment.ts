import { apiFetch } from "../api/client";

export type MainEquipmentTreeNode = {
  id: number;
  name: string;
  level: number;
  code: string;
  meta_data?: Record<string, unknown> | null;
  children?: MainEquipmentTreeNode[];
};

export type MainEquipmentOption = { label: string; value: number; disabled?: boolean };

export type MainEquipmentTreeOption = {
  label: string;
  value: number;
  disabled?: boolean;
  children?: MainEquipmentTreeOption[];
};

export type MainEquipmentLookups = {
  options: MainEquipmentOption[];
  breadcrumbMap: Map<number, string>;
  levelMap: Map<number, number>;
  treeOptions: MainEquipmentTreeOption[];
  primaryTreeOptions: MainEquipmentTreeOption[];
  driveTreeOptions: MainEquipmentTreeOption[];
  valveRootId: number | null;
  valveConstructionBranchId: number | null;
  valveDriveBranchId: number | null;
  valveConfigurationValid: boolean;
  valveTypeIds: Set<number>;
  valveDriveIds: Set<number>;
  misconfiguredValveLeafIds: Set<number>;
};

const VALVE_ROOT_NAME = "Запорно-регулирующая арматура";
const VALVE_CONSTRUCTION_BRANCH_NAME = "По конструкции";
const VALVE_DRIVE_BRANCH_NAME = "По типу привода";

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

  const findNodeByName = (
    nodes: MainEquipmentTreeNode[],
    name: string,
  ): MainEquipmentTreeNode | null => {
    for (const node of nodes) {
      if (node.name === name) {
        return node;
      }
      const nested = findNodeByName(node.children || [], name);
      if (nested) {
        return nested;
      }
    }
    return null;
  };

  const collectLeafIds = (node: MainEquipmentTreeNode | null, target = new Set<number>()) => {
    if (!node) {
      return target;
    }
    const children = node.children || [];
    if (children.length === 0) {
      target.add(node.id);
      return target;
    }
    children.forEach((child) => collectLeafIds(child, target));
    return target;
  };

  const buildTreeOptions = (
    nodes: MainEquipmentTreeNode[],
    disabledLeafIds: Set<number>,
  ): MainEquipmentTreeOption[] =>
    nodes.map((node) => {
      const children = buildTreeOptions(node.children || [], disabledLeafIds);
      const isLeaf = children.length === 0;
      return {
        label: node.name,
        value: node.id,
        disabled: isLeaf && disabledLeafIds.has(node.id),
        children,
      };
    });

  tree.forEach((node) => walk(node, [], 0));

  const valveRoot = findNodeByName(tree, VALVE_ROOT_NAME);
  const valveConstructionBranch =
    valveRoot?.children?.find((child) => child.name === VALVE_CONSTRUCTION_BRANCH_NAME) || null;
  const valveDriveBranch =
    valveRoot?.children?.find((child) => child.name === VALVE_DRIVE_BRANCH_NAME) || null;
  const valveTypeIds = collectLeafIds(valveConstructionBranch);
  const valveDriveIds = collectLeafIds(valveDriveBranch);
  const valveLeafIds = collectLeafIds(valveRoot);
  const valveConfigurationValid = Boolean(valveRoot && valveConstructionBranch && valveDriveBranch);
  const misconfiguredValveLeafIds = valveConfigurationValid ? new Set<number>() : valveLeafIds;

  return {
    options,
    breadcrumbMap,
    levelMap,
    treeOptions: buildTreeOptions(tree, new Set<number>()),
    primaryTreeOptions: buildTreeOptions(
      tree,
      valveConfigurationValid ? valveDriveIds : misconfiguredValveLeafIds,
    ),
    driveTreeOptions:
      valveRoot && valveDriveBranch
        ? buildTreeOptions(
            [
              {
                ...valveRoot,
                children: [valveDriveBranch],
              },
            ],
            new Set<number>(),
          )
        : [],
    valveRootId: valveRoot?.id || null,
    valveConstructionBranchId: valveConstructionBranch?.id || null,
    valveDriveBranchId: valveDriveBranch?.id || null,
    valveConfigurationValid,
    valveTypeIds,
    valveDriveIds,
    misconfiguredValveLeafIds,
  };
}
