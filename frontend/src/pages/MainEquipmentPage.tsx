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
import { EntityImportExportIconActions } from "../components/EntityImportExportIconActions";
import { createEntity, deleteEntity, updateEntity, restoreEntity, Pagination } from "../api/entities";
import { deleteMainEquipmentPidSymbol, uploadMainEquipmentPidSymbol } from "../api/mainEquipment";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { AppButton } from "../components/ui/AppButton";
import { buildMainEquipmentLookups } from "../utils/mainEquipment";
import { MAIN_EQUIPMENT_SHAPE_OPTIONS, inferMainEquipmentShapeKey } from "../constants/pidPalette";
import { EquipmentGlyph } from "../components/pid/nodes/EquipmentGlyph";
import { resolveMainEquipmentLibraryKey } from "../features/pid/mainEquipmentObjectSymbols";
import { mergePidSymbolIntoMetaData, normalizePidSymbol } from "../features/pid/symbols";
import type { PidSymbol } from "../types/pid";
import { annotateLiveTree, type LiveTreeAnnotation } from "../utils/liveFilter";

type MainEquipment = {
  id: number;
  name: string;
  parent_id?: number | null;
  level: number;
  code: string;
  meta_data?: Record<string, unknown> | null;
  is_deleted: boolean;
};

type MainEquipmentNode = MainEquipment & { children: MainEquipmentNode[] };
const MAIN_EQUIPMENT_LIBRARY_STANDARD: PidSymbol["standard"] = "ISO-14617";

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

function getPidSymbol(item: MainEquipment | null | undefined): PidSymbol {
  return normalizePidSymbol(
    item?.meta_data,
    resolveMainEquipmentLibraryKey({
      id: item?.id,
      code: item?.code,
      libraryKey:
        typeof item?.meta_data?.shapeKey === "string"
          ? item.meta_data.shapeKey
          : typeof (item?.meta_data?.pidSymbol as { libraryKey?: unknown } | undefined)?.libraryKey === "string"
            ? ((item?.meta_data?.pidSymbol as { libraryKey?: string }).libraryKey ?? null)
            : null,
    }) || inferMainEquipmentShapeKey(item?.name || "")
  );
}

