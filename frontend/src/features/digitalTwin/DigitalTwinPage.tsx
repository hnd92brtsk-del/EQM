import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Alert, Box, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, MenuItem, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addEdge, applyNodeChanges, Background, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  type Connection, type Edge, type Node, type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router-dom";

import {
  type DigitalTwinDocument, type DigitalTwinItem, type DigitalTwinPowerEdge, type DigitalTwinRecord,
  type DigitalTwinScope, type TwinPlacementMode, ensureDigitalTwin, syncDigitalTwinFromOperation, updateDigitalTwin,
} from "../../api/digitalTwins";
import { type IOSignal, listIOSignals } from "../../api/ioSignals";
import { ErrorSnackbar } from "../../components/ErrorSnackbar";
import { AppButton } from "../../components/ui/AppButton";
import { useAuth } from "../../context/AuthContext";
import {
  buildIoSummary, buildLoadSummary, buildManualItem, buildNetworkSummary, buildValidation,
  cloneDocument, createManualDraft, itemDisplayName, type ManualItemDraft, wallColors,
} from "./utils";

type PlacementTarget = { placement_mode: TwinPlacementMode; wall_id: string | null; rail_id: string | null };
type ItemEditorDraft = ManualItemDraft & { user_label: string };
type ChannelUsageSummary = {
  total: number; used: number; free: number;
  aiTotal: number; diTotal: number; aoTotal: number; doTotal: number;
  aiUsed: number; diUsed: number; aoUsed: number; doUsed: number;
  hasLiveData: boolean;
};

const currentTypeOptions = [
  { value: "dc", labelKey: "pagesUi.digitalTwin.enums.currentType.dc" },
  { value: "ac", labelKey: "pagesUi.digitalTwin.enums.currentType.ac" },
  { value: "other", labelKey: "pagesUi.digitalTwin.enums.currentType.other" },
];
const mountTypeOptions = [
  { value: "din-rail", labelKey: "pagesUi.digitalTwin.enums.mountType.dinRail" },
  { value: "wall", labelKey: "pagesUi.digitalTwin.enums.mountType.wall" },
  { value: "other", labelKey: "pagesUi.digitalTwin.enums.mountType.other" },
];
const powerRoleOptions = [
  { value: "consumer", labelKey: "pagesUi.digitalTwin.enums.powerRole.consumer" },
  { value: "source", labelKey: "pagesUi.digitalTwin.enums.powerRole.source" },
  { value: "converter", labelKey: "pagesUi.digitalTwin.enums.powerRole.converter" },
  { value: "passive", labelKey: "pagesUi.digitalTwin.enums.powerRole.passive" },
];

const getPlacement = (item: DigitalTwinItem): PlacementTarget => ({
  placement_mode: item.placement_mode,
  wall_id: item.wall_id ?? null,
  rail_id: item.rail_id ?? null,
});

const samePlacement = (left: PlacementTarget, right: PlacementTarget) =>
  left.placement_mode === right.placement_mode && left.wall_id === right.wall_id && left.rail_id === right.rail_id;

function resequenceGroup(items: DigitalTwinItem[]) {
  items.sort((a, b) => a.sort_order - b.sort_order).forEach((item, index) => { item.sort_order = index; });
}

function moveItemWithinDocument(current: DigitalTwinDocument, draggedItemId: string, target: PlacementTarget, beforeItemId?: string | null) {
  const draggedItem = current.items.find((item) => item.id === draggedItemId);
  if (!draggedItem || beforeItemId === draggedItemId) return current;

  const sourcePlacement = getPlacement(draggedItem);
  if (!samePlacement(sourcePlacement, target)) {
    resequenceGroup(current.items.filter((item) => item.id !== draggedItemId && samePlacement(getPlacement(item), sourcePlacement)));
  }

  draggedItem.placement_mode = target.placement_mode;
  draggedItem.wall_id = target.wall_id;
  draggedItem.rail_id = target.rail_id;

  const targetGroup = current.items
    .filter((item) => item.id !== draggedItemId && samePlacement(getPlacement(item), target))
    .sort((a, b) => a.sort_order - b.sort_order);
  const insertIndex = beforeItemId ? Math.max(targetGroup.findIndex((item) => item.id === beforeItemId), 0) : targetGroup.length;
  targetGroup.splice(insertIndex, 0, draggedItem);
  targetGroup.forEach((item, index) => { item.sort_order = index; });
  current.ui.selected_item_id = draggedItemId;
  return current;
}

function removeItemCompletely(current: DigitalTwinDocument, itemId: string) {
  current.items = current.items.filter((item) => item.id !== itemId);
  const nodeIds = current.powerGraph.nodes.filter((node) => node.item_id === itemId).map((node) => node.id);
  current.powerGraph.nodes = current.powerGraph.nodes.filter((node) => node.item_id !== itemId);
  current.powerGraph.edges = current.powerGraph.edges.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target));
  if (current.ui.selected_item_id === itemId) current.ui.selected_item_id = null;
  return current;
}

