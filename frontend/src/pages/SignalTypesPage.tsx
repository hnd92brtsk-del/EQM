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
import { buildSignalTypeLookups } from "../utils/signalTypes";

type SignalType = {
  id: number;
  name: string;
  parent_id?: number | null;
  sort_order?: number | null;
  is_deleted: boolean;
  created_at?: string;
};

type SignalTypeNode = SignalType & { children: SignalTypeNode[] };

async function fetchAllSignalTypes(includeDeleted: boolean) {
  const pageSize = 200;
  let page = 1;
  let items: SignalType[] = [];
  while (true) {
    const data = await apiFetch<Pagination<SignalType>>(
      `/signal-types?page=${page}&page_size=${pageSize}&include_deleted=${includeDeleted}`
    );
    items = items.concat(data.items);
    if (items.length >= data.total) {
      break;
    }
    page += 1;
  }
  return items;
}

function buildTree(items: SignalType[]): SignalTypeNode[] {
  const nodeMap = new Map<number, SignalTypeNode>();
  items.forEach((item) => nodeMap.set(item.id, { ...item, children: [] }));
  const roots: SignalTypeNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function sortTree(nodes: SignalTypeNode[]): SignalTypeNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => {
      const aOrder = a.sort_order ?? 0;
      const bOrder = b.sort_order ?? 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.name.localeCompare(b.name);
    });
}

function filterTree(nodes: SignalTypeNode[], query: string): SignalTypeNode[] {
  if (!query.trim()) {
    return nodes;
  }
  const lower = query.toLowerCase();
  const filtered: SignalTypeNode[] = [];
  nodes.forEach((node) => {
    const childMatches = filterTree(node.children, query);
    const matches = node.name.toLowerCase().includes(lower);
    if (matches || childMatches.length > 0) {
      filtered.push({ ...node, children: childMatches });
    }
  });
  return filtered;
}

export default function SignalTypesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const signalTypesQuery = useQuery({
    queryKey: ["signal-types-tree", showDeleted],
    queryFn: () => fetchAllSignalTypes(showDeleted)
  });

  useEffect(() => {
    if (signalTypesQuery.error) {
      setErrorMessage(
        signalTypesQuery.error instanceof Error
          ? signalTypesQuery.error.message
          : t("pagesUi.signalTypes.errors.load")
      );
    }
  }, [signalTypesQuery.error, t]);

  const tree = useMemo(() => sortTree(buildTree(signalTypesQuery.data || [])), [signalTypesQuery.data]);
  const filteredTree = useMemo(() => filterTree(tree, q), [tree, q]);
  const signalTypeMap = useMemo(() => {
    const map = new Map<number, SignalType>();
    (signalTypesQuery.data || []).forEach((item) => map.set(item.id, item));
    return map;
  }, [signalTypesQuery.data]);

  const parentOptions = useMemo(() => buildSignalTypeLookups(tree).options, [tree]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["signal-types-tree"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; parent_id?: number | null; sort_order?: number | null }) =>
      createEntity("/signal-types", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.signalTypes.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<SignalType> }) =>
      updateEntity("/signal-types", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.signalTypes.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/signal-types", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.signalTypes.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/signal-types", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.signalTypes.errors.restore"))
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
      title: t("pagesUi.signalTypes.dialogs.createTitle"),
      fields: [
        { name: "name", label: t("common.fields.name"), type: "text" },
        {
          name: "parent_id",
          label: t("common.fields.parent"),
          type: "select",
          options: parentOptions
        },
        {
          name: "sort_order",
          label: t("common.fields.sortOrder"),
          type: "number"
        }
      ],
      values: { name: "", parent_id: parentId ?? "", sort_order: "" },
      onSave: (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        const sortOrderValue =
          values.sort_order === "" || values.sort_order === undefined ? null : Number(values.sort_order);
        createMutation.mutate({
          name: values.name,
          parent_id: parentValue,
          sort_order: sortOrderValue
        });
        setDialog(null);
      }
    });
  };

  const openEditDialog = (node: SignalTypeNode) => {
    setDialog({
      open: true,
      title: t("pagesUi.signalTypes.dialogs.editTitle"),
      fields: [
        { name: "name", label: t("common.fields.name"), type: "text" },
        {
          name: "parent_id",
          label: t("common.fields.parent"),
          type: "select",
          options: parentOptions.filter((option) => option.value !== node.id)
        },
        {
          name: "sort_order",
          label: t("common.fields.sortOrder"),
          type: "number"
        }
      ],
      values: { name: node.name, parent_id: node.parent_id ?? "", sort_order: node.sort_order ?? "" },
      onSave: (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        const sortOrderValue =
          values.sort_order === "" || values.sort_order === undefined ? null : Number(values.sort_order);
        updateMutation.mutate({
          id: node.id,
          payload: { name: values.name, parent_id: parentValue, sort_order: sortOrderValue }
        });
        setDialog(null);
      }
    });
  };

  const buildBreadcrumb = (nodeId: number) => {
    const parts: string[] = [];
    let current = signalTypeMap.get(nodeId);
    while (current && current.parent_id) {
      const parent = signalTypeMap.get(current.parent_id);
      if (!parent) {
        break;
      }
      parts.unshift(parent.name);
      current = parent;
    }
    return parts.join(" / ");
  };

  const renderNode = (node: SignalTypeNode, level: number) => {
    const hasChildren = node.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const forceExpand = q.trim().length > 0;
    const breadcrumb = buildBreadcrumb(node.id);

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
                {t("pagesUi.signalTypes.actions.addChild")}
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
              {node.children.map((child) => renderNode(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pagesUi.signalTypes.title")}</Typography>
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
                {t("pagesUi.signalTypes.actions.addRoot")}
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