export default function MainEquipmentPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "dictionaries", "write");
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [symbolUploadFile, setSymbolUploadFile] = useState<File | null>(null);
  const [symbolUploadPreviewUrl, setSymbolUploadPreviewUrl] = useState<string | null>(null);
  const [removeUploadedSymbol, setRemoveUploadedSymbol] = useState(false);

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

  useEffect(() => {
    if (!symbolUploadFile) {
      setSymbolUploadPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(symbolUploadFile);
    setSymbolUploadPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [symbolUploadFile]);

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
  const itemMap = useMemo(() => {
    const map = new Map<number, MainEquipment>();
    (itemsQuery.data || []).forEach((item) => map.set(item.id, item));
    return map;
  }, [itemsQuery.data]);

  const lookups = useMemo(() => buildMainEquipmentLookups(tree), [tree]);
  const shapeOptions = useMemo(
    () => MAIN_EQUIPMENT_SHAPE_OPTIONS.map((item) => ({ value: item.key, label: t(item.labelKey) })),
    [t]
  );

  const closeDialog = () => {
    setDialog(null);
    setSymbolUploadFile(null);
    setSymbolUploadPreviewUrl(null);
    setRemoveUploadedSymbol(false);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["main-equipment-tree"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; parent_id?: number | null; meta_data?: Record<string, unknown> | null }) =>
      createEntity<MainEquipment>("/main-equipment", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.mainEquipment.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<MainEquipment> }) =>
      updateEntity<MainEquipment>("/main-equipment", id, payload),
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
    setSymbolUploadFile(null);
    setSymbolUploadPreviewUrl(null);
    setRemoveUploadedSymbol(false);
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
        },
        {
          name: "shape_key",
          label: t("pagesUi.mainEquipment.fields.shapeKey"),
          type: "select",
          options: shapeOptions,
        },
      ],
      values: { name: "", parent_id: parentId ?? "", shape_key: "generic" },
      renderExtra: (values) =>
        values.shape_key ? (
          <Box sx={{ display: "grid", gap: 1.25 }}>
            <Box sx={{ display: "grid", justifyItems: "center", gap: 0.5 }}>
              <EquipmentGlyph
                shapeKey={String(values.shape_key)}
                symbol={
                  symbolUploadPreviewUrl
                    ? {
                        source: "upload",
                        libraryKey: String(values.shape_key),
                        assetUrl: symbolUploadPreviewUrl,
                        standard: MAIN_EQUIPMENT_LIBRARY_STANDARD,
                      }
                    : {
                        source: "library",
                        libraryKey: String(values.shape_key),
                        standard: MAIN_EQUIPMENT_LIBRARY_STANDARD,
                      }
                }
              />
              <Typography variant="caption" color="text.secondary">
                {t("pagesUi.mainEquipment.labels.preview")}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1 }}>
              <AppButton component="label" size="small">
                {t("actions.upload")}
                <input
                  hidden
                  accept=".svg,image/svg+xml"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSymbolUploadFile(file);
                    setRemoveUploadedSymbol(false);
                    event.target.value = "";
                  }}
                />
              </AppButton>
              {symbolUploadFile ? (
                <AppButton size="small" color="inherit" onClick={() => setSymbolUploadFile(null)}>
                  {t("actions.deleteFile")}
                </AppButton>
              ) : null}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              {symbolUploadFile ? symbolUploadFile.name : t("pagesUi.mainEquipment.labels.librarySymbol")}
            </Typography>
          </Box>
        ) : null,
      onSave: async (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        const created = await createMutation.mutateAsync({
          name: values.name,
          parent_id: parentValue,
          meta_data: mergePidSymbolIntoMetaData(null, {
            source: "library",
            libraryKey: String(values.shape_key || "generic"),
            standard: MAIN_EQUIPMENT_LIBRARY_STANDARD,
          }),
        });
        if (symbolUploadFile) {
          await uploadMainEquipmentPidSymbol(created.id, symbolUploadFile);
          refresh();
        }
      }
    });
  };

  const openEditDialog = (node: MainEquipmentNode) => {
    const disallowedIds = collectDescendantIds(node);
    disallowedIds.add(node.id);
    const isLeaf = node.children.length === 0;
    const initialSymbol = getPidSymbol(node);
    const initialShapeKey = initialSymbol.libraryKey || inferMainEquipmentShapeKey(node.name);

    setSymbolUploadFile(null);
    setSymbolUploadPreviewUrl(null);
    setRemoveUploadedSymbol(false);

    const fields: DialogState["fields"] = [
      { name: "name", label: t("common.fields.name"), type: "text" },
      {
        name: "parent_id",
        label: t("common.fields.parent"),
        type: "select",
        options: lookups.options.filter((option) => !disallowedIds.has(Number(option.value)))
      },
    ];
    if (isLeaf) {
      fields.push({
        name: "shape_key",
        label: t("pagesUi.mainEquipment.fields.shapeKey"),
        type: "select",
        options: shapeOptions,
      });
    }

    setDialog({
      open: true,
      title: t("pagesUi.mainEquipment.dialogs.editTitle"),
      fields,
      values: { name: node.name, parent_id: node.parent_id ?? "", shape_key: initialShapeKey },
      renderExtra: (values) =>
        isLeaf && values.shape_key ? (
          <Box sx={{ display: "grid", gap: 1.25 }}>
            <Box sx={{ display: "grid", justifyItems: "center", gap: 0.5 }}>
              <EquipmentGlyph
                shapeKey={String(values.shape_key)}
                symbol={
                  symbolUploadPreviewUrl
                    ? {
                        source: "upload",
                        libraryKey: String(values.shape_key),
                        assetUrl: symbolUploadPreviewUrl,
                        standard: MAIN_EQUIPMENT_LIBRARY_STANDARD,
                      }
                    : removeUploadedSymbol
                      ? {
                          source: "library",
                          libraryKey: String(values.shape_key),
                          standard: MAIN_EQUIPMENT_LIBRARY_STANDARD,
                        }
                      : {
                          ...initialSymbol,
                          libraryKey: String(values.shape_key),
                          standard: MAIN_EQUIPMENT_LIBRARY_STANDARD,
                        }
                }
              />
              <Typography variant="caption" color="text.secondary">
                {t("pagesUi.mainEquipment.labels.preview")}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1 }}>
              <AppButton component="label" size="small">
                {t("actions.upload")}
                <input
                  hidden
                  accept=".svg,image/svg+xml"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSymbolUploadFile(file);
                    setRemoveUploadedSymbol(false);
                    event.target.value = "";
                  }}
                />
              </AppButton>
              {initialSymbol.source === "upload" && !symbolUploadFile ? (
                <AppButton
                  size="small"
                  color={removeUploadedSymbol ? "success" : "inherit"}
                  onClick={() => setRemoveUploadedSymbol((current) => !current)}
                >
                  {removeUploadedSymbol
                    ? t("actions.restore")
                    : t("pagesUi.mainEquipment.actions.removeUploadedSymbol")}
                </AppButton>
              ) : null}
              {symbolUploadFile ? (
                <AppButton size="small" color="inherit" onClick={() => setSymbolUploadFile(null)}>
                  {t("actions.deleteFile")}
                </AppButton>
              ) : null}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              {symbolUploadFile
                ? symbolUploadFile.name
                : initialSymbol.source === "upload" && !removeUploadedSymbol
                  ? t("pagesUi.mainEquipment.labels.uploadedSymbol")
                  : t("pagesUi.mainEquipment.labels.librarySymbol")}
            </Typography>
          </Box>
        ) : null,
      onSave: async (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        const payload: Partial<MainEquipment> = {
          name: values.name,
          parent_id: parentValue,
        };
        if (isLeaf) {
          payload.meta_data = mergePidSymbolIntoMetaData(node.meta_data, {
            source:
              initialSymbol.source === "upload" && !removeUploadedSymbol && !symbolUploadFile ? "upload" : "library",
            libraryKey: String(values.shape_key || "generic"),
            assetUrl:
              initialSymbol.source === "upload" && !removeUploadedSymbol && !symbolUploadFile
                ? initialSymbol.assetUrl
                : undefined,
            standard: MAIN_EQUIPMENT_LIBRARY_STANDARD,
          });
        }
        const updated = await updateMutation.mutateAsync({
          id: node.id,
          payload
        });
        if (isLeaf && removeUploadedSymbol && initialSymbol.source === "upload" && !symbolUploadFile) {
          await deleteMainEquipmentPidSymbol(updated.id);
          refresh();
        }
        if (isLeaf && symbolUploadFile) {
          await uploadMainEquipmentPidSymbol(updated.id, symbolUploadFile);
          refresh();
        }
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

  const renderNode = (entry: LiveTreeAnnotation<MainEquipmentNode>, depth: number) => {
    const node = entry.item;
    const hasChildren = entry.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const forceExpand = entry.shouldForceExpand;
    const breadcrumb = buildBreadcrumb(node.id);
    const pidSymbol = getPidSymbol(node);

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
          {!hasChildren ? (
            <Box sx={{ width: 42, display: "grid", justifyItems: "center" }}>
              <EquipmentGlyph shapeKey={pidSymbol.libraryKey} symbol={pidSymbol} width={42} height={28} />
            </Box>
          ) : null}
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
              {entry.children.map((child) => renderNode(child, depth + 1))}
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
            <EntityImportExportIconActions
              basePath="/main-equipment"
              filenamePrefix="main-equipment"
              exportParams={{ include_deleted: showDeleted || undefined, q: q || undefined }}
              canWrite={canWrite}
              onCommitted={refresh}
            />
            {canWrite && (
              <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreateDialog(null)}>
                {t("pagesUi.mainEquipment.actions.addRoot")}
              </AppButton>
            )}
          </Box>

          <Box sx={{ display: "grid", gap: 1 }}>{treeAnnotations.map((node) => renderNode(node, 0))}</Box>
        </CardContent>
      </Card>

      {dialog && <EntityDialog state={dialog} onClose={closeDialog} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}