function createItemEditorDraft(item: DigitalTwinItem): ItemEditorDraft {
  return {
    name: item.name,
    user_label: item.user_label || "",
    mount_type: item.mount_type || "din-rail",
    mount_width_mm: item.mount_width_mm != null ? String(item.mount_width_mm) : "",
    current_type: item.current_type || "dc",
    supply_voltage: item.supply_voltage || "",
    current_consumption_a: item.current_consumption_a != null ? String(item.current_consumption_a) : "",
    power_role: item.power_role || "consumer",
    output_voltage: item.output_voltage || "",
    max_output_current_a: item.max_output_current_a != null ? String(item.max_output_current_a) : "",
    ai_count: String(item.ai_count || 0),
    di_count: String(item.di_count || 0),
    ao_count: String(item.ao_count || 0),
    do_count: String(item.do_count || 0),
    network_port_count: String(item.network_ports.reduce((sum, port) => sum + (port.count || 0), 0)),
  };
}

function applyItemEditorDraft(item: DigitalTwinItem, draft: ItemEditorDraft) {
  if (item.item_kind === "manual" && draft.name.trim()) item.name = draft.name.trim();
  item.user_label = draft.user_label.trim() || null;
  item.mount_type = draft.mount_type;
  item.mount_width_mm = draft.mount_width_mm ? Number(draft.mount_width_mm) : null;
  item.current_type = draft.current_type || null;
  item.supply_voltage = draft.supply_voltage.trim() || null;
  item.current_consumption_a = draft.current_consumption_a ? Number(draft.current_consumption_a) : null;
  item.power_role = draft.power_role;
  item.output_voltage = draft.output_voltage.trim() || null;
  item.max_output_current_a = draft.max_output_current_a ? Number(draft.max_output_current_a) : null;
  item.ai_count = Number(draft.ai_count || 0);
  item.di_count = Number(draft.di_count || 0);
  item.ao_count = Number(draft.ao_count || 0);
  item.do_count = Number(draft.do_count || 0);
  item.channel_count = item.ai_count + item.di_count + item.ao_count + item.do_count;
  item.is_channel_forming = item.channel_count > 0;
  const networkPortCount = Number(draft.network_port_count || 0);
  item.is_network = networkPortCount > 0;
  item.network_ports = networkPortCount > 0 ? [{ type: "RJ-45 (8p8c)", count: networkPortCount }] : [];
}

const countSignalsByType = (signals: IOSignal[]) =>
  signals.reduce((acc, signal) => {
    if (signal.signal_type === "AI") acc.ai += 1;
    if (signal.signal_type === "DI") acc.di += 1;
    if (signal.signal_type === "AO") acc.ao += 1;
    if (signal.signal_type === "DO") acc.do += 1;
    return acc;
  }, { ai: 0, di: 0, ao: 0, do: 0 });

function buildChannelUsage(item: DigitalTwinItem, signals?: IOSignal[]): ChannelUsageSummary {
  const aiTotal = item.ai_count || 0;
  const diTotal = item.di_count || 0;
  const aoTotal = item.ao_count || 0;
  const doTotal = item.do_count || 0;
  const total = aiTotal + diTotal + aoTotal + doTotal || item.channel_count || 0;
  const counts = signals ? countSignalsByType(signals) : { ai: 0, di: 0, ao: 0, do: 0 };
  const used = signals ? counts.ai + counts.di + counts.ao + counts.do : 0;
  return {
    total, used, free: Math.max(total - used, 0),
    aiTotal, diTotal, aoTotal, doTotal,
    aiUsed: counts.ai, diUsed: counts.di, aoUsed: counts.ao, doUsed: counts.do,
    hasLiveData: Boolean(signals),
  };
}

