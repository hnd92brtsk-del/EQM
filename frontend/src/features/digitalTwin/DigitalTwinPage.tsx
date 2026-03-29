import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import CableRoundedIcon from "@mui/icons-material/CableRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DeviceHubRoundedIcon from "@mui/icons-material/DeviceHubRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SettingsEthernetRoundedIcon from "@mui/icons-material/SettingsEthernetRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router-dom";

import {
  type DigitalTwinDocument,
  type DigitalTwinItem,
  type DigitalTwinRecord,
  type DigitalTwinScope,
  type TwinPlacementMode,
  ensureDigitalTwin,
  syncDigitalTwinFromOperation,
  updateDigitalTwin,
} from "../../api/digitalTwins";
import { createCabinetItem, deleteCabinetItem } from "../../api/cabinetItems";
import { listEquipmentTypesForSelect, updateEquipmentType, type EquipmentTypeRecord } from "../../api/equipmentTypes";
import { type IOSignal, listIOSignals, rebuildIOSignals, updateIOSignal } from "../../api/ioSignals";
import { DataTable } from "../../components/DataTable";
import { EntityDialog, type DialogState } from "../../components/EntityDialog";
import { ErrorSnackbar } from "../../components/ErrorSnackbar";
import { SearchableSelectField } from "../../components/SearchableSelectField";
import { AppButton } from "../../components/ui/AppButton";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { buildDataTypeLookups, fetchDataTypesTree } from "../../utils/dataTypes";
import { buildFieldEquipmentLookups, fetchFieldEquipmentsTree } from "../../utils/fieldEquipments";
import { buildMeasurementUnitLookups, fetchMeasurementUnitsTree } from "../../utils/measurementUnits";
import { assignAddress, getCabinetItemIPAMSummary, getSubnetAddresses, listEligibleEquipment, listSubnets, releaseAddress } from "../ipam/api/ipam";
import {
  buildIOSignalColumns,
  buildIOSignalUpdatePayload,
  buildTreeSelectOptions,
  createIOSignalEditDialogState,
  ioSignalTypeOptions,
  type TreeSelectNode,
} from "../ioSignals/shared";
import type { EligibleEquipment, Subnet } from "../ipam/types";
import { createSerialMapDocument, getSerialMapDocument, listSerialMapDocuments, listSerialMapEligibleEquipment, updateSerialMapDocument } from "../serialMap/api";
import { createEmptyDocument, createNodeFromEquipment } from "../serialMap/model";
import type { SerialMapEligibleEquipment } from "../serialMap/types";
import { buildSignalTypeLookups, fetchSignalTypesTree } from "../../utils/signalTypes";
import {
  buildIoSummary,
  buildLoadSummary,
  buildManualItem,
  buildNetworkSummary,
  buildValidation,
  cloneDocument,
  createManualDraft,
  getPowerBucketStyle,
  itemDisplayName,
  normalizeDigitalTwinDocument,
  wallColors,
  type ManualItemDraft,
} from "./utils";
import { PowerGraphCanvas } from "./PowerGraphCanvas";
import {
  buildCurrentTypeOptions,
  buildEquipmentTypeUpdatePayload,
  buildSupplyVoltageOptions,
  createNomenclatureDraft,
  formatEquipmentTypeOptionLabel,
  getCurrentTypeLabel,
  type NomenclatureDraft,
} from "./nomenclature";

