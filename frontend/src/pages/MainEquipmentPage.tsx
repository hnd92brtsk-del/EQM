import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Collapse,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DictionariesTabs } from "../components/DictionariesTabs";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, updateEntity, restoreEntity, Pagination } from "../api/entities";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { buildMainEquipmentLookups } from "../utils/mainEquipment";

type MainEquipment = {
  id: number;
  name: string;
  parent_id?: number | null;
  level: number;
  code: string;
  is_deleted: boolean;
};

type MainEquipmentNode = MainEquipment & { children: MainEquipmentNode[] };

async function fetchAllMainEquipment(includeDeleted: boolean) {
  const pageSize = 200;
  let page = 1;
  let items: MainEquipment[] = [];
  while (true) {
    const data = await apiFetch<Pagination<MainEquipment>>(
      `/main-equipment?page=${page}&page_size=${pageSize}&include_deleted=${includeDeleted}`
    );
    items = items.concat(data.items);
    if (items.length >= data.total) {
      break;
    }
    page += 1;
  }
  return items;
}

function buildTree(items: MainEquipment[]): MainEquipmentNode[] {
  const nodeMap = new Map<number, MainEquipmentNode>();
  items.forEach((item) => nodeMap.set(item.id, { ...item, children: [] }));
  const roots: MainEquipmentNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function sortTree(nodes: MainEquipmentNode[]): MainEquipmentNode[] {
  const compareCodes = (a: string, b: string) => {
    const aParts = a.split(".").map((part) => Number(part));
    const bParts = b.split(".").map((part) => Number(part));
    const maxLen = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < maxLen; i += 1) {
      const av = aParts[i] ?? -1;
      const bv = bParts[i] ?? -1;
      if (av !== bv) {
        return av - bv;
      }
    }
    return 0;
  };

  return nodes
    .map((node) => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => compareCodes(a.code, b.code));
}

function filterTree(nodes: MainEquipmentNode[], query: string): MainEquipmentNode[] {
  if (!query.trim()) {
    return nodes;
  }
  const lower = query.toLowerCase();
  const filtered: MainEquipmentNode[] = [];
  nodes.forEach((node) => {
    const childMatches = filterTree(node.children, query);
    const matches = node.name.toLowerCase().includes(lower) || node.code.toLowerCase().includes(lower);
    if (matches || childMatches.length > 0) {
      filtered.push({ ...node, children: childMatches });
    }
  });
  return filtered;
}

function collectDescendantIds(node: MainEquipmentNode): Set<number> {
  const ids = new Set<number>();
  const stack = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop()!;
    ids.add(current.id);
    stack.push(...current.children);
  }
  return ids;
}