function TwinCard({
  item, selected, usage, moveToStockLabel, editLabel, deleteLabel, stockLabel, outOfOperationLabel,
  noPowerLabel, onSelect, onEdit, onDelete, onMoveToStock, onDropBefore, renderCurrentType, renderChannelSummary,
}: {
  item: DigitalTwinItem; selected: boolean; usage?: ChannelUsageSummary;
  moveToStockLabel: string; editLabel: string; deleteLabel: string; stockLabel: string;
  outOfOperationLabel: string; noPowerLabel: string;
  onSelect: () => void; onEdit: () => void; onDelete?: () => void; onMoveToStock?: () => void;
  onDropBefore?: (draggedItemId: string, targetItemId: string) => void;
  renderCurrentType: (value?: string | null) => string;
  renderChannelSummary: (summary: ChannelUsageSummary, item: DigitalTwinItem) => string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const powerLine = item.supply_voltage ? [item.supply_voltage, renderCurrentType(item.current_type)].filter(Boolean).join(" • ") : noPowerLabel;
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const draggedItemId = event.dataTransfer.getData("text/plain");
    if (draggedItemId && draggedItemId !== item.id) onDropBefore?.(draggedItemId, item.id);
  };

  return (
    <Card
      draggable
      onClick={onSelect}
      onDragStart={(event) => { event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      sx={{
        width: { xs: "100%", sm: 220 }, border: "1px solid",
        borderColor: dragOver ? "primary.main" : selected ? "text.primary" : "divider",
        boxShadow: dragOver ? "0 0 0 3px rgba(47,111,237,0.12)" : "none", borderRadius: 3, cursor: "grab",
      }}
    >
      <CardContent sx={{ p: 1.25, display: "grid", gap: 1, "&:last-child": { pb: 1.25 } }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ lineHeight: 1.2, wordBreak: "break-word" }}>{itemDisplayName(item)}</Typography>
            {item.user_label ? <Typography variant="caption" color="text.secondary">{item.name}</Typography> : null}
          </Box>
          <Stack direction="row" spacing={0.25}>
            {item.placement_mode !== "unplaced" ? (
              <Tooltip title={moveToStockLabel}><IconButton size="small" onClick={(event) => { event.stopPropagation(); onMoveToStock?.(); }}><Inventory2OutlinedIcon fontSize="small" /></IconButton></Tooltip>
            ) : <Chip size="small" variant="outlined" label={stockLabel} />}
            <Tooltip title={editLabel}><IconButton size="small" onClick={(event) => { event.stopPropagation(); onEdit(); }}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
            {onDelete ? <Tooltip title={deleteLabel}><IconButton size="small" color="error" onClick={(event) => { event.stopPropagation(); onDelete(); }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip> : null}
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary">{powerLine}</Typography>
        {item.source_status === "out_of_operation" ? <Chip size="small" color="warning" variant="outlined" label={outOfOperationLabel} sx={{ justifySelf: "start" }} /> : null}
        {item.is_channel_forming && usage && usage.total > 0 ? (
          <Box sx={{ display: "grid", gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">{renderChannelSummary(usage, item)}</Typography>
            <LinearProgress variant="determinate" value={usage.total ? (usage.used / usage.total) * 100 : 0} sx={{ height: 8, borderRadius: 999 }} />
            <Typography variant="caption" color="text.secondary">
              {usage.hasLiveData
                ? `AI ${usage.aiUsed}/${usage.aiTotal} • DI ${usage.diUsed}/${usage.diTotal} • AO ${usage.aoUsed}/${usage.aoTotal} • DO ${usage.doUsed}/${usage.doTotal}`
                : `AI ${usage.aiTotal} • DI ${usage.diTotal} • AO ${usage.aoTotal} • DO ${usage.doTotal}`}
            </Typography>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DropArea({ title, hint, onDropItem, children }: { title: string; hint?: string; onDropItem: (itemId: string) => void; children: ReactNode }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <Box
      onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => { event.preventDefault(); setDragOver(false); const itemId = event.dataTransfer.getData("text/plain"); if (itemId) onDropItem(itemId); }}
      sx={{ border: "1px dashed", borderColor: dragOver ? "primary.main" : "divider", bgcolor: dragOver ? "rgba(47,111,237,0.04)" : "transparent", borderRadius: 4, p: 1.5, display: "grid", gap: 1.25, minHeight: 120 }}
    >
      <Box>
        <Typography variant="subtitle2">{title}</Typography>
        {hint ? <Typography variant="caption" color="text.secondary">{hint}</Typography> : null}
      </Box>
      {children}
    </Box>
  );
}

export function DigitalTwinPage() {
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const scope: DigitalTwinScope = location.pathname.startsWith("/assemblies/") ? "assembly" : "cabinet";
  const sourceId = Number(id || 0);

  const [record, setRecord] = useState<DigitalTwinRecord | null>(null);
  const [document, setDocument] = useState<DigitalTwinDocument | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualItemDraft>(createManualDraft());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ItemEditorDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedSignatureRef = useRef("");

  const twinQuery = useQuery({
    queryKey: ["digital-twin-ensure", scope, sourceId],
    queryFn: () => ensureDigitalTwin(scope, sourceId),
    enabled: sourceId > 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!twinQuery.data) return;
    lastSavedSignatureRef.current = JSON.stringify(twinQuery.data.document);
    setRecord(twinQuery.data);
    setDocument(twinQuery.data.document);
    setSaveState("idle");
  }, [twinQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { twinId: number; document: DigitalTwinDocument }) => updateDigitalTwin(payload.twinId, { document: payload.document }),
    onSuccess: (data) => {
      lastSavedSignatureRef.current = JSON.stringify(data.document);
      setRecord(data);
      setDocument(data.document);
      setSaveState("saved");
      queryClient.setQueryData(["digital-twin-ensure", scope, sourceId], data);
    },
    onError: (error) => {
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.digitalTwin.errors.save"));
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncDigitalTwinFromOperation(scope, sourceId),
    onSuccess: (data) => {
      lastSavedSignatureRef.current = JSON.stringify(data.document);
      setRecord(data);
      setDocument(data.document);
      setSaveState("saved");
      queryClient.setQueryData(["digital-twin-ensure", scope, sourceId], data);
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.digitalTwin.errors.sync")),
  });

  useEffect(() => {
    if (!document || !record?.id || !canWrite) return;
    const signature = JSON.stringify(document);
    if (signature === lastSavedSignatureRef.current) return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      saveMutation.mutate({ twinId: record.id, document });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [canWrite, document, record?.id, saveMutation]);

  const updateDocument = (updater: (current: DigitalTwinDocument) => DigitalTwinDocument) => {
    setDocument((current) => (current ? updater(cloneDocument(current)) : current));
  };

  const activeWallId = document?.ui.active_wall_id || document?.walls[0]?.id || "back";
  const rails = (document?.rails || []).filter((rail) => rail.wall_id === activeWallId).sort((a, b) => a.sort_order - b.sort_order);
  const selectedItem = document?.items.find((item) => item.id === document.ui.selected_item_id) || null;
  const editingItem = document?.items.find((item) => item.id === editingItemId) || null;
  const selectedEdge = document?.powerGraph.edges.find((edge) => edge.id === selectedEdgeId) || null;
  const validationIssues = useMemo(() => (document ? buildValidation(document) : []), [document]);
  const loadSummary = useMemo(() => (document ? buildLoadSummary(document) : {}), [document]);
  const ioSummary = useMemo(() => (document ? buildIoSummary(document) : { ai: 0, di: 0, ao: 0, do: 0 }), [document]);
  const networkSummary = useMemo(() => (document ? buildNetworkSummary(document) : { rows: [], total: 0 }), [document]);

  const signalQueryItems = useMemo(
    () => (document?.items || []).filter((item) => item.is_channel_forming && item.equipment_item_source === "cabinet" && Boolean(item.equipment_item_id)),
    [document?.items],
  );
  const signalQueries = useQueries({
    queries: signalQueryItems.map((item) => ({
      queryKey: ["digital-twin-io-signals", item.equipment_item_id],
      queryFn: () => listIOSignals(item.equipment_item_id!),
      staleTime: 60_000,
      enabled: Boolean(item.equipment_item_id),
    })),
  });

  const usageByItemId = useMemo(() => {
    const map = new Map<string, ChannelUsageSummary>();
    for (const item of document?.items || []) map.set(item.id, buildChannelUsage(item));
    signalQueryItems.forEach((item, index) => { if (signalQueries[index]?.data) map.set(item.id, buildChannelUsage(item, signalQueries[index].data)); });
    return map;
  }, [document?.items, signalQueries, signalQueryItems]);

  const flowNodes = useMemo<Node[]>(() => (document?.powerGraph.nodes || []).map((node) => ({
    id: node.id,
    position: { x: node.x, y: node.y },
    data: { label: node.label },
    style: { width: 160, borderRadius: 14, border: "1px solid #cbd5e1", padding: 10 },
  })), [document?.powerGraph.nodes]);

  const flowEdges = useMemo<Edge[]>(() => (document?.powerGraph.edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label || edge.voltage || "",
    style: { stroke: selectedEdgeId === edge.id ? "#111827" : "#64748b", strokeWidth: selectedEdgeId === edge.id ? 2.4 : 1.8 },
  })), [document?.powerGraph.edges, selectedEdgeId]);

  const formatCurrentType = (value?: string | null) => {
    const normalized = (value || "").trim().toLowerCase();
    const option = currentTypeOptions.find((entry) => entry.value === normalized);
    return option ? t(option.labelKey) : value || "";
  };

  if (twinQuery.isLoading || !record || !document) return <Typography>{t("pagesUi.digitalTwin.states.loading")}</Typography>;

  const wallStyle = wallColors[activeWallId] || wallColors.back;
  const unplacedItems = document.items.filter((item) => item.placement_mode === "unplaced").sort((a, b) => a.sort_order - b.sort_order);
  const wallItems = document.items.filter((item) => item.placement_mode === "wall" && item.wall_id === activeWallId).sort((a, b) => a.sort_order - b.sort_order);
  const moveItemToTarget = (draggedItemId: string, target: PlacementTarget, beforeItemId?: string | null) => updateDocument((current) => moveItemWithinDocument(current, draggedItemId, target, beforeItemId));
  const openEditor = (item: DigitalTwinItem) => { setEditingItemId(item.id); setEditDraft(createItemEditorDraft(item)); };
  const renderChannelSummary = (summary: ChannelUsageSummary, item: DigitalTwinItem) =>
    summary.hasLiveData || item.item_kind === "manual"
      ? t("pagesUi.digitalTwin.cards.channelUsage", { used: summary.used, free: summary.free, total: summary.total })
      : t("pagesUi.digitalTwin.cards.channelCapacity", { total: summary.total });

  return (
    <ReactFlowProvider>
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {t(scope === "assembly" ? "pagesUi.digitalTwin.titleAssembly" : "pagesUi.digitalTwin.titleCabinet")}
              {record.source_context?.name ? ` - ${String(record.source_context.name)}` : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">{t("pagesUi.digitalTwin.subtitle")}</Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ "& > *": { minHeight: 40 } }}>
            <Chip
              icon={<SaveRoundedIcon />}
              label={saveState === "saving" ? t("pagesUi.digitalTwin.states.saving") : saveState === "saved" ? t("pagesUi.digitalTwin.states.saved") : saveState === "error" ? t("pagesUi.digitalTwin.states.error") : t("pagesUi.digitalTwin.states.draft")}
              color={saveState === "saved" ? "success" : saveState === "error" ? "warning" : "default"}
            />
            <AppButton variant="outlined" startIcon={<AutorenewRoundedIcon />} onClick={() => syncMutation.mutate()} disabled={!canWrite || syncMutation.isPending}>{t("pagesUi.digitalTwin.actions.sync")}</AppButton>
            <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={() => updateDocument((current) => { current.rails.push({ id: `rail-${Date.now()}`, wall_id: activeWallId, name: t("pagesUi.digitalTwin.rails.defaultName", { index: rails.length + 1 }), length_mm: 600, sort_order: rails.length }); return current; })} disabled={!canWrite}>{t("pagesUi.digitalTwin.actions.addRail")}</AppButton>
          </Stack>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "320px minmax(0, 1fr) 340px" }, gap: 2 }}>
          <Card><CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">{t("pagesUi.digitalTwin.sections.domainModel")}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
              {document.walls.map((wall) => (
                <AppButton key={wall.id} variant={wall.id === activeWallId ? "contained" : "outlined"} size="small" onClick={() => updateDocument((current) => { current.ui.active_wall_id = wall.id; return current; })}>{wall.name}</AppButton>
              ))}
            </Box>
            <AppButton fullWidth variant="outlined" onClick={() => { setManualDraft(createManualDraft()); setManualDialogOpen(true); }} disabled={!canWrite}>{t("pagesUi.digitalTwin.actions.addManual")}</AppButton>
            <DropArea title={t("pagesUi.digitalTwin.unplaced.title")} hint={t("pagesUi.digitalTwin.unplaced.hint")} onDropItem={(itemId) => moveItemToTarget(itemId, { placement_mode: "unplaced", wall_id: null, rail_id: null })}>
              {unplacedItems.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {unplacedItems.map((item) => (
                  <TwinCard
                    key={item.id}
                    item={item}
                    selected={selectedItem?.id === item.id}
                    usage={usageByItemId.get(item.id)}
                    moveToStockLabel={t("pagesUi.digitalTwin.cards.moveToStock")}
                    editLabel={t("pagesUi.digitalTwin.cards.edit")}
                    deleteLabel={t("pagesUi.digitalTwin.cards.delete")}
                    stockLabel={t("pagesUi.digitalTwin.cards.inStock")}
                    outOfOperationLabel={t("pagesUi.digitalTwin.cards.outOfOperation")}
                    noPowerLabel={t("pagesUi.digitalTwin.cards.noPower")}
                    onSelect={() => updateDocument((current) => { current.ui.selected_item_id = item.id; return current; })}
                    onEdit={() => openEditor(item)}
                    onDelete={item.item_kind === "manual" ? () => updateDocument((current) => removeItemCompletely(current, item.id)) : undefined}
                    renderCurrentType={formatCurrentType}
                    renderChannelSummary={renderChannelSummary}
                  />
                ))}
              </Box> : <Typography variant="body2" color="text.secondary">{t("pagesUi.digitalTwin.unplaced.empty")}</Typography>}
            </DropArea>
          </CardContent></Card>

          <Card><CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">{t("pagesUi.digitalTwin.sections.mountArea")}</Typography>
            <Box sx={{ border: "1px solid", borderColor: wallStyle.border, bgcolor: wallStyle.bg, borderRadius: 4, p: 2, display: "grid", gap: 2 }}>
              {rails.map((rail) => {
                const items = document.items.filter((item) => item.placement_mode === "rail" && item.rail_id === rail.id).sort((a, b) => a.sort_order - b.sort_order);
                const occupied = items.reduce((sum, item) => sum + ((item.mount_width_mm || 0) * Math.max(item.quantity || 1, 1)), 0);
                return (
                  <DropArea
                    key={rail.id}
                    title={rail.name}
                    hint={t("pagesUi.digitalTwin.rails.hint", { length: rail.length_mm, occupied, free: Math.max(rail.length_mm - occupied, 0) })}
                    onDropItem={(itemId) => moveItemToTarget(itemId, { placement_mode: "rail", wall_id: rail.wall_id, rail_id: rail.id })}
                  >
                    <Box sx={{ height: 8, borderRadius: 99, bgcolor: "rgba(15,23,42,0.10)", overflow: "hidden" }}>
                      <Box sx={{ width: `${Math.min(occupied / rail.length_mm, 1) * 100}%`, height: "100%", bgcolor: "#111827" }} />
                    </Box>
                    {items.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {items.map((item) => (
                        <TwinCard
                          key={item.id}
                          item={item}
                          selected={selectedItem?.id === item.id}
                          usage={usageByItemId.get(item.id)}
                          moveToStockLabel={t("pagesUi.digitalTwin.cards.moveToStock")}
                          editLabel={t("pagesUi.digitalTwin.cards.edit")}
                          deleteLabel={t("pagesUi.digitalTwin.cards.delete")}
                          stockLabel={t("pagesUi.digitalTwin.cards.inStock")}
                          outOfOperationLabel={t("pagesUi.digitalTwin.cards.outOfOperation")}
                          noPowerLabel={t("pagesUi.digitalTwin.cards.noPower")}
                          onSelect={() => updateDocument((current) => { current.ui.selected_item_id = item.id; return current; })}
                          onEdit={() => openEditor(item)}
                          onMoveToStock={() => moveItemToTarget(item.id, { placement_mode: "unplaced", wall_id: null, rail_id: null })}
                          onDelete={item.item_kind === "manual" ? () => updateDocument((current) => removeItemCompletely(current, item.id)) : undefined}
                          onDropBefore={(draggedItemId, targetItemId) => moveItemToTarget(draggedItemId, { placement_mode: "rail", wall_id: rail.wall_id, rail_id: rail.id }, targetItemId)}
                          renderCurrentType={formatCurrentType}
                          renderChannelSummary={renderChannelSummary}
                        />
                      ))}
                    </Box> : <Typography variant="body2" color="text.secondary">{t("pagesUi.digitalTwin.rails.empty")}</Typography>}
                  </DropArea>
                );
              })}

              <DropArea title={t("pagesUi.digitalTwin.freeMount.title")} hint={t("pagesUi.digitalTwin.freeMount.hint")} onDropItem={(itemId) => moveItemToTarget(itemId, { placement_mode: "wall", wall_id: activeWallId, rail_id: null })}>
                {wallItems.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {wallItems.map((item) => (
                    <TwinCard
                      key={item.id}
                      item={item}
                      selected={selectedItem?.id === item.id}
                      usage={usageByItemId.get(item.id)}
                      moveToStockLabel={t("pagesUi.digitalTwin.cards.moveToStock")}
                      editLabel={t("pagesUi.digitalTwin.cards.edit")}
                      deleteLabel={t("pagesUi.digitalTwin.cards.delete")}
                      stockLabel={t("pagesUi.digitalTwin.cards.inStock")}
                      outOfOperationLabel={t("pagesUi.digitalTwin.cards.outOfOperation")}
                      noPowerLabel={t("pagesUi.digitalTwin.cards.noPower")}
                      onSelect={() => updateDocument((current) => { current.ui.selected_item_id = item.id; return current; })}
                      onEdit={() => openEditor(item)}
                      onMoveToStock={() => moveItemToTarget(item.id, { placement_mode: "unplaced", wall_id: null, rail_id: null })}
                      onDelete={item.item_kind === "manual" ? () => updateDocument((current) => removeItemCompletely(current, item.id)) : undefined}
                      renderCurrentType={formatCurrentType}
                      renderChannelSummary={renderChannelSummary}
                    />
                  ))}
                </Box> : <Typography variant="body2" color="text.secondary">{t("pagesUi.digitalTwin.freeMount.empty")}</Typography>}
              </DropArea>
            </Box>
          </CardContent></Card>

          <Card><CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">{t("pagesUi.digitalTwin.sections.powerGraph")}</Typography>
            <Box sx={{ height: 340, border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                fitView
                onNodesChange={(changes: NodeChange[]) => updateDocument((current) => {
                  const nextNodes = applyNodeChanges(changes, flowNodes);
                  current.powerGraph.nodes = current.powerGraph.nodes.map((node) => {
                    const next = nextNodes.find((entry) => entry.id === node.id);
                    return next ? { ...node, x: next.position.x, y: next.position.y } : node;
                  });
                  return current;
                })}
                onConnect={(connection: Connection) => {
                  if (!connection.source || !connection.target) return;
                  updateDocument((current) => {
                    const nextEdges = addEdge(
                      { id: `edge-${Date.now()}`, source: connection.source!, target: connection.target!, label: "" },
                      current.powerGraph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label || edge.voltage || "" })),
                    );
                    current.powerGraph.edges = nextEdges.map((edge): DigitalTwinPowerEdge => ({ id: edge.id, source: edge.source, target: edge.target, label: String(edge.label || ""), voltage: null, role: "feed" }));
                    return current;
                  });
                }}
                onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
              >
                <MiniMap /><Controls /><Background />
              </ReactFlow>
            </Box>

            {selectedEdge ? <Stack spacing={1}>
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.edgeLabel")} value={selectedEdge.label} onChange={(event) => updateDocument((current) => { const edge = current.powerGraph.edges.find((entry) => entry.id === selectedEdge.id); if (edge) edge.label = event.target.value; return current; })} />
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.edgeVoltage")} value={selectedEdge.voltage || ""} onChange={(event) => updateDocument((current) => { const edge = current.powerGraph.edges.find((entry) => entry.id === selectedEdge.id); if (edge) edge.voltage = event.target.value || null; return current; })} />
              <TextField select size="small" label={t("pagesUi.digitalTwin.fields.edgeRole")} value={selectedEdge.role || "feed"} onChange={(event) => updateDocument((current) => { const edge = current.powerGraph.edges.find((entry) => entry.id === selectedEdge.id); if (edge) edge.role = String(event.target.value); return current; })}>
                <MenuItem value="feed">{t("pagesUi.digitalTwin.enums.edgeRole.feed")}</MenuItem>
                <MenuItem value="reserve">{t("pagesUi.digitalTwin.enums.edgeRole.reserve")}</MenuItem>
                <MenuItem value="loop">{t("pagesUi.digitalTwin.enums.edgeRole.loop")}</MenuItem>
              </TextField>
            </Stack> : null}

            {validationIssues.length ? validationIssues.map((issue) => (
              <Alert key={issue.id} severity={issue.severity === "error" ? "error" : "warning"}>{issue.title}: {issue.detail}</Alert>
            )) : <Alert severity="success">{t("pagesUi.digitalTwin.validation.clear")}</Alert>}
          </CardContent></Card>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, 1fr)" }, gap: 2 }}>
          <Card><CardContent sx={{ display: "grid", gap: 1 }}>
            <Typography variant="h6">{t("pagesUi.digitalTwin.sections.load")}</Typography>
            {["380VAC", "220VAC", "24VDC", "Other"].map((bucket) => (
              <Typography key={bucket} variant="body2">{bucket}: {(loadSummary[bucket]?.power || 0).toFixed(1)} W / {(loadSummary[bucket]?.current || 0).toFixed(2)} A</Typography>
            ))}
          </CardContent></Card>
          <Card><CardContent sx={{ display: "grid", gap: 1 }}>
            <Typography variant="h6">{t("pagesUi.digitalTwin.sections.io")}</Typography>
            <Typography variant="body2">AI {ioSummary.ai} / DI {ioSummary.di}</Typography>
            <Typography variant="body2">AO {ioSummary.ao} / DO {ioSummary.do}</Typography>
          </CardContent></Card>
          <Card><CardContent sx={{ display: "grid", gap: 1 }}>
            <Typography variant="h6">{t("pagesUi.digitalTwin.sections.network")}</Typography>
            <Typography variant="body2">{t("pagesUi.digitalTwin.network.total", { count: networkSummary.total })}</Typography>
            {networkSummary.rows.length ? networkSummary.rows.map((row) => <Typography key={row.id} variant="body2">{row.label}: {row.detail || "-"}</Typography>) : <Typography variant="body2" color="text.secondary">{t("pagesUi.digitalTwin.network.empty")}</Typography>}
          </CardContent></Card>
        </Box>

        <Dialog open={manualDialogOpen} onClose={() => setManualDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{t("pagesUi.digitalTwin.dialogs.addTitle")}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
            <TextField size="small" label={t("pagesUi.digitalTwin.fields.name")} value={manualDraft.name} onChange={(event) => setManualDraft((current) => ({ ...current, name: event.target.value }))} />
            <TextField select size="small" label={t("pagesUi.digitalTwin.fields.mountType")} value={manualDraft.mount_type} onChange={(event) => setManualDraft((current) => ({ ...current, mount_type: event.target.value as ManualItemDraft["mount_type"] }))}>
              {mountTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}
            </TextField>
            <TextField size="small" label={t("pagesUi.digitalTwin.fields.mountWidth")} type="number" value={manualDraft.mount_width_mm} onChange={(event) => setManualDraft((current) => ({ ...current, mount_width_mm: event.target.value }))} />
            <TextField select size="small" label={t("pagesUi.digitalTwin.fields.currentType")} value={manualDraft.current_type} onChange={(event) => setManualDraft((current) => ({ ...current, current_type: event.target.value }))}>
              {currentTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}
            </TextField>
            <TextField size="small" label={t("pagesUi.digitalTwin.fields.supplyVoltage")} value={manualDraft.supply_voltage} onChange={(event) => setManualDraft((current) => ({ ...current, supply_voltage: event.target.value }))} />
            <TextField size="small" label={t("pagesUi.digitalTwin.fields.currentConsumption")} type="number" value={manualDraft.current_consumption_a} onChange={(event) => setManualDraft((current) => ({ ...current, current_consumption_a: event.target.value }))} />
            <TextField select size="small" label={t("pagesUi.digitalTwin.fields.powerRole")} value={manualDraft.power_role} onChange={(event) => setManualDraft((current) => ({ ...current, power_role: event.target.value as ManualItemDraft["power_role"] }))}>
              {powerRoleOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}
            </TextField>
            <TextField size="small" label={t("pagesUi.digitalTwin.fields.outputVoltage")} value={manualDraft.output_voltage} onChange={(event) => setManualDraft((current) => ({ ...current, output_voltage: event.target.value }))} />
            <TextField size="small" label={t("pagesUi.digitalTwin.fields.maxOutputCurrent")} type="number" value={manualDraft.max_output_current_a} onChange={(event) => setManualDraft((current) => ({ ...current, max_output_current_a: event.target.value }))} />
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 1 }}>
              <TextField size="small" label="AI" type="number" value={manualDraft.ai_count} onChange={(event) => setManualDraft((current) => ({ ...current, ai_count: event.target.value }))} />
              <TextField size="small" label="DI" type="number" value={manualDraft.di_count} onChange={(event) => setManualDraft((current) => ({ ...current, di_count: event.target.value }))} />
              <TextField size="small" label="AO" type="number" value={manualDraft.ao_count} onChange={(event) => setManualDraft((current) => ({ ...current, ao_count: event.target.value }))} />
              <TextField size="small" label="DO" type="number" value={manualDraft.do_count} onChange={(event) => setManualDraft((current) => ({ ...current, do_count: event.target.value }))} />
            </Box>
            <TextField size="small" label={t("pagesUi.digitalTwin.fields.networkPorts")} type="number" value={manualDraft.network_port_count} onChange={(event) => setManualDraft((current) => ({ ...current, network_port_count: event.target.value }))} />
          </DialogContent>
          <DialogActions>
            <AppButton variant="outlined" onClick={() => setManualDialogOpen(false)}>{t("actions.cancel")}</AppButton>
            <AppButton onClick={() => { if (!manualDraft.name.trim()) return; updateDocument((current) => { const item = buildManualItem(manualDraft, activeWallId); item.sort_order = current.items.length; current.items.push(item); current.ui.selected_item_id = item.id; return current; }); setManualDraft(createManualDraft()); setManualDialogOpen(false); }} disabled={!manualDraft.name.trim()}>{t("actions.add")}</AppButton>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(editingItem && editDraft)} onClose={() => { setEditingItemId(null); setEditDraft(null); }} fullWidth maxWidth="sm">
          <DialogTitle>{t("pagesUi.digitalTwin.dialogs.editTitle")}</DialogTitle>
          {editingItem && editDraft ? <>
            <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.displayName")} value={editDraft.user_label} helperText={editingItem.item_kind === "manual" ? t("pagesUi.digitalTwin.fields.displayNameManualHint") : `${t("pagesUi.digitalTwin.fields.sourceName")}: ${editingItem.name}`} onChange={(event) => setEditDraft((current) => current ? { ...current, user_label: event.target.value } : current)} />
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.name")} value={editDraft.name} disabled={editingItem.item_kind !== "manual"} onChange={(event) => setEditDraft((current) => current ? { ...current, name: event.target.value } : current)} />
              <TextField select size="small" label={t("pagesUi.digitalTwin.fields.mountType")} value={editDraft.mount_type} onChange={(event) => setEditDraft((current) => current ? { ...current, mount_type: event.target.value as ItemEditorDraft["mount_type"] } : current)}>
                {mountTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}
              </TextField>
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.mountWidth")} type="number" value={editDraft.mount_width_mm} onChange={(event) => setEditDraft((current) => current ? { ...current, mount_width_mm: event.target.value } : current)} />
              <TextField select size="small" label={t("pagesUi.digitalTwin.fields.currentType")} value={editDraft.current_type} onChange={(event) => setEditDraft((current) => current ? { ...current, current_type: event.target.value } : current)}>
                {currentTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}
              </TextField>
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.supplyVoltage")} value={editDraft.supply_voltage} onChange={(event) => setEditDraft((current) => current ? { ...current, supply_voltage: event.target.value } : current)} />
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.currentConsumption")} type="number" value={editDraft.current_consumption_a} onChange={(event) => setEditDraft((current) => current ? { ...current, current_consumption_a: event.target.value } : current)} />
              <TextField select size="small" label={t("pagesUi.digitalTwin.fields.powerRole")} value={editDraft.power_role} onChange={(event) => setEditDraft((current) => current ? { ...current, power_role: event.target.value as ItemEditorDraft["power_role"] } : current)}>
                {powerRoleOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}
              </TextField>
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.outputVoltage")} value={editDraft.output_voltage} onChange={(event) => setEditDraft((current) => current ? { ...current, output_voltage: event.target.value } : current)} />
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.maxOutputCurrent")} type="number" value={editDraft.max_output_current_a} onChange={(event) => setEditDraft((current) => current ? { ...current, max_output_current_a: event.target.value } : current)} />
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 1 }}>
                <TextField size="small" label="AI" type="number" value={editDraft.ai_count} onChange={(event) => setEditDraft((current) => current ? { ...current, ai_count: event.target.value } : current)} />
                <TextField size="small" label="DI" type="number" value={editDraft.di_count} onChange={(event) => setEditDraft((current) => current ? { ...current, di_count: event.target.value } : current)} />
                <TextField size="small" label="AO" type="number" value={editDraft.ao_count} onChange={(event) => setEditDraft((current) => current ? { ...current, ao_count: event.target.value } : current)} />
                <TextField size="small" label="DO" type="number" value={editDraft.do_count} onChange={(event) => setEditDraft((current) => current ? { ...current, do_count: event.target.value } : current)} />
              </Box>
              <TextField size="small" label={t("pagesUi.digitalTwin.fields.networkPorts")} type="number" value={editDraft.network_port_count} onChange={(event) => setEditDraft((current) => current ? { ...current, network_port_count: event.target.value } : current)} />
            </DialogContent>
            <DialogActions>
              <AppButton variant="outlined" onClick={() => { setEditingItemId(null); setEditDraft(null); }}>{t("actions.cancel")}</AppButton>
              <AppButton onClick={() => { if (!editingItem || !editDraft) return; updateDocument((current) => { const item = current.items.find((entry) => entry.id === editingItem.id); if (item) applyItemEditorDraft(item, editDraft); return current; }); setEditingItemId(null); setEditDraft(null); }}>{t("actions.save")}</AppButton>
            </DialogActions>
          </> : null}
        </Dialog>

        <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
      </Box>
    </ReactFlowProvider>
  );
}
