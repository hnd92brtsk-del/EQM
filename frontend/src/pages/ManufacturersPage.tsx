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
import { EntityDialog, DialogState, TreeFieldOption } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { AppButton } from "../components/ui/AppButton";
import { useAuth } from "../context/AuthContext";
import { LIVE_FILTER_DIM_OPACITY, annotateLiveTree, type LiveTreeAnnotation } from "../utils/liveFilter";

type Manufacturer = {
  id: number;
  name: string;
  country: string;
  parent_id?: number | null;
  full_path?: string | null;
  flag?: string | null;
  founded_year?: number | null;
  segment?: string | null;
  specialization?: string | null;
  website?: string | null;
  is_deleted: boolean;
};

type ManufacturerNode = Manufacturer & { children: ManufacturerNode[] };

async function fetchAllManufacturers(includeDeleted: boolean) {
  const pageSize = 200;
  let page = 1;
  let items: Manufacturer[] = [];
  while (true) {
    const data = await apiFetch<Pagination<Manufacturer>>(
      `/manufacturers?page=${page}&page_size=${pageSize}&include_deleted=${includeDeleted}`
    );
    items = items.concat(data.items);
    if (items.length >= data.total) {
      break;
    }
    page += 1;
  }
  return items;
}

function buildTree(items: Manufacturer[]): ManufacturerNode[] {
  const nodeMap = new Map<number, ManufacturerNode>();
  items.forEach((item) => nodeMap.set(item.id, { ...item, children: [] }));
  const roots: ManufacturerNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function sortTree(nodes: ManufacturerNode[]): ManufacturerNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildCountryOptions(nodes: ManufacturerNode[]): TreeFieldOption[] {
  return nodes.map((node) => ({
    label: node.name,
    value: node.id
  }));
}

export default function ManufacturersPage() {
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
    queryKey: ["manufacturers-tree", showDeleted],
    queryFn: () => fetchAllManufacturers(showDeleted)
  });

  useEffect(() => {
    if (itemsQuery.error) {
      setErrorMessage(
        itemsQuery.error instanceof Error ? itemsQuery.error.message : t("pagesUi.manufacturers.errors.load")
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
  const countryOptions = useMemo(() => buildCountryOptions(tree), [tree]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["manufacturers-tree"] });
    queryClient.invalidateQueries({ queryKey: ["manufacturers-options"] });
    queryClient.invalidateQueries({ queryKey: ["manufacturers-flat-options"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createEntity("/manufacturers", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      updateEntity("/manufacturers", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/manufacturers", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/manufacturers", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.restore"))
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

  const openCreateCountryDialog = () => {
    setDialog({
      open: true,
      title: t("pagesUi.manufacturers.dialogs.createCountryTitle"),
      fields: [{ name: "name", label: t("common.fields.country"), type: "text" }],
      values: { name: "" },
      onSave: (values) => {
        createMutation.mutate({ name: values.name, country: values.name });
        setDialog(null);
      }
    });
  };

  const openCreateBrandDialog = (countryNode: ManufacturerNode) => {
    setDialog({
      open: true,
      title: t("pagesUi.manufacturers.dialogs.createTitle"),
      fields: [
        { name: "name", label: t("common.fields.brand"), type: "text" },
        { name: "parent_id", label: t("common.fields.country"), type: "treeSelect", treeOptions: countryOptions, leafOnly: false },
        { name: "flag", label: t("common.fields.flag"), type: "text" },
        { name: "founded_year", label: t("common.fields.foundedYear"), type: "number" },
        { name: "segment", label: t("common.fields.segment"), type: "text" },
        { name: "specialization", label: t("common.fields.specialization"), type: "text", multiline: true, rows: 3 },
        { name: "website", label: t("common.fields.website"), type: "text" }
      ],
      values: {
        name: "",
        parent_id: countryNode.id,
        flag: "",
        founded_year: "",
        segment: "",
        specialization: "",
        website: ""
      },
      onSave: (values) => {
        createMutation.mutate({
          name: values.name,
          parent_id: Number(values.parent_id),
          flag: values.flag || null,
          founded_year: values.founded_year === "" ? null : Number(values.founded_year),
          segment: values.segment || null,
          specialization: values.specialization || null,
          website: values.website || null
        });
        setDialog(null);
      }
    });
  };

  const openEditDialog = (node: ManufacturerNode) => {
    const isBrand = Boolean(node.parent_id);
    setDialog({
      open: true,
      title: t("pagesUi.manufacturers.dialogs.editTitle"),
      fields: isBrand
        ? [
            { name: "name", label: t("common.fields.brand"), type: "text" },
            { name: "parent_id", label: t("common.fields.country"), type: "treeSelect", treeOptions: countryOptions.filter((option) => option.value !== node.id) },
            { name: "flag", label: t("common.fields.flag"), type: "text" },
            { name: "founded_year", label: t("common.fields.foundedYear"), type: "number" },
            { name: "segment", label: t("common.fields.segment"), type: "text" },
            { name: "specialization", label: t("common.fields.specialization"), type: "text", multiline: true, rows: 3 },
            { name: "website", label: t("common.fields.website"), type: "text" }
          ]
        : [{ name: "name", label: t("common.fields.country"), type: "text" }],
      values: {
        name: node.name,
        parent_id: node.parent_id ?? "",
        flag: node.flag ?? "",
        founded_year: node.founded_year ?? "",
        segment: node.segment ?? "",
        specialization: node.specialization ?? "",
        website: node.website ?? ""
      },
      onSave: (values) => {
        updateMutation.mutate({
          id: node.id,
          payload: isBrand
            ? {
                name: values.name,
                parent_id: values.parent_id === "" ? null : Number(values.parent_id),
                flag: values.flag || null,
                founded_year: values.founded_year === "" ? null : Number(values.founded_year),
                segment: values.segment || null,
                specialization: values.specialization || null,
                website: values.website || null
              }
            : { name: values.name, country: values.name }
        });
        setDialog(null);
      }
    });
  };

  const renderMetadata = (node: ManufacturerNode) => {
    if (!node.parent_id) {
      return null;
    }
    const details = [
      node.flag ? `${t("common.fields.flag")}: ${node.flag}` : null,
      node.founded_year ? `${t("common.fields.foundedYear")}: ${node.founded_year}` : null,
      node.segment ? `${t("common.fields.segment")}: ${node.segment}` : null,
      node.specialization ? `${t("common.fields.specialization")}: ${node.specialization}` : null,
      node.website ? `${t("common.fields.website")}: ${node.website}` : null
    ].filter(Boolean);
    if (details.length === 0) {
      return null;
    }
    return (
      <Box sx={{ display: "grid", gap: 0.25 }}>
        {details.map((line) => (
          <Typography key={line} variant="body2" color="text.secondary">
            {line}
          </Typography>
        ))}
      </Box>
    );
  };

  const renderNode = (entry: LiveTreeAnnotation<ManufacturerNode>, level: number) => {
    const node = entry.item;
    const hasChildren = entry.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const forceExpand = entry.shouldForceExpand;

    return (
      <Box key={node.id} sx={{ display: "grid", gap: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", pl: level * 2, gap: 1 }}>
          {hasChildren ? (
            <IconButton size="small" onClick={() => toggleExpanded(node.id)} sx={{ mt: 0.25 }}>
              {expanded || forceExpand ? <ExpandMoreRoundedIcon /> : <ChevronRightRoundedIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 32 }} />
          )}
          <Box sx={{ display: "grid", gap: 0.25, opacity: entry.isDimmed ? LIVE_FILTER_DIM_OPACITY : 1 }}>
            <Typography sx={{ fontWeight: 500 }}>
              {node.name}
              {node.is_deleted ? t("common.deletedSuffix") : ""}
            </Typography>
            {node.parent_id ? (
              <Typography variant="body2" color="text.secondary">
                {node.country}
              </Typography>
            ) : null}
            {renderMetadata(node)}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {canWrite && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {!node.parent_id ? (
                <AppButton size="small" onClick={() => openCreateBrandDialog(node)}>
                  {t("pagesUi.manufacturers.actions.addChild")}
                </AppButton>
              ) : null}
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
      <Typography variant="h4">{t("pagesUi.manufacturers.title")}</Typography>
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
              <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateCountryDialog}>
                {t("pagesUi.manufacturers.actions.addRoot")}
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
