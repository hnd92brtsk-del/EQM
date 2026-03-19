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
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiFetch } from "../api/client";
import { createEntity, deleteEntity, Pagination, restoreEntity, updateEntity } from "../api/entities";
import { DictionariesTabs } from "../components/DictionariesTabs";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { AppButton } from "../components/ui/AppButton";
import { useAuth } from "../context/AuthContext";
import { annotateLiveTree, type LiveTreeAnnotation } from "../utils/liveFilter";

type EquipmentCategory = {
  id: number;
  name: string;
  parent_id?: number | null;
  full_path?: string | null;
  is_deleted: boolean;
};

type EquipmentCategoryNode = EquipmentCategory & { children: EquipmentCategoryNode[] };

type TreeOption = {
  label: string;
  value: number;
  children?: TreeOption[];
};

async function fetchAllCategories(includeDeleted: boolean) {
  const pageSize = 200;
  let page = 1;
  let items: EquipmentCategory[] = [];
  while (true) {
    const data = await apiFetch<Pagination<EquipmentCategory>>(
      `/equipment-categories?page=${page}&page_size=${pageSize}&include_deleted=${includeDeleted}`
    );
    items = items.concat(data.items);
    if (items.length >= data.total) {
      break;
    }
    page += 1;
  }
  return items;
}

function buildTree(items: EquipmentCategory[]): EquipmentCategoryNode[] {
  const nodeMap = new Map<number, EquipmentCategoryNode>();
  items.forEach((item) => nodeMap.set(item.id, { ...item, children: [] }));
  const roots: EquipmentCategoryNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function sortTree(nodes: EquipmentCategoryNode[]): EquipmentCategoryNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildTreeOptions(nodes: EquipmentCategoryNode[]): TreeOption[] {
  return nodes.map((node) => ({
    label: node.name,
    value: node.id,
    children: buildTreeOptions(node.children)
  }));
}

export default function EquipmentCategoriesPage() {
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
    queryKey: ["equipment-categories-tree", showDeleted],
    queryFn: () => fetchAllCategories(showDeleted)
  });

  useEffect(() => {
    if (itemsQuery.error) {
      setErrorMessage(
        itemsQuery.error instanceof Error
          ? itemsQuery.error.message
          : t("pagesUi.equipmentCategories.errors.load")
      );
    }
  }, [itemsQuery.error, t]);

  const tree = useMemo(() => sortTree(buildTree(itemsQuery.data || [])), [itemsQuery.data]);
  const treeAnnotations = useMemo(
    () =>
      annotateLiveTree(
        tree,
        {
          getLabel: (node) => node.name,
          getChildren: (node) => node.children
        },
        q
      ),
    [tree, q]
  );
  const treeOptions = useMemo(() => buildTreeOptions(tree), [tree]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["equipment-categories-tree"] });
    queryClient.invalidateQueries({ queryKey: ["equipment-categories-options"] });
    queryClient.invalidateQueries({ queryKey: ["equipment-categories-flat-options"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; parent_id?: number | null }) =>
      createEntity("/equipment-categories", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.equipmentCategories.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<EquipmentCategory> }) =>
      updateEntity("/equipment-categories", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.equipmentCategories.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/equipment-categories", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.equipmentCategories.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/equipment-categories", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.equipmentCategories.errors.restore"))
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

  const openCreateDialog = (parentId?: number | null) => {
    setDialog({
      open: true,
      title: t("pagesUi.equipmentCategories.dialogs.createTitle"),
      fields: [
        { name: "name", label: t("common.fields.name"), type: "text" },
        {
          name: "parent_id",
          label: t("common.fields.parent"),
          type: "treeSelect",
          treeOptions
        }
      ],
      values: { name: "", parent_id: parentId ?? "" },
      onSave: (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        createMutation.mutate({ name: values.name, parent_id: parentValue });
        setDialog(null);
      }
    });
  };

  const openEditDialog = (node: EquipmentCategoryNode) => {
    setDialog({
      open: true,
      title: t("pagesUi.equipmentCategories.dialogs.editTitle"),
      fields: [
        { name: "name", label: t("common.fields.name"), type: "text" },
        {
          name: "parent_id",
          label: t("common.fields.parent"),
          type: "treeSelect",
          treeOptions: treeOptions.filter((option) => option.value !== node.id)
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

  const renderNode = (entry: LiveTreeAnnotation<EquipmentCategoryNode>, level: number) => {
    const node = entry.item;
    const hasChildren = entry.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const forceExpand = entry.shouldForceExpand;
    const fullPath = node.full_path?.trim() || "";

    return (
      <Box key={node.id} sx={{ display: "grid", gap: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", pl: level * 2, gap: 1 }}>
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
            {fullPath ? (
              <Typography variant="body2" color="text.secondary">
                {fullPath}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {canWrite && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <AppButton size="small" onClick={() => openCreateDialog(node.id)}>
                {t("pagesUi.equipmentCategories.actions.addChild")}
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
              {entry.children.map((child) => renderNode(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pagesUi.equipmentCategories.title")}</Typography>
      <DictionariesTabs />

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <TextField
            label={t("actions.search")}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            fullWidth
          />

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
                {t("pagesUi.equipmentCategories.actions.addRoot")}
              </AppButton>
            )}
          </Box>

          <Box sx={{ display: "grid", gap: 1 }}>{treeAnnotations.map((node) => renderNode(node, 0))}</Box>
        </CardContent>
      </Card>

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