export default function MainEquipmentPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const itemsQuery = useQuery({
    queryKey: ["main-equipment-tree", showDeleted],
    queryFn: () => fetchAllMainEquipment(showDeleted)
  });

  useEffect(() => {
    if (itemsQuery.error) {
      setErrorMessage(
        itemsQuery.error instanceof Error
          ? itemsQuery.error.message
          : t("pagesUi.mainEquipment.errors.load")
      );
    }
  }, [itemsQuery.error, t]);

  const tree = useMemo(() => sortTree(buildTree(itemsQuery.data || [])), [itemsQuery.data]);
  const filteredTree = useMemo(() => filterTree(tree, q), [tree, q]);
  const itemMap = useMemo(() => {
    const map = new Map<number, MainEquipment>();
    (itemsQuery.data || []).forEach((item) => map.set(item.id, item));
    return map;
  }, [itemsQuery.data]);

  const lookups = useMemo(() => buildMainEquipmentLookups(tree), [tree]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["main-equipment-tree"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; parent_id?: number | null }) => createEntity("/main-equipment", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.mainEquipment.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<MainEquipment> }) =>
      updateEntity("/main-equipment", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.mainEquipment.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/main-equipment", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.mainEquipment.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/main-equipment", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.mainEquipment.errors.restore"))
  });

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getLevelLabel = (level: number) => {
    if (level === 1) return t("pagesUi.mainEquipment.labels.category");
    if (level === 2) return t("pagesUi.mainEquipment.labels.equipment");
    return t("pagesUi.mainEquipment.labels.subtype");
  };

  const openCreateDialog = (parentId?: number | null) => {
    setDialog({
      open: true,
      title: t("pagesUi.mainEquipment.dialogs.createTitle"),
      fields: [
        { name: "name", label: t("common.fields.name"), type: "text" },
        {
          name: "parent_id",
          label: t("common.fields.parent"),
          type: "select",
          options: lookups.options
        }
      ],
      values: { name: "", parent_id: parentId ?? "" },
      onSave: (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        createMutation.mutate({
          name: values.name,
          parent_id: parentValue
        });
        setDialog(null);
      }
    });
  };

  const openEditDialog = (node: MainEquipmentNode) => {
    const disallowedIds = collectDescendantIds(node);
    disallowedIds.add(node.id);
    setDialog({
      open: true,
      title: t("pagesUi.mainEquipment.dialogs.editTitle"),
      fields: [
        { name: "name", label: t("common.fields.name"), type: "text" },
        {
          name: "parent_id",
          label: t("common.fields.parent"),
          type: "select",
          options: lookups.options.filter((option) => !disallowedIds.has(Number(option.value)))
        }
      ],
      values: { name: node.name, parent_id: node.parent_id ?? "" },
      onSave: (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        updateMutation.mutate({
          id: node.id,
          payload: { name: values.name, parent_id: parentValue }
        });
        setDialog(null);
      }
    });
  };

  const buildBreadcrumb = (nodeId: number) => {
    const parts: string[] = [];
    let current = itemMap.get(nodeId);
    while (current && current.parent_id) {
      const parent = itemMap.get(current.parent_id);
      if (!parent) {
        break;
      }
      parts.unshift(parent.name);
      current = parent;
    }
    return parts.join(" / ");
  };

  const renderNode = (node: MainEquipmentNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const forceExpand = q.trim().length > 0;
    const breadcrumb = buildBreadcrumb(node.id);

    return (
      <Box key={node.id} sx={{ display: "grid", gap: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", pl: depth * 2, gap: 1 }}>
          {hasChildren ? (
            <IconButton size="small" onClick={() => toggleExpanded(node.id)}>
              {expanded || forceExpand ? <ExpandMoreRoundedIcon /> : <ChevronRightRoundedIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 32 }} />
          )}
          <Box sx={{ display: "grid" }}>
            <Typography sx={{ fontWeight: 500 }}>
              {node.name}
              {node.is_deleted ? t("common.deletedSuffix") : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getLevelLabel(node.level)}
            </Typography>
            {breadcrumb ? (
              <Typography variant="body2" color="text.secondary">
                {breadcrumb}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {canWrite && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <AppButton size="small" onClick={() => openCreateDialog(node.id)}>
                {t("pagesUi.mainEquipment.actions.addChild")}
              </AppButton>
              <AppButton size="small" startIcon={<EditRoundedIcon />} onClick={() => openEditDialog(node)}>
                {t("actions.edit")}
              </AppButton>
              <AppButton
                size="small"
                color={node.is_deleted ? "success" : "error"}
                startIcon={node.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
                onClick={() =>
                  node.is_deleted ? restoreMutation.mutate(node.id) : deleteMutation.mutate(node.id)
                }
              >
                {node.is_deleted ? t("actions.restore") : t("actions.delete")}
              </AppButton>
            </Box>
          )}
        </Box>
        {hasChildren && (
          <Collapse in={expanded || forceExpand} timeout="auto" unmountOnExit>
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {node.children.map((child) => renderNode(child, depth + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pagesUi.mainEquipment.title")}</Typography>
      <DictionariesTabs />

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <TextField
              label={t("actions.search")}
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
              }}
              fullWidth
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showDeleted}
                  onChange={(event) => {
                    setShowDeleted(event.target.checked);
                    setExpandedIds(new Set());
                  }}
                />
              }
              label={t("common.showDeleted")}
            />
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreateDialog(null)}>
                {t("pagesUi.mainEquipment.actions.addRoot")}
              </AppButton>
            )}
          </Box>

          <Box sx={{ display: "grid", gap: 1 }}>{filteredTree.map((node) => renderNode(node, 0))}</Box>
        </CardContent>
      </Card>

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}