type PlacementTarget = { placement_mode: TwinPlacementMode; wall_id: string | null; rail_id: string | null };
type ItemEditorDraft = ManualItemDraft & { user_label: string };
type SourceBackedEditorDraft = NomenclatureDraft & { user_label: string };
type ChannelUsageSummary = {
  total: number;
  used: number;
  free: number;
  aiTotal: number;
  diTotal: number;
  aoTotal: number;
  doTotal: number;
  aiUsed: number;
  diUsed: number;
  aoUsed: number;
  doUsed: number;
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
const serialNodeKindOptions = [
  { value: "master", label: "Master" },
  { value: "slave", label: "Slave" },
  { value: "sensor", label: "Sensor" },
  { value: "gateway", label: "Gateway" },
] as const;

type LocalErrorBoundaryProps = {
  title: string;
  children: React.ReactNode;
};

type LocalErrorBoundaryState = {
  error: Error | null;
};

class LocalErrorBoundary extends React.Component<LocalErrorBoundaryProps, LocalErrorBoundaryState> {
  state: LocalErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): LocalErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[DigitalTwinPage] ${this.props.title}`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <Alert severity="error">
          {this.props.title}: {this.state.error.message || "Не удалось отрисовать блок."}
        </Alert>
      );
    }
    return this.props.children;
  }
}

function describeQueryError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

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

function createSourceBackedDraft(item: DigitalTwinItem, equipment?: EquipmentTypeRecord | null): SourceBackedEditorDraft {
  return {
    ...createNomenclatureDraft(equipment || null),
    user_label: item.user_label || "",
  };
}

function isSignalConfigured(signal: IOSignal) {
  return Boolean(
    signal.tag?.trim()
    || signal.signal?.trim()
    || signal.data_type_id
    || signal.signal_kind_id
    || signal.field_equipment_id
    || signal.connection_point?.trim()
    || signal.measurement_unit_id,
  );
}

function countSignalsByType(signals: IOSignal[]) {
  return signals.reduce((acc, signal) => {
    if (!isSignalConfigured(signal)) return acc;
    if (signal.signal_type === "AI") acc.ai += 1;
    if (signal.signal_type === "DI") acc.di += 1;
    if (signal.signal_type === "AO") acc.ao += 1;
    if (signal.signal_type === "DO") acc.do += 1;
    return acc;
  }, { ai: 0, di: 0, ao: 0, do: 0 });
}

function buildChannelUsage(item: DigitalTwinItem, signals?: IOSignal[]): ChannelUsageSummary {
  const aiTotal = item.ai_count || 0;
  const diTotal = item.di_count || 0;
  const aoTotal = item.ao_count || 0;
  const doTotal = item.do_count || 0;
  const total = aiTotal + diTotal + aoTotal + doTotal || item.channel_count || 0;
  const counts = signals ? countSignalsByType(signals) : { ai: 0, di: 0, ao: 0, do: 0 };
  const used = signals ? counts.ai + counts.di + counts.ao + counts.do : 0;
  return {
    total,
    used,
    free: Math.max(total - used, 0),
    aiTotal,
    diTotal,
    aoTotal,
    doTotal,
    aiUsed: counts.ai,
    diUsed: counts.di,
    aoUsed: counts.ao,
    doUsed: counts.do,
    hasLiveData: Boolean(signals),
  };
}

function ChannelUsageBlock({ label, used, total }: { label: string; used: number; total: number }) {
  if (total <= 0) return null;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{label} {used}/{total}</Typography>
      <LinearProgress variant="determinate" value={total ? (used / total) * 100 : 0} sx={{ height: 6, borderRadius: 999, bgcolor: "rgba(255,255,255,0.12)" }} />
    </Box>
  );
}

function TwinCard({
  item,
  selected,
  usage,
  moveToStockLabel,
  editLabel,
  deleteLabel,
  stockLabel,
  outOfOperationLabel,
  noPowerLabel,
  onSelect,
  onDelete,
  onMoveToStock,
  onDropBefore,
  renderCurrentType,
}: {
  item: DigitalTwinItem;
  selected: boolean;
  usage?: ChannelUsageSummary;
  moveToStockLabel: string;
  editLabel: string;
  deleteLabel: string;
  stockLabel: string;
  outOfOperationLabel: string;
  noPowerLabel: string;
  onSelect: () => void;
  onDelete?: () => void;
  onMoveToStock?: () => void;
  onDropBefore?: (draggedItemId: string, targetItemId: string) => void;
  renderCurrentType: (value?: string | null) => string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const supplyStyle = getPowerBucketStyle(item.supply_voltage, item.current_type);
  const outputStyle = item.power_role === "converter" ? getPowerBucketStyle(item.output_voltage, item.current_type) : null;
  const powerLine = item.supply_voltage ? [item.supply_voltage, renderCurrentType(item.current_type)].filter(Boolean).join(" • ") : noPowerLabel;

  return (
    <Card
      draggable
      onClick={onSelect}
      onDragStart={(event) => { event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const draggedItemId = event.dataTransfer.getData("text/plain");
        if (draggedItemId && draggedItemId !== item.id) onDropBefore?.(draggedItemId, item.id);
      }}
      sx={{
        width: { xs: "100%", sm: 240 },
        border: "1px solid",
        borderColor: dragOver ? "primary.main" : selected ? "text.primary" : "divider",
        boxShadow: dragOver ? "0 0 0 3px rgba(47,111,237,0.12)" : "none",
        borderRadius: 3,
        cursor: "grab",
        overflow: "hidden",
        bgcolor: "#1f2937",
        color: "#f8fafc",
      }}
    >
      <Box sx={{ display: "flex", height: 8, bgcolor: outputStyle ? "transparent" : supplyStyle.bg }}>
        {outputStyle ? (
          <>
            <Box sx={{ flex: 1, bgcolor: supplyStyle.bg, borderRight: "1px solid rgba(255,255,255,0.55)" }} />
            <Box sx={{ flex: 1, bgcolor: outputStyle.bg }} />
          </>
        ) : null}
      </Box>
      <CardContent sx={{ p: 1.25, display: "grid", gap: 1, "&:last-child": { pb: 1.25 } }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography variant="subtitle2" sx={{ lineHeight: 1.2, wordBreak: "break-word" }}>{itemDisplayName(item)}</Typography>
              {supplyStyle.alert ? <ErrorOutlineRoundedIcon sx={{ fontSize: 16, color: "#fbbf24" }} /> : null}
            </Stack>
            {item.user_label ? <Typography variant="caption" color="rgba(226,232,240,0.85)">{item.name}</Typography> : null}
          </Box>
          <Stack direction="row" spacing={0.25}>
            {item.placement_mode !== "unplaced" ? (
              <Tooltip title={moveToStockLabel}><IconButton size="small" sx={{ color: "#cbd5e1" }} onClick={(event) => { event.stopPropagation(); onMoveToStock?.(); }}><Inventory2OutlinedIcon fontSize="small" /></IconButton></Tooltip>
            ) : <Chip size="small" variant="outlined" label={stockLabel} sx={{ color: "#cbd5e1", borderColor: "rgba(203,213,225,0.32)" }} />}
            <Tooltip title={editLabel}><IconButton size="small" sx={{ color: "#cbd5e1" }} onClick={(event) => { event.stopPropagation(); onSelect(); }}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
            {onDelete ? <Tooltip title={deleteLabel}><IconButton size="small" color="error" onClick={(event) => { event.stopPropagation(); onDelete(); }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip> : null}
          </Stack>
        </Stack>
        <Typography variant="caption" color="rgba(226,232,240,0.85)">{powerLine}</Typography>
        {item.source_status === "out_of_operation" ? <Chip size="small" color="warning" variant="outlined" label={outOfOperationLabel} sx={{ justifySelf: "start" }} /> : null}
        {item.is_channel_forming && usage ? (
          <Box sx={{ display: "grid", gap: 0.75 }}>
            <ChannelUsageBlock label="AI" used={usage.aiUsed} total={usage.aiTotal} />
            <ChannelUsageBlock label="AO" used={usage.aoUsed} total={usage.aoTotal} />
            <ChannelUsageBlock label="DI" used={usage.diUsed} total={usage.diTotal} />
            <ChannelUsageBlock label="DO" used={usage.doUsed} total={usage.doTotal} />
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

function SignalListDialog({
  open,
  item,
  onClose,
  onError,
}: {
  open: boolean;
  item: DigitalTwinItem | null;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "engineering", "write");
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const signalsQuery = useQuery({
    queryKey: ["digital-twin-signal-modal", item?.equipment_item_id],
    enabled: open && Boolean(item?.equipment_item_id),
    queryFn: () => listIOSignals(item!.equipment_item_id!),
  });
  const measurementUnitsTreeQuery = useQuery({
    queryKey: ["measurement-units-tree-options", false],
    queryFn: () => fetchMeasurementUnitsTree(false),
  });
  const signalTypesTreeQuery = useQuery({
    queryKey: ["signal-types-tree-options", false],
    queryFn: () => fetchSignalTypesTree(false),
  });
  const dataTypesTreeQuery = useQuery({
    queryKey: ["data-types-tree-options", false],
    queryFn: () => fetchDataTypesTree(false),
  });
  const fieldEquipmentsTreeQuery = useQuery({
    queryKey: ["field-equipments-tree-options", false],
    queryFn: () => fetchFieldEquipmentsTree(false),
  });

  const { options: measurementUnitOptions, breadcrumbMap: measurementUnitBreadcrumbs, leafIds } =
    useMemo(() => buildMeasurementUnitLookups(measurementUnitsTreeQuery.data || []), [
      measurementUnitsTreeQuery.data,
    ]);
  const measurementUnitLeafOptions = useMemo(
    () =>
      measurementUnitOptions
        .filter((option) => leafIds.has(option.value))
        .map((option) => ({
          ...option,
          label: measurementUnitBreadcrumbs.get(option.value) || option.label,
        })),
    [leafIds, measurementUnitBreadcrumbs, measurementUnitOptions]
  );
  const {
    options: signalKindOptions,
    breadcrumbMap: signalKindBreadcrumbs,
    leafIds: signalKindLeafIds,
  } = useMemo(() => buildSignalTypeLookups(signalTypesTreeQuery.data || []), [signalTypesTreeQuery.data]);
  const signalKindLeafOptions = useMemo(
    () =>
      signalKindOptions
        .filter((option) => signalKindLeafIds.has(option.value))
        .map((option) => ({
          ...option,
          label: signalKindBreadcrumbs.get(option.value) || option.label,
        })),
    [signalKindBreadcrumbs, signalKindLeafIds, signalKindOptions]
  );
  const { breadcrumbMap: dataTypeBreadcrumbs } = useMemo(
    () => buildDataTypeLookups(dataTypesTreeQuery.data || []),
    [dataTypesTreeQuery.data]
  );
  const { breadcrumbMap: fieldEquipmentBreadcrumbs } = useMemo(
    () => buildFieldEquipmentLookups(fieldEquipmentsTreeQuery.data || []),
    [fieldEquipmentsTreeQuery.data]
  );
  const dataTypeTreeOptions = useMemo(
    () => buildTreeSelectOptions((dataTypesTreeQuery.data || []) as TreeSelectNode[]),
    [dataTypesTreeQuery.data]
  );
  const fieldEquipmentTreeOptions = useMemo(
    () => buildTreeSelectOptions((fieldEquipmentsTreeQuery.data || []) as TreeSelectNode[]),
    [fieldEquipmentsTreeQuery.data]
  );

  useEffect(() => {
    if (signalsQuery.error) {
      onError(
        signalsQuery.error instanceof Error ? signalsQuery.error.message : t("pagesUi.ioSignals.errors.loadSignals")
      );
    }
  }, [onError, signalsQuery.error, t]);

  const rebuildMutation = useMutation({
    mutationFn: () => rebuildIOSignals(item!.equipment_item_id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-twin-signal-modal", item?.equipment_item_id] });
      queryClient.invalidateQueries({ queryKey: ["digital-twin-io-signals", item?.equipment_item_id] });
    },
    onError: (error) => onError(error instanceof Error ? error.message : t("pagesUi.ioSignals.errors.rebuild")),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<IOSignal> }) => updateIOSignal(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-twin-signal-modal", item?.equipment_item_id] });
      queryClient.invalidateQueries({ queryKey: ["digital-twin-io-signals", item?.equipment_item_id] });
    },
    onError: (error) => onError(error instanceof Error ? error.message : t("pagesUi.ioSignals.errors.update")),
  });

  const columns = useMemo<ColumnDef<IOSignal>[]>(
    () =>
      buildIOSignalColumns({
        t,
        canWrite,
        lookupMaps: {
          dataTypeBreadcrumbs,
          signalKindBreadcrumbs,
          fieldEquipmentBreadcrumbs,
          measurementUnitBreadcrumbs,
        },
        onEdit: (signal) =>
          setDialog(
            createIOSignalEditDialogState({
              t,
              signal,
              resources: {
                signalTypeOptions: ioSignalTypeOptions,
                signalKindLeafOptions,
                measurementUnitLeafOptions,
                dataTypeTreeOptions,
                fieldEquipmentTreeOptions,
              },
              onSave: (values) =>
                updateMutation
                  .mutateAsync({
                    id: signal.id,
                    payload: buildIOSignalUpdatePayload(values),
                  })
                  .then(() => undefined),
            })
          ),
      }),
    [
      canWrite,
      dataTypeBreadcrumbs,
      dataTypeTreeOptions,
      fieldEquipmentBreadcrumbs,
      fieldEquipmentTreeOptions,
      measurementUnitBreadcrumbs,
      measurementUnitLeafOptions,
      signalKindBreadcrumbs,
      signalKindLeafOptions,
      t,
      updateMutation,
    ]
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
        <DialogTitle>{t("pages.ioSignals")}: {item ? itemDisplayName(item) : ""}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary">
              {t("pagesUi.ioSignals.empty.noSignals")}
            </Typography>
            <AppButton
              variant="outlined"
              onClick={() => rebuildMutation.mutate()}
              disabled={!item?.equipment_item_id || rebuildMutation.isPending}
            >
              {t("pagesUi.ioSignals.actions.rebuild")}
            </AppButton>
          </Box>
          <Box sx={{ maxHeight: 480, overflow: "auto" }}>
            {signalsQuery.isLoading ? <LinearProgress sx={{ mb: 1 }} /> : null}
            <DataTable data={signalsQuery.data || []} columns={columns} />
          </Box>
        </DialogContent>
        <DialogActions>
          <AppButton variant="outlined" onClick={onClose}>{t("actions.close")}</AppButton>
        </DialogActions>
      </Dialog>
      {dialog ? <EntityDialog state={dialog} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

function IpamDialog({
  open,
  item,
  onClose,
  onError,
}: {
  open: boolean;
  item: DigitalTwinItem | null;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedSubnetId, setSelectedSubnetId] = useState<number | "">("");
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [selectedInterfaceId, setSelectedInterfaceId] = useState<number | "">("");

  const summaryQuery = useQuery({
    queryKey: ["digital-twin-ipam-summary", item?.equipment_item_id],
    enabled: open && Boolean(item?.equipment_item_id),
    queryFn: () => getCabinetItemIPAMSummary(item!.equipment_item_id!),
  });
  const eligibleQuery = useQuery({
    queryKey: ["digital-twin-ipam-eligible", item?.equipment_item_id],
    enabled: open && Boolean(item?.equipment_item_id),
    queryFn: () => listEligibleEquipment({}),
  });
  const subnetsQuery = useQuery({
    queryKey: ["digital-twin-ipam-subnets"],
    enabled: open,
    queryFn: () => listSubnets({ page: 1, page_size: 200, sort: "network_address" }),
  });
  const gridQuery = useQuery({
    queryKey: ["digital-twin-ipam-grid", selectedSubnetId],
    enabled: open && Boolean(selectedSubnetId),
    queryFn: () => getSubnetAddresses(Number(selectedSubnetId), { mode: "grid", include_service: true }),
  });

  const equipment = useMemo<EligibleEquipment | null>(() => {
    if (!item?.equipment_item_id) return null;
    return (eligibleQuery.data || []).find((entry) => entry.equipment_item_id === item.equipment_item_id && entry.equipment_source === "cabinet") || null;
  }, [eligibleQuery.data, item?.equipment_item_id]);
  const subnets = subnetsQuery.data?.items || [];

  useEffect(() => {
    if (equipment?.network_interfaces[0]) setSelectedInterfaceId(equipment.network_interfaces[0].id);
  }, [equipment?.network_interfaces]);

  const assignMutation = useMutation({
    mutationFn: () => assignAddress(Number(selectedSubnetId), selectedOffset!, {
      equipment_source: "cabinet",
      equipment_item_id: item!.equipment_item_id!,
      equipment_interface_id: Number(selectedInterfaceId),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-twin-ipam-summary", item?.equipment_item_id] });
      queryClient.invalidateQueries({ queryKey: ["digital-twin-ipam-grid", selectedSubnetId] });
    },
    onError: (error) => onError(error instanceof Error ? error.message : "Не удалось назначить IP"),
  });
  const releaseMutation = useMutation({
    mutationFn: (offset: number) => releaseAddress(Number(selectedSubnetId), offset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-twin-ipam-summary", item?.equipment_item_id] });
      queryClient.invalidateQueries({ queryKey: ["digital-twin-ipam-grid", selectedSubnetId] });
    },
    onError: (error) => onError(error instanceof Error ? error.message : "Не удалось освободить IP"),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>IPAM: {item ? itemDisplayName(item) : ""}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ display: "grid", gap: 1.5 }}>
              <Typography variant="subtitle2">Текущие связи</Typography>
              <Typography variant="body2">Интерфейсов: {summaryQuery.data?.network_interfaces_count || 0}</Typography>
              <Typography variant="body2">IP: {(summaryQuery.data?.linked_ip_addresses || []).join(", ") || "Нет"}</Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>Подсеть</InputLabel>
                <Select label="Подсеть" value={selectedSubnetId} onChange={(event) => { setSelectedSubnetId(event.target.value as number); setSelectedOffset(null); }}>
                  <MenuItem value="">Не выбрано</MenuItem>
                  {subnets.map((subnet: Subnet) => <MenuItem key={subnet.id} value={subnet.id}>{subnet.cidr} {subnet.name ? `• ${subnet.name}` : ""}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth disabled={!equipment?.network_interfaces.length}>
                <InputLabel>Интерфейс</InputLabel>
                <Select label="Интерфейс" value={selectedInterfaceId} onChange={(event) => setSelectedInterfaceId(Number(event.target.value))}>
                  {(equipment?.network_interfaces || []).map((iface) => <MenuItem key={iface.id} value={iface.id}>{iface.interface_name}</MenuItem>)}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">Выберите свободный адрес в сетке справа и назначьте его текущему устройству.</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1.2 }}>
            <CardContent sx={{ display: "grid", gap: 1.5 }}>
              <Typography variant="subtitle2">Сетка адресов</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(16, 1fr)", gap: 0.75, minHeight: 220 }}>
                {(gridQuery.data?.items || []).slice(0, 256).map((address) => (
                  <Box
                    key={`${address.subnet_id}:${address.ip_offset}`}
                    title={`${address.ip_address} (${address.status})`}
                    onClick={() => setSelectedOffset(address.ip_offset)}
                    sx={{ height: 24, borderRadius: 1, cursor: "pointer", border: selectedOffset === address.ip_offset ? "2px solid #111827" : "1px solid rgba(15,23,42,0.12)", bgcolor: address.status === "free" ? "#d1fae5" : address.status === "used" ? "#fecaca" : address.status === "reserved" ? "#fde68a" : "#cbd5e1" }}
                  />
                ))}
              </Box>
              <Stack direction="row" spacing={1}>
                <AppButton onClick={() => { if (selectedOffset != null) assignMutation.mutate(); }} disabled={selectedOffset == null || !selectedInterfaceId || assignMutation.isPending}>Назначить</AppButton>
                <AppButton variant="outlined" onClick={() => { if (selectedOffset != null) releaseMutation.mutate(selectedOffset); }} disabled={selectedOffset == null || releaseMutation.isPending}>Освободить</AppButton>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>
      <DialogActions>
        <AppButton variant="outlined" onClick={onClose}>Закрыть</AppButton>
      </DialogActions>
    </Dialog>
  );
}

function SerialMapDialog({
  open,
  item,
  sourceContext,
  onClose,
  onError,
}: {
  open: boolean;
  item: DigitalTwinItem | null;
  sourceContext?: Record<string, unknown> | null;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | "">("");
  const [selectedKind, setSelectedKind] = useState<(typeof serialNodeKindOptions)[number]["value"]>("slave");

  const documentsQuery = useQuery({
    queryKey: ["digital-twin-serial-documents"],
    enabled: open,
    queryFn: () => listSerialMapDocuments({ page: 1, page_size: 200 }),
  });
  const eligibleQuery = useQuery({
    queryKey: ["digital-twin-serial-eligible", item?.equipment_item_id],
    enabled: open && Boolean(item?.equipment_item_id),
    queryFn: () => listSerialMapEligibleEquipment({}),
  });

  const eligibleEquipment = useMemo<SerialMapEligibleEquipment | null>(() => {
    if (!item?.equipment_item_id) return null;
    return (eligibleQuery.data || []).find((entry) => entry.id === item.equipment_item_id && entry.source === "cabinet") || null;
  }, [eligibleQuery.data, item?.equipment_item_id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!eligibleEquipment) throw new Error("Оборудование недоступно для Serial Map.");
      const documentRecord = selectedDocumentId
        ? await getSerialMapDocument(Number(selectedDocumentId))
        : await createSerialMapDocument({
          name: `Serial Map - ${String(sourceContext?.name || "Шкаф")}`,
          scope: "cabinet",
          location_id: typeof sourceContext?.location_id === "number" ? sourceContext.location_id : null,
          source_context: sourceContext || null,
          document: createEmptyDocument(),
        });
      const current = structuredClone(documentRecord.document);
      const existingNode = current.nodes.find((node) => node.sourceRef?.source === "cabinet" && node.sourceRef.equipmentInOperationId === eligibleEquipment.id);
      if (existingNode) {
        existingNode.kind = selectedKind;
        existingNode.serialPorts = eligibleEquipment.serialPorts;
      } else {
        const nextNode = createNodeFromEquipment(eligibleEquipment, { x: 60 + current.nodes.length * 30, y: 80 + current.nodes.length * 18 });
        nextNode.kind = selectedKind;
        current.nodes.push(nextNode);
      }
      await updateSerialMapDocument(documentRecord.id, { document: current });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-twin-serial-documents"] });
      onClose();
    },
    onError: (error) => onError(error instanceof Error ? error.message : "Не удалось обновить Serial Map"),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Serial Map: {item ? itemDisplayName(item) : ""}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Документ</InputLabel>
          <Select label="Документ" value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value as number)}>
            <MenuItem value="">Создать новый</MenuItem>
            {(documentsQuery.data?.items || []).map((doc) => <MenuItem key={doc.id} value={doc.id}>{doc.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Тип узла</InputLabel>
          <Select label="Тип узла" value={selectedKind} onChange={(event) => setSelectedKind(event.target.value as (typeof serialNodeKindOptions)[number]["value"])}>
            {serialNodeKindOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">Узел будет создан или обновлён по `sourceRef` выбранного cabinet item.</Typography>
      </DialogContent>
      <DialogActions>
        <AppButton variant="outlined" onClick={onClose}>Отмена</AppButton>
        <AppButton onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !eligibleEquipment}>Сохранить</AppButton>
      </DialogActions>
    </Dialog>
  );
}

function DigitalTwinPageInner() {
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "equipment", "write");
  const scope: DigitalTwinScope = location.pathname.startsWith("/assemblies/") ? "assembly" : "cabinet";
  const sourceId = Number(id || 0);

  const [record, setRecord] = useState<DigitalTwinRecord | null>(null);
  const [document, setDocument] = useState<DigitalTwinDocument | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualItemDraft>(createManualDraft());
  const [cabinetDraft, setCabinetDraft] = useState<NomenclatureDraft>(createNomenclatureDraft());
  const [manualEditorDraft, setManualEditorDraft] = useState<ItemEditorDraft | null>(null);
  const [sourceEditDraft, setSourceEditDraft] = useState<SourceBackedEditorDraft | null>(null);
  const [signalDialogOpen, setSignalDialogOpen] = useState(false);
  const [ipamDialogOpen, setIpamDialogOpen] = useState(false);
  const [serialDialogOpen, setSerialDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedSignatureRef = useState({ current: "" })[0];

  const twinQuery = useQuery({
    queryKey: ["digital-twin-ensure", scope, sourceId],
    queryFn: () => ensureDigitalTwin(scope, sourceId),
    enabled: sourceId > 0,
    refetchOnWindowFocus: false,
  });
  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-select-all"],
    queryFn: listEquipmentTypesForSelect,
    enabled: scope === "cabinet" && sourceId > 0,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!twinQuery.data) return;
    const normalizedDocument = normalizeDigitalTwinDocument(twinQuery.data.document);
    lastSavedSignatureRef.current = JSON.stringify(normalizedDocument);
    setRecord(twinQuery.data);
    setDocument(normalizedDocument);
    setSaveState("idle");
  }, [twinQuery.data, lastSavedSignatureRef]);

  useEffect(() => {
    if (!twinQuery.error) return;
    console.error("[DigitalTwinPage] ensureDigitalTwin failed", twinQuery.error);
  }, [twinQuery.error]);

  const saveMutation = useMutation({
    mutationFn: (payload: { twinId: number; document: DigitalTwinDocument }) => updateDigitalTwin(payload.twinId, { document: payload.document }),
    onSuccess: (data) => {
      const normalizedDocument = normalizeDigitalTwinDocument(data.document);
      lastSavedSignatureRef.current = JSON.stringify(normalizedDocument);
      setRecord(data);
      setDocument(normalizedDocument);
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
      const normalizedDocument = normalizeDigitalTwinDocument(data.document);
      lastSavedSignatureRef.current = JSON.stringify(normalizedDocument);
      setRecord(data);
      setDocument(normalizedDocument);
      queryClient.setQueryData(["digital-twin-ensure", scope, sourceId], data);
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.digitalTwin.errors.sync")),
  });
  const createCabinetItemMutation = useMutation({
    mutationFn: createCabinetItem,
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.digitalTwin.errors.sync")),
  });
  const deleteCabinetItemMutation = useMutation({
    mutationFn: deleteCabinetItem,
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.digitalTwin.errors.sync")),
  });
  const updateEquipmentTypeMutation = useMutation({
    mutationFn: ({ id: equipmentTypeId, payload }: { id: number; payload: ReturnType<typeof buildEquipmentTypeUpdatePayload> }) => updateEquipmentType(equipmentTypeId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<EquipmentTypeRecord[] | undefined>(["equipment-types-select-all"], (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      queryClient.invalidateQueries({ queryKey: ["equipment-types"] });
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.digitalTwin.errors.save")),
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
  }, [canWrite, document, record?.id, saveMutation, lastSavedSignatureRef]);

  const updateDocument = (updater: (current: DigitalTwinDocument) => DigitalTwinDocument) => {
    setDocument((current) => (current ? updater(cloneDocument(current)) : current));
  };

  const saveDocumentNow = async (nextDocument: DigitalTwinDocument) => {
    if (!record?.id) return;
    setSaveState("saving");
    const data = await saveMutation.mutateAsync({ twinId: record.id, document: nextDocument });
    return normalizeDigitalTwinDocument(data.document);
  };

  const activeWallId = document?.ui.active_wall_id || document?.walls[0]?.id || "back";
  const rails = (document?.rails || []).filter((rail) => rail.wall_id === activeWallId).sort((a, b) => a.sort_order - b.sort_order);
  const selectedItem = document?.items.find((item) => item.id === document.ui.selected_item_id) || null;
  const validationIssues = useMemo(() => (document ? buildValidation(document) : []), [document]);
  const loadSummary = useMemo(() => (document ? buildLoadSummary(document) : {}), [document]);
  const ioSummary = useMemo(() => (document ? buildIoSummary(document) : { ai: 0, di: 0, ao: 0, do: 0 }), [document]);
  const networkSummary = useMemo(() => (document ? buildNetworkSummary(document) : { rows: [], total: 0 }), [document]);
  const networkItems = useMemo(
    () => (document?.items || []).filter((item) => item.is_network && item.equipment_item_source === "cabinet" && Boolean(item.equipment_item_id)),
    [document?.items],
  );
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
  const ipamSummaries = useQueries({
    queries: networkItems.map((item) => ({
      queryKey: ["digital-twin-ipam-summary-inline", item.equipment_item_id],
      queryFn: () => getCabinetItemIPAMSummary(item.equipment_item_id!),
      enabled: Boolean(item.equipment_item_id),
      staleTime: 60_000,
    })),
  });
  const usageByItemId = useMemo(() => {
    const map = new Map<string, ChannelUsageSummary>();
    for (const item of document?.items || []) map.set(item.id, buildChannelUsage(item));
    signalQueryItems.forEach((item, index) => { if (signalQueries[index]?.data) map.set(item.id, buildChannelUsage(item, signalQueries[index].data)); });
    return map;
  }, [document?.items, signalQueries, signalQueryItems]);
  const cabinetLinkedIps = useMemo(() => ipamSummaries.flatMap((query) => query.data?.linked_ip_addresses || []), [ipamSummaries]);

  const nomenclatureOptions = useMemo(() => (equipmentTypesQuery.data || []).map((item) => ({ value: item.id, label: formatEquipmentTypeOptionLabel(item) })), [equipmentTypesQuery.data]);
  const equipmentById = useMemo(() => new Map((equipmentTypesQuery.data || []).map((item) => [item.id, item])), [equipmentTypesQuery.data]);
  const cabinetCurrentTypeOptions = useMemo(() => buildCurrentTypeOptions(t), [t]);
  const cabinetSupplyVoltageOptions = useMemo(() => buildSupplyVoltageOptions(t), [t]);
  const formatCurrentType = (value?: string | null) => getCurrentTypeLabel(value, t);

  useEffect(() => {
    if (!selectedItem) {
      setManualEditorDraft(null);
      setSourceEditDraft(null);
      return;
    }
    if (selectedItem.item_kind === "source-backed" && selectedItem.equipment_type_id && equipmentById.has(selectedItem.equipment_type_id)) {
      setSourceEditDraft(createSourceBackedDraft(selectedItem, equipmentById.get(selectedItem.equipment_type_id)));
      setManualEditorDraft(null);
    } else {
      setManualEditorDraft(createItemEditorDraft(selectedItem));
      setSourceEditDraft(null);
    }
  }, [selectedItem, equipmentById]);

  const wallStyle = wallColors[activeWallId] || wallColors.back;
  const unplacedItems = document?.items.filter((item) => item.placement_mode === "unplaced").sort((a, b) => a.sort_order - b.sort_order) || [];
  const wallItems = document?.items.filter((item) => item.placement_mode === "wall" && item.wall_id === activeWallId).sort((a, b) => a.sort_order - b.sort_order) || [];
  const selectedIpamSummary = selectedItem?.equipment_item_id
    ? ipamSummaries[networkItems.findIndex((entry) => entry.equipment_item_id === selectedItem.equipment_item_id)]?.data || null
    : null;

  const moveItemToTarget = (draggedItemId: string, target: PlacementTarget, beforeItemId?: string | null) => updateDocument((current) => moveItemWithinDocument(current, draggedItemId, target, beforeItemId));
  const onDeleteItem = async (item: DigitalTwinItem) => {
    if (scope === "cabinet" && item.item_kind === "source-backed" && item.equipment_item_id) {
      await deleteCabinetItemMutation.mutateAsync(item.equipment_item_id);
      await syncMutation.mutateAsync();
      return;
    }
    if (item.item_kind === "manual") {
      updateDocument((current) => removeItemCompletely(current, item.id));
    }
  };
  const onSaveCabinetAdd = async () => {
    if (scope !== "cabinet" || !sourceId || !cabinetDraft.equipment_type_id) return;
    await updateEquipmentTypeMutation.mutateAsync({
      id: Number(cabinetDraft.equipment_type_id),
      payload: buildEquipmentTypeUpdatePayload(cabinetDraft),
    });
    await createCabinetItemMutation.mutateAsync({
      cabinet_id: sourceId,
      equipment_type_id: Number(cabinetDraft.equipment_type_id),
      quantity: 1,
    });
    await syncMutation.mutateAsync();
    setCabinetDraft(createNomenclatureDraft());
    setManualDialogOpen(false);
  };
  const onSaveSelectedItem = async () => {
    if (!selectedItem || !document) return;
    if (selectedItem.item_kind === "source-backed" && sourceEditDraft && selectedItem.equipment_type_id) {
      await updateEquipmentTypeMutation.mutateAsync({
        id: selectedItem.equipment_type_id,
        payload: buildEquipmentTypeUpdatePayload(sourceEditDraft),
      });
      const nextDocument = cloneDocument(document);
      const nextItem = nextDocument.items.find((entry) => entry.id === selectedItem.id);
      if (nextItem) nextItem.user_label = sourceEditDraft.user_label.trim() || null;
      await saveDocumentNow(nextDocument);
      await syncMutation.mutateAsync();
      return;
    }
    if (manualEditorDraft) {
      updateDocument((current) => {
        const entry = current.items.find((item) => item.id === selectedItem.id);
        if (entry) applyItemEditorDraft(entry, manualEditorDraft);
        return current;
      });
    }
  };

  if (!sourceId) {
    return <Alert severity="error">Не удалось определить идентификатор шкафа или сборки.</Alert>;
  }

  if (twinQuery.isPending || twinQuery.isLoading) {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t(scope === "assembly" ? "pagesUi.digitalTwin.titleAssembly" : "pagesUi.digitalTwin.titleCabinet")}
        </Typography>
        <Alert severity="info">{t("pagesUi.digitalTwin.states.loading")}</Alert>
      </Box>
    );
  }

  if (twinQuery.isError) {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t(scope === "assembly" ? "pagesUi.digitalTwin.titleAssembly" : "pagesUi.digitalTwin.titleCabinet")}
        </Typography>
        <Alert severity="error">
          Не удалось открыть состав. {describeQueryError(twinQuery.error, "Ошибка загрузки digital twin документа.")}
        </Alert>
      </Box>
    );
  }

  if (!record || !document) {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t(scope === "assembly" ? "pagesUi.digitalTwin.titleAssembly" : "pagesUi.digitalTwin.titleCabinet")}
        </Typography>
        <Alert severity="warning">
          Не удалось подготовить документ состава шкафа для отображения.
        </Alert>
      </Box>
    );
  }

  return (
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
            <Chip icon={<SaveRoundedIcon />} label={saveState === "saving" ? t("pagesUi.digitalTwin.states.saving") : saveState === "saved" ? t("pagesUi.digitalTwin.states.saved") : saveState === "error" ? t("pagesUi.digitalTwin.states.error") : t("pagesUi.digitalTwin.states.draft")} color={saveState === "saved" ? "success" : saveState === "error" ? "warning" : "default"} />
            <AppButton variant="outlined" startIcon={<AutorenewRoundedIcon />} onClick={() => syncMutation.mutate()} disabled={!canWrite || syncMutation.isPending}>{t("pagesUi.digitalTwin.actions.sync")}</AppButton>
            <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={() => updateDocument((current) => { current.rails.push({ id: `rail-${Date.now()}`, wall_id: activeWallId, name: t("pagesUi.digitalTwin.rails.defaultName", { index: rails.length + 1 }), length_mm: 600, sort_order: rails.length }); return current; })} disabled={!canWrite}>{t("pagesUi.digitalTwin.actions.addRail")}</AppButton>
          </Stack>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "320px minmax(0, 1fr) 360px" }, gap: 2 }}>
          <Card><CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">{t("pagesUi.digitalTwin.sections.domainModel")}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
              {document.walls.map((wall) => (
                <AppButton key={wall.id} variant={wall.id === activeWallId ? "contained" : "outlined"} size="small" onClick={() => updateDocument((current) => { current.ui.active_wall_id = wall.id; return current; })}>{wall.name}</AppButton>
              ))}
            </Box>
            <AppButton fullWidth variant="outlined" onClick={() => { if (scope === "cabinet") setCabinetDraft(createNomenclatureDraft()); else setManualDraft(createManualDraft()); setManualDialogOpen(true); }} disabled={!canWrite}>{t("pagesUi.digitalTwin.actions.addManual")}</AppButton>
            <DropArea title={t("pagesUi.digitalTwin.unplaced.title")} hint={t("pagesUi.digitalTwin.unplaced.hint")} onDropItem={(itemId) => moveItemToTarget(itemId, { placement_mode: "unplaced", wall_id: null, rail_id: null })}>
              {unplacedItems.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {unplacedItems.map((item) => (
                  <TwinCard key={item.id} item={item} selected={selectedItem?.id === item.id} usage={usageByItemId.get(item.id)} moveToStockLabel={t("pagesUi.digitalTwin.cards.moveToStock")} editLabel={t("pagesUi.digitalTwin.cards.edit")} deleteLabel={t("pagesUi.digitalTwin.cards.delete")} stockLabel={t("pagesUi.digitalTwin.cards.inStock")} outOfOperationLabel={t("pagesUi.digitalTwin.cards.outOfOperation")} noPowerLabel={t("pagesUi.digitalTwin.cards.noPower")} onSelect={() => updateDocument((current) => { current.ui.selected_item_id = item.id; return current; })} onDelete={scope === "cabinet" || item.item_kind === "manual" ? () => { void onDeleteItem(item); } : undefined} renderCurrentType={formatCurrentType} />
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
                  <DropArea key={rail.id} title={rail.name} hint={t("pagesUi.digitalTwin.rails.hint", { length: rail.length_mm, occupied, free: Math.max(rail.length_mm - occupied, 0) })} onDropItem={(itemId) => moveItemToTarget(itemId, { placement_mode: "rail", wall_id: rail.wall_id, rail_id: rail.id })}>
                    <Box sx={{ height: 8, borderRadius: 99, bgcolor: "rgba(15,23,42,0.10)", overflow: "hidden" }}><Box sx={{ width: `${Math.min(occupied / rail.length_mm, 1) * 100}%`, height: "100%", bgcolor: "#111827" }} /></Box>
                    {items.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {items.map((item) => (
                        <TwinCard key={item.id} item={item} selected={selectedItem?.id === item.id} usage={usageByItemId.get(item.id)} moveToStockLabel={t("pagesUi.digitalTwin.cards.moveToStock")} editLabel={t("pagesUi.digitalTwin.cards.edit")} deleteLabel={t("pagesUi.digitalTwin.cards.delete")} stockLabel={t("pagesUi.digitalTwin.cards.inStock")} outOfOperationLabel={t("pagesUi.digitalTwin.cards.outOfOperation")} noPowerLabel={t("pagesUi.digitalTwin.cards.noPower")} onSelect={() => updateDocument((current) => { current.ui.selected_item_id = item.id; return current; })} onMoveToStock={() => moveItemToTarget(item.id, { placement_mode: "unplaced", wall_id: null, rail_id: null })} onDelete={scope === "cabinet" || item.item_kind === "manual" ? () => { void onDeleteItem(item); } : undefined} onDropBefore={(draggedItemId, targetItemId) => moveItemToTarget(draggedItemId, { placement_mode: "rail", wall_id: rail.wall_id, rail_id: rail.id }, targetItemId)} renderCurrentType={formatCurrentType} />
                      ))}
                    </Box> : <Typography variant="body2" color="text.secondary">{t("pagesUi.digitalTwin.rails.empty")}</Typography>}
                  </DropArea>
                );
              })}
              <DropArea title={t("pagesUi.digitalTwin.freeMount.title")} hint={t("pagesUi.digitalTwin.freeMount.hint")} onDropItem={(itemId) => moveItemToTarget(itemId, { placement_mode: "wall", wall_id: activeWallId, rail_id: null })}>
                {wallItems.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {wallItems.map((item) => (
                    <TwinCard key={item.id} item={item} selected={selectedItem?.id === item.id} usage={usageByItemId.get(item.id)} moveToStockLabel={t("pagesUi.digitalTwin.cards.moveToStock")} editLabel={t("pagesUi.digitalTwin.cards.edit")} deleteLabel={t("pagesUi.digitalTwin.cards.delete")} stockLabel={t("pagesUi.digitalTwin.cards.inStock")} outOfOperationLabel={t("pagesUi.digitalTwin.cards.outOfOperation")} noPowerLabel={t("pagesUi.digitalTwin.cards.noPower")} onSelect={() => updateDocument((current) => { current.ui.selected_item_id = item.id; return current; })} onMoveToStock={() => moveItemToTarget(item.id, { placement_mode: "unplaced", wall_id: null, rail_id: null })} onDelete={scope === "cabinet" || item.item_kind === "manual" ? () => { void onDeleteItem(item); } : undefined} renderCurrentType={formatCurrentType} />
                  ))}
                </Box> : <Typography variant="body2" color="text.secondary">{t("pagesUi.digitalTwin.freeMount.empty")}</Typography>}
              </DropArea>
            </Box>
          </CardContent></Card>

          <Card><CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">{selectedItem ? "Свойства объекта" : "Свойства шкафа"}</Typography>
            {!selectedItem ? (
              <>
                <TextField size="small" label="Вводное напряжение" value={document.cabinet_properties.incoming_voltage || ""} onChange={(event) => updateDocument((current) => { current.cabinet_properties.incoming_voltage = event.target.value || null; return current; })} select>
                  <MenuItem value="">Не задано</MenuItem>
                  {cabinetSupplyVoltageOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                </TextField>
                <TextField size="small" label="Тип тока ввода" value={document.cabinet_properties.incoming_current_type || ""} onChange={(event) => updateDocument((current) => { current.cabinet_properties.incoming_current_type = event.target.value || null; return current; })} select>
                  <MenuItem value="">Не задано</MenuItem>
                  {cabinetCurrentTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                </TextField>
                <TextField size="small" label="Подпись ввода" value={document.cabinet_properties.incoming_label || ""} onChange={(event) => updateDocument((current) => { current.cabinet_properties.incoming_label = event.target.value || null; return current; })} />
                <Divider />
                <Typography variant="subtitle2">IP-адреса шкафа</Typography>
                <Typography variant="body2">{cabinetLinkedIps.join(", ") || "Нет назначенных адресов"}</Typography>
              </>
            ) : (
              <>
                <Typography variant="subtitle2">Номенклатура</Typography>
                <TextField size="small" label="Отображаемое имя" value={sourceEditDraft?.user_label ?? manualEditorDraft?.user_label ?? ""} onChange={(event) => {
                  if (sourceEditDraft) setSourceEditDraft({ ...sourceEditDraft, user_label: event.target.value });
                  if (manualEditorDraft) setManualEditorDraft({ ...manualEditorDraft, user_label: event.target.value });
                }} />
                <TextField size="small" label={t("pagesUi.digitalTwin.fields.name")} value={selectedItem.name} disabled />
                <TextField size="small" label="Производитель" value={selectedItem.manufacturer_name || "-"} disabled />
                <TextField size="small" label="Артикул" value={selectedItem.article || "-"} disabled />
                <TextField size="small" label="Номенклатура" value={selectedItem.nomenclature_number || "-"} disabled />
                <Divider />
                <Typography variant="subtitle2">Статусы</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {selectedItem.is_channel_forming ? <Chip size="small" icon={<MemoryRoundedIcon />} label="Каналообразующее" /> : null}
                  {selectedItem.is_network ? <Chip size="small" icon={<LanRoundedIcon />} label="Сетевое" /> : null}
                  {selectedItem.has_serial_interfaces ? <Chip size="small" icon={<CableRoundedIcon />} label="Последовательные интерфейсы" /> : null}
                  {selectedItem.source_status === "out_of_operation" ? <Chip size="small" color="warning" label="Вне эксплуатации" /> : null}
                </Stack>
                <Divider />
                <Typography variant="subtitle2">Экземпляр</Typography>
                {sourceEditDraft ? (
                  <>
                    <TextField select size="small" label={t("pagesUi.digitalTwin.fields.mountType")} value={sourceEditDraft.mount_type} onChange={(event) => setSourceEditDraft({ ...sourceEditDraft, mount_type: event.target.value as SourceBackedEditorDraft["mount_type"] })}>{mountTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}</TextField>
                    <TextField size="small" label={t("pagesUi.digitalTwin.fields.mountWidth")} type="number" value={sourceEditDraft.mount_width_mm} onChange={(event) => setSourceEditDraft({ ...sourceEditDraft, mount_width_mm: event.target.value })} />
                    <TextField select size="small" label={t("pagesUi.digitalTwin.fields.powerRole")} value={sourceEditDraft.role_in_power_chain} onChange={(event) => setSourceEditDraft({ ...sourceEditDraft, role_in_power_chain: event.target.value as SourceBackedEditorDraft["role_in_power_chain"] })}>{powerRoleOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}</TextField>
                    {(sourceEditDraft.role_in_power_chain === "source" || sourceEditDraft.role_in_power_chain === "consumer") ? <>
                      <TextField select size="small" label={t("pagesUi.digitalTwin.fields.currentType")} value={sourceEditDraft.current_type} onChange={(event) => setSourceEditDraft({ ...sourceEditDraft, current_type: event.target.value })}>{cabinetCurrentTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</TextField>
                      <TextField select size="small" label={t("pagesUi.digitalTwin.fields.supplyVoltage")} value={sourceEditDraft.supply_voltage} onChange={(event) => setSourceEditDraft({ ...sourceEditDraft, supply_voltage: event.target.value })}>{cabinetSupplyVoltageOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</TextField>
                      <TextField size="small" label={t("pagesUi.digitalTwin.fields.currentConsumption")} type="number" value={sourceEditDraft.current_value_a} onChange={(event) => setSourceEditDraft({ ...sourceEditDraft, current_value_a: event.target.value })} />
                    </> : null}
                  </>
                ) : manualEditorDraft ? (
                  <>
                    <TextField size="small" label={t("pagesUi.digitalTwin.fields.name")} value={manualEditorDraft.name} onChange={(event) => setManualEditorDraft({ ...manualEditorDraft, name: event.target.value })} />
                    <TextField select size="small" label={t("pagesUi.digitalTwin.fields.mountType")} value={manualEditorDraft.mount_type} onChange={(event) => setManualEditorDraft({ ...manualEditorDraft, mount_type: event.target.value as ItemEditorDraft["mount_type"] })}>{mountTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}</TextField>
                    <TextField size="small" label={t("pagesUi.digitalTwin.fields.mountWidth")} type="number" value={manualEditorDraft.mount_width_mm} onChange={(event) => setManualEditorDraft({ ...manualEditorDraft, mount_width_mm: event.target.value })} />
                    <TextField select size="small" label={t("pagesUi.digitalTwin.fields.currentType")} value={manualEditorDraft.current_type} onChange={(event) => setManualEditorDraft({ ...manualEditorDraft, current_type: event.target.value })}>{currentTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}</TextField>
                    <TextField size="small" label={t("pagesUi.digitalTwin.fields.supplyVoltage")} value={manualEditorDraft.supply_voltage} onChange={(event) => setManualEditorDraft({ ...manualEditorDraft, supply_voltage: event.target.value })} />
                  </>
                ) : null}
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {selectedItem.is_channel_forming && selectedItem.equipment_item_id ? <AppButton size="small" variant="outlined" startIcon={<DeviceHubRoundedIcon />} onClick={() => setSignalDialogOpen(true)}>Signal List</AppButton> : null}
                  {selectedItem.is_network && selectedItem.equipment_item_id ? <AppButton size="small" variant="outlined" startIcon={<SettingsEthernetRoundedIcon />} onClick={() => setIpamDialogOpen(true)}>IPAM</AppButton> : null}
                  {selectedItem.has_serial_interfaces && selectedItem.equipment_item_id ? <AppButton size="small" variant="outlined" startIcon={<CableRoundedIcon />} onClick={() => setSerialDialogOpen(true)}>Serial Map</AppButton> : null}
                </Stack>
                {selectedIpamSummary ? <Typography variant="body2" color="text.secondary">IP: {selectedIpamSummary.linked_ip_addresses.join(", ") || "Нет"}</Typography> : null}
                <AppButton onClick={() => { void onSaveSelectedItem(); }} disabled={!canWrite}>Сохранить свойства</AppButton>
              </>
            )}
          </CardContent></Card>
        </Box>

        <LocalErrorBoundary title="Ошибка блока графа питания">
          <PowerGraphCanvas
            document={document}
            canWrite={canWrite}
            validationIssues={validationIssues}
            updateDocument={updateDocument}
            setErrorMessage={setErrorMessage}
          />
        </LocalErrorBoundary>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, 1fr)" }, gap: 2 }}>
          <Card><CardContent sx={{ display: "grid", gap: 1 }}>
            <Typography variant="h6">{t("pagesUi.digitalTwin.sections.load")}</Typography>
            {["380VAC", "220VAC", "24VDC", "Other"].map((bucket) => <Typography key={bucket} variant="body2">{bucket}: {(loadSummary[bucket]?.power || 0).toFixed(1)} W / {(loadSummary[bucket]?.current || 0).toFixed(2)} A</Typography>)}
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
            {scope === "cabinet" ? (
              <>
                <SearchableSelectField label={t("common.fields.nomenclature")} value={cabinetDraft.equipment_type_id} options={nomenclatureOptions} hideEmptyOption onChange={(value) => { const equipment = equipmentById.get(Number(value)); setCabinetDraft(createNomenclatureDraft(equipment)); }} noOptionsLabel={equipmentTypesQuery.isLoading ? t("pagesUi.digitalTwin.states.loading") : undefined} />
                <TextField size="small" label={t("pagesUi.digitalTwin.fields.name")} value={cabinetDraft.name} disabled />
                <TextField select size="small" label={t("pagesUi.digitalTwin.fields.mountType")} value={cabinetDraft.mount_type} onChange={(event) => setCabinetDraft((current) => ({ ...current, mount_type: event.target.value as NomenclatureDraft["mount_type"] }))}>{mountTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}</TextField>
                <TextField size="small" label={t("pagesUi.digitalTwin.fields.mountWidth")} type="number" value={cabinetDraft.mount_width_mm} onChange={(event) => setCabinetDraft((current) => ({ ...current, mount_width_mm: event.target.value }))} />
                <TextField select size="small" label={t("pagesUi.digitalTwin.fields.powerRole")} value={cabinetDraft.role_in_power_chain} onChange={(event) => setCabinetDraft((current) => ({ ...current, role_in_power_chain: event.target.value as NomenclatureDraft["role_in_power_chain"] }))}>{powerRoleOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}</TextField>
                {(cabinetDraft.role_in_power_chain === "source" || cabinetDraft.role_in_power_chain === "consumer") ? <>
                  <TextField select size="small" label={t("pagesUi.digitalTwin.fields.currentType")} value={cabinetDraft.current_type} onChange={(event) => setCabinetDraft((current) => ({ ...current, current_type: event.target.value }))}>{cabinetCurrentTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</TextField>
                  <TextField select size="small" label={t("pagesUi.digitalTwin.fields.supplyVoltage")} value={cabinetDraft.supply_voltage} onChange={(event) => setCabinetDraft((current) => ({ ...current, supply_voltage: event.target.value }))}>{cabinetSupplyVoltageOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</TextField>
                </> : null}
              </>
            ) : (
              <>
                <TextField size="small" label={t("pagesUi.digitalTwin.fields.name")} value={manualDraft.name} onChange={(event) => setManualDraft((current) => ({ ...current, name: event.target.value }))} />
                <TextField select size="small" label={t("pagesUi.digitalTwin.fields.mountType")} value={manualDraft.mount_type} onChange={(event) => setManualDraft((current) => ({ ...current, mount_type: event.target.value as ManualItemDraft["mount_type"] }))}>{mountTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}</TextField>
                <TextField size="small" label={t("pagesUi.digitalTwin.fields.mountWidth")} type="number" value={manualDraft.mount_width_mm} onChange={(event) => setManualDraft((current) => ({ ...current, mount_width_mm: event.target.value }))} />
                <TextField select size="small" label={t("pagesUi.digitalTwin.fields.currentType")} value={manualDraft.current_type} onChange={(event) => setManualDraft((current) => ({ ...current, current_type: event.target.value }))}>{currentTypeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>)}</TextField>
                <TextField size="small" label={t("pagesUi.digitalTwin.fields.supplyVoltage")} value={manualDraft.supply_voltage} onChange={(event) => setManualDraft((current) => ({ ...current, supply_voltage: event.target.value }))} />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <AppButton variant="outlined" onClick={() => setManualDialogOpen(false)}>{t("actions.cancel")}</AppButton>
            <AppButton onClick={() => { if (scope === "cabinet") { void onSaveCabinetAdd(); return; } if (!manualDraft.name.trim()) return; updateDocument((current) => { const item = buildManualItem(manualDraft, activeWallId); item.sort_order = current.items.length; current.items.push(item); current.ui.selected_item_id = item.id; return current; }); setManualDraft(createManualDraft()); setManualDialogOpen(false); }} disabled={scope === "cabinet" ? !cabinetDraft.equipment_type_id : !manualDraft.name.trim()}>{t("actions.add")}</AppButton>
          </DialogActions>
        </Dialog>

        <SignalListDialog open={signalDialogOpen} item={selectedItem} onClose={() => setSignalDialogOpen(false)} onError={setErrorMessage} />
        <IpamDialog open={ipamDialogOpen} item={selectedItem} onClose={() => setIpamDialogOpen(false)} onError={setErrorMessage} />
        <SerialMapDialog open={serialDialogOpen} item={selectedItem} sourceContext={record.source_context} onClose={() => setSerialDialogOpen(false)} onError={setErrorMessage} />
        <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
      </Box>
  );
}

export function DigitalTwinPage() {
  return (
    <LocalErrorBoundary title="Ошибка экрана состава шкафа">
      <DigitalTwinPageInner />
    </LocalErrorBoundary>
  );
}

