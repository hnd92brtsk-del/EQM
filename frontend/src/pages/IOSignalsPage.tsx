import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  TextField,
  Typography,
  type SxProps,
  type Theme
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState, type TreeFieldOption } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { AppButton } from "../components/ui/AppButton";
import { useAuth } from "../context/AuthContext";
import {
  getIOTree,
  listIOSignals,
  rebuildIOSignals,
  updateIOSignal,
  type IOSignal,
  type IOTreeLocation,
  type IOTreeCabinet,
  type IOTreeChannelDevice
} from "../api/ioSignals";
import { buildMeasurementUnitLookups, fetchMeasurementUnitsTree } from "../utils/measurementUnits";
import { buildDataTypeLookups, fetchDataTypesTree } from "../utils/dataTypes";
import { buildFieldEquipmentLookups, fetchFieldEquipmentsTree } from "../utils/fieldEquipments";
import { buildSignalTypeLookups, fetchSignalTypesTree } from "../utils/signalTypes";
import { annotateLiveTree, type LiveTreeAnnotation } from "../utils/liveFilter";

const signalTypeOptions = [
  { value: "AI", label: "AI" },
  { value: "AO", label: "AO" },
  { value: "DI", label: "DI" },
  { value: "DO", label: "DO" }
];

type TreeSelectNode = {
  id: number;
  name: string;
  children?: TreeSelectNode[];
};

type IOTreeEntry =
  | {
      kind: "location";
      id: string;
      searchLabel: string;
      location: IOTreeLocation;
      children: IOTreeEntry[];
    }
  | {
      kind: "cabinet";
      id: string;
      searchLabel: string;
      cabinet: IOTreeCabinet;
      children: IOTreeEntry[];
    }
  | {
      kind: "device";
      id: string;
      searchLabel: string;
      device: IOTreeChannelDevice;
      children: IOTreeEntry[];
    };

type ColumnMeta = {
  headerSx?: SxProps<Theme>;
  cellSx?: SxProps<Theme>;
};

function buildTreeSelectOptions(nodes: TreeSelectNode[]): TreeFieldOption[] {
  return nodes.map((node) => ({
    value: node.id,
    label: node.name,
    children: buildTreeSelectOptions(node.children || [])
  }));
}

function buildDeviceEntry(device: IOTreeChannelDevice): IOTreeEntry {
  return {
    kind: "device",
    id: `device-${device.equipment_in_operation_id}`,
    searchLabel: [device.equipment_name, device.manufacturer_name, device.article, device.nomenclature_number]
      .filter(Boolean)
      .join(" "),
    device,
    children: []
  };
}

function buildCabinetEntry(cabinet: IOTreeCabinet): IOTreeEntry {
  return {
    kind: "cabinet",
    id: `cabinet-${cabinet.id}`,
    searchLabel: [cabinet.name, cabinet.factory_number, cabinet.inventory_number].filter(Boolean).join(" "),
    cabinet,
    children: (cabinet.channel_devices || []).map(buildDeviceEntry)
  };
}

function buildLocationEntry(location: IOTreeLocation): IOTreeEntry {
  return {
    kind: "location",
    id: `location-${location.id}`,
    searchLabel: location.name,
    location,
    children: [...(location.children || []).map(buildLocationEntry), ...(location.cabinets || []).map(buildCabinetEntry)]
  };
}

const ioColumnMeta: Record<string, ColumnMeta> = {
  channelIndex: {
    headerSx: { width: 96 },
    cellSx: { width: 96, whiteSpace: "nowrap" }
  },
  dataType: {
    headerSx: { width: 146 },
    cellSx: { width: 146 }
  },
  tag: {
    headerSx: { width: 84 },
    cellSx: { width: 84, whiteSpace: "nowrap" }
  },
  signal: {
    headerSx: { width: 108 },
    cellSx: { width: 108 }
  },
  signalType: {
    headerSx: { width: 84 },
    cellSx: { width: 84, whiteSpace: "nowrap" }
  },
  signalKind: {
    headerSx: { width: 88 },
    cellSx: { width: 88 }
  },
  fieldEquipment: {
    headerSx: { width: 248 },
    cellSx: { width: 248 }
  },
  connectionPoint: {
    headerSx: { width: 128 },
    cellSx: { width: 128, whiteSpace: "nowrap" }
  },
  units: {
    headerSx: { width: 156 },
    cellSx: { width: 156 }
  },
  status: {
    headerSx: { width: 104 },
    cellSx: { width: 104, whiteSpace: "nowrap" }
  },
  actions: {
    headerSx: { width: 120 },
    cellSx: { width: 120, whiteSpace: "nowrap" }
  }
};

export default function IOSignalsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [treeQuery, setTreeQuery] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<IOTreeChannelDevice | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ioTreeQuery = useQuery({
    queryKey: ["io-tree"],
    queryFn: getIOTree
  });

  const signalsQuery = useQuery({
    queryKey: ["io-signals", selectedDevice?.equipment_in_operation_id],
    queryFn: () => listIOSignals(selectedDevice!.equipment_in_operation_id),
    enabled: Boolean(selectedDevice)
  });

  const measurementUnitsTreeQuery = useQuery({
    queryKey: ["measurement-units-tree-options", false],
    queryFn: () => fetchMeasurementUnitsTree(false)
  });

  const signalTypesTreeQuery = useQuery({
    queryKey: ["signal-types-tree-options", false],
    queryFn: () => fetchSignalTypesTree(false)
  });

  const dataTypesTreeQuery = useQuery({
    queryKey: ["data-types-tree-options", false],
    queryFn: () => fetchDataTypesTree(false)
  });

  const fieldEquipmentsTreeQuery = useQuery({
    queryKey: ["field-equipments-tree-options", false],
    queryFn: () => fetchFieldEquipmentsTree(false)
  });

  const formatErrorMessage = (error: unknown, fallbackKey: string) => {
    if (error instanceof Error) {
      return error.message;
    }
    return t(fallbackKey);
  };

  useEffect(() => {
    if (ioTreeQuery.error) {
      setErrorMessage(formatErrorMessage(ioTreeQuery.error, "pagesUi.ioSignals.errors.loadTree"));
    }
  }, [ioTreeQuery.error, t]);

  useEffect(() => {
    if (signalsQuery.error) {
      setErrorMessage(formatErrorMessage(signalsQuery.error, "pagesUi.ioSignals.errors.loadSignals"));
    }
  }, [signalsQuery.error, t]);

  const { options: measurementUnitOptions, breadcrumbMap: measurementUnitBreadcrumbs, leafIds } =
    useMemo(() => buildMeasurementUnitLookups(measurementUnitsTreeQuery.data || []), [
      measurementUnitsTreeQuery.data
    ]);
  const measurementUnitLeafOptions = useMemo(
    () =>
      measurementUnitOptions
        .filter((option) => leafIds.has(option.value))
        .map((option) => ({
          ...option,
          label: measurementUnitBreadcrumbs.get(option.value) || option.label
        })),
    [measurementUnitOptions, measurementUnitBreadcrumbs, leafIds]
  );

  const {
    options: signalKindOptions,
    breadcrumbMap: signalKindBreadcrumbs,
    leafIds: signalKindLeafIds
  } = useMemo(() => buildSignalTypeLookups(signalTypesTreeQuery.data || []), [signalTypesTreeQuery.data]);

  const signalKindLeafOptions = useMemo(
    () =>
      signalKindOptions
        .filter((option) => signalKindLeafIds.has(option.value))
        .map((option) => ({
          ...option,
          label: signalKindBreadcrumbs.get(option.value) || option.label
        })),
    [signalKindOptions, signalKindBreadcrumbs, signalKindLeafIds]
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

  const refreshSignals = () => {
    queryClient.invalidateQueries({ queryKey: ["io-signals"] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<IOSignal> }) =>
      updateIOSignal(id, payload),
    onSuccess: refreshSignals,
    onError: (error) =>
      setErrorMessage(formatErrorMessage(error, "pagesUi.ioSignals.errors.update"))
  });

  const rebuildMutation = useMutation({
    mutationFn: (equipmentInOperationId: number) => rebuildIOSignals(equipmentInOperationId),
    onSuccess: refreshSignals,
    onError: (error) =>
      setErrorMessage(formatErrorMessage(error, "pagesUi.ioSignals.errors.rebuild"))
  });

  const toggleExpanded = (id: string) => {
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

  const locations = ioTreeQuery.data?.locations || [];

  const treeEntries = useMemo<IOTreeEntry[]>(
    () => locations.map(buildLocationEntry),
    [locations]
  );

  const treeAnnotations = useMemo(
    () =>
      annotateLiveTree(
        treeEntries,
        {
          getLabel: (entry) => entry.searchLabel,
          getChildren: (entry) => entry.children
        },
        treeQuery
      ),
    [treeEntries, treeQuery]
  );

  const renderDevice = (entry: LiveTreeAnnotation<IOTreeEntry>, level: number) => {
    if (entry.item.kind !== "device") {
      return null;
    }
    const device = entry.item.device;
    const isSelected = selectedDevice?.equipment_in_operation_id === device.equipment_in_operation_id;
    const labelParts = [
      device.manufacturer_name,
      device.article,
      device.nomenclature_number
    ].filter(Boolean);
    return (
      <Box
        key={`device-${device.equipment_in_operation_id}`}
        sx={{
          pl: `${level * 16 + 32}px`,
          py: 0.75,
          borderRadius: 1,
          cursor: "pointer",
          backgroundColor: isSelected ? "action.selected" : "transparent",
          "&:hover": { backgroundColor: "action.hover" }
        }}
        onClick={() => setSelectedDevice(device)}
      >
        <Typography sx={{ fontWeight: 500 }}>{device.equipment_name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {labelParts.length ? labelParts.join(" • ") : t("pagesUi.ioSignals.labels.channelDeviceMetaFallback")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          AI {device.ai_count} • DI {device.di_count} • AO {device.ao_count} • DO {device.do_count} •{" "}
          {t("pagesUi.ioSignals.labels.signalsTotal", { count: device.signals_total })}
        </Typography>
      </Box>
    );
  };

  const renderCabinet = (entry: LiveTreeAnnotation<IOTreeEntry>, level: number) => {
    if (entry.item.kind !== "cabinet") {
      return null;
    }
    const { cabinet, id } = entry.item;
    const expanded = treeQuery.trim() ? entry.shouldForceExpand : expandedIds.has(id);
    const hasChildren = entry.children.length > 0;
    const metaParts = [cabinet.factory_number, cabinet.inventory_number].filter(Boolean);
    return (
      <Box key={id}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            pl: `${level * 16}px`
          }}
        >
          {hasChildren ? (
            <IconButton size="small" onClick={() => toggleExpanded(id)}>
              {expanded ? <ExpandMoreRoundedIcon /> : <ChevronRightRoundedIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 36 }} />
          )}
          <Box sx={{ display: "grid" }}>
            <Typography sx={{ fontWeight: 600 }}>{cabinet.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {metaParts.length
                ? metaParts.join(" • ")
                : t("pagesUi.ioSignals.labels.cabinetMetaFallback")}
            </Typography>
          </Box>
        </Box>
        {hasChildren && (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {entry.children.map((child) => renderTreeEntry(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  const renderLocation = (entry: LiveTreeAnnotation<IOTreeEntry>, level: number) => {
    if (entry.item.kind !== "location") {
      return null;
    }
    const { location, id } = entry.item;
    const expanded = treeQuery.trim() ? entry.shouldForceExpand : expandedIds.has(id);
    const hasChildren = entry.children.length > 0;
    return (
      <Box key={id}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            pl: `${level * 16}px`
          }}
        >
          {hasChildren ? (
            <IconButton size="small" onClick={() => toggleExpanded(id)}>
              {expanded ? <ExpandMoreRoundedIcon /> : <ChevronRightRoundedIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 36 }} />
          )}
          <Typography sx={{ fontWeight: 700 }}>{location.name}</Typography>
        </Box>
        {hasChildren && (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {entry.children.map((child) => renderTreeEntry(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  const renderTreeEntry = (entry: LiveTreeAnnotation<IOTreeEntry>, level: number) => {
    switch (entry.item.kind) {
      case "location":
        return renderLocation(entry, level);
      case "cabinet":
        return renderCabinet(entry, level);
      case "device":
        return renderDevice(entry, level);
      default:
        return null;
    }
  };

  const columns = useMemo<ColumnDef<IOSignal>[]>(() => {
    const base: ColumnDef<IOSignal>[] = [
      {
        id: "channelIndex",
        header: t("pagesUi.ioSignals.columns.channelIndex"),
        meta: ioColumnMeta.channelIndex,
        cell: ({ row }) => `${row.original.signal_type}-${row.original.channel_index}`
      },
      {
        id: "dataType",
        header: t("pagesUi.ioSignals.columns.dataType"),
        meta: ioColumnMeta.dataType,
        cell: ({ row }) =>
          row.original.data_type_full_path ||
          (row.original.data_type_id
            ? dataTypeBreadcrumbs.get(row.original.data_type_id) || row.original.data_type_id
            : "-")
      },
      {
        id: "tag",
        header: t("pagesUi.ioSignals.columns.tag"),
        accessorKey: "tag",
        meta: ioColumnMeta.tag
      },
      {
        id: "signal",
        header: t("pagesUi.ioSignals.columns.signal"),
        accessorKey: "signal",
        meta: ioColumnMeta.signal
      },
      {
        id: "signalType",
        header: t("pagesUi.ioSignals.columns.signalType"),
        accessorKey: "signal_type",
        meta: ioColumnMeta.signalType
      },
      {
        id: "signalKind",
        header: t("pagesUi.ioSignals.columns.signalKind"),
        meta: ioColumnMeta.signalKind,
        cell: ({ row }) =>
          row.original.signal_kind_id
            ? signalKindBreadcrumbs.get(row.original.signal_kind_id) || row.original.signal_kind_id
            : "-"
      },
      {
        id: "fieldEquipment",
        header: t("pagesUi.ioSignals.columns.fieldEquipment"),
        meta: ioColumnMeta.fieldEquipment,
        cell: ({ row }) =>
          row.original.field_equipment_full_path ||
          (row.original.field_equipment_id
            ? fieldEquipmentBreadcrumbs.get(row.original.field_equipment_id) ||
              row.original.field_equipment_id
            : "-")
      },
      {
        id: "connectionPoint",
        header: t("pagesUi.ioSignals.columns.connectionPoint"),
        meta: ioColumnMeta.connectionPoint,
        cell: ({ row }) => row.original.connection_point || "-"
      },
      {
        id: "units",
        header: t("pagesUi.ioSignals.columns.units"),
        meta: ioColumnMeta.units,
        cell: ({ row }) =>
          row.original.measurement_unit_full_path ||
          (row.original.measurement_unit_id
            ? measurementUnitBreadcrumbs.get(row.original.measurement_unit_id) ||
              row.original.measurement_unit_id
            : "-")
      },
      {
        id: "status",
        header: t("common.status.label"),
        meta: ioColumnMeta.status,
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_active ? t("common.status.active") : t("common.status.inactive")}
          </span>
        )
      }
    ];

    if (canWrite) {
      base.push({
        id: "actions",
        header: t("actions.actions"),
        meta: ioColumnMeta.actions,
        cell: ({ row }) => (
          <AppButton
            size="small"
            startIcon={<EditRoundedIcon />}
            onClick={() =>
              setDialog({
                open: true,
                title: t("pagesUi.ioSignals.dialogs.editTitle"),
                fields: [
                  {
                    name: "signal_type",
                    label: t("pagesUi.ioSignals.fields.signalType"),
                    type: "select",
                    options: signalTypeOptions,
                    disabledWhen: () => true
                  },
                  {
                    name: "channel_index",
                    label: t("pagesUi.ioSignals.fields.channelIndex"),
                    type: "number",
                    disabledWhen: () => true
                  },
                  { name: "tag", label: t("pagesUi.ioSignals.fields.tag"), type: "text" },
                  { name: "signal", label: t("pagesUi.ioSignals.fields.signal"), type: "text" },
                  {
                    name: "data_type_id",
                    label: t("pagesUi.ioSignals.fields.dataType"),
                    type: "treeSelect",
                    treeOptions: dataTypeTreeOptions,
                    leafOnly: true
                  },
                  {
                    name: "signal_kind_id",
                    label: t("pagesUi.ioSignals.fields.signalKind"),
                    type: "select",
                    options: signalKindLeafOptions
                  },
                  {
                    name: "field_equipment_id",
                    label: t("pagesUi.ioSignals.fields.fieldEquipment"),
                    type: "treeSelect",
                    treeOptions: fieldEquipmentTreeOptions,
                    leafOnly: true
                  },
                  {
                    name: "connection_point",
                    label: t("pagesUi.ioSignals.fields.connectionPoint"),
                    type: "text"
                  },
                  {
                    name: "measurement_unit_id",
                    label: t("pagesUi.ioSignals.fields.units"),
                    type: "select",
                    options: measurementUnitLeafOptions
                  },
                  { name: "is_active", label: t("pagesUi.ioSignals.fields.status"), type: "checkbox" }
                ],
                values: {
                  ...row.original,
                  measurement_unit_id: row.original.measurement_unit_id ?? "",
                  data_type_id: row.original.data_type_id ?? "",
                  signal_kind_id: row.original.signal_kind_id ?? "",
                  field_equipment_id: row.original.field_equipment_id ?? "",
                  connection_point: row.original.connection_point ?? ""
                },
                onSave: (values) => {
                  const measurementUnitId =
                    values.measurement_unit_id === "" || values.measurement_unit_id === undefined
                      ? null
                      : Number(values.measurement_unit_id);
                  const dataTypeId =
                    values.data_type_id === "" || values.data_type_id === undefined
                      ? null
                      : Number(values.data_type_id);
                  const signalKindId =
                    values.signal_kind_id === "" || values.signal_kind_id === undefined
                      ? null
                      : Number(values.signal_kind_id);
                  const fieldEquipmentId =
                    values.field_equipment_id === "" || values.field_equipment_id === undefined
                      ? null
                      : Number(values.field_equipment_id);
                  const connectionPoint =
                    values.connection_point === "" || values.connection_point === undefined
                      ? null
                      : String(values.connection_point);
                  updateMutation.mutate({
                    id: row.original.id,
                    payload: {
                      tag: values.tag,
                      signal: values.signal,
                      data_type_id: dataTypeId,
                      signal_kind_id: signalKindId,
                      field_equipment_id: fieldEquipmentId,
                      connection_point: connectionPoint,
                      measurement_unit_id: measurementUnitId,
                      is_active: values.is_active
                    }
                  });
                  setDialog(null);
                }
              })
            }
          >
            {t("actions.edit")}
          </AppButton>
        )
      });
    }

    return base;
  }, [
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
    updateMutation
  ]);
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.ioSignals")}</Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 380px) minmax(0, 1fr)" },
          alignItems: "start"
        }}
      >
        <Card>
          <CardContent sx={{ display: "grid", gap: 1 }}>
            <Typography variant="h6">{t("pagesUi.ioSignals.labels.locations")}</Typography>
            <TextField
              size="small"
              value={treeQuery}
              onChange={(event) => setTreeQuery(event.target.value)}
              placeholder={t("common.liveFilter.searchPlaceholder")}
            />
            {locations.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("pagesUi.ioSignals.empty.tree")}
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gap: 0.5 }}>
                {treeAnnotations.map((entry) => renderTreeEntry(entry, 0))}
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ display: "grid" }}>
                <Typography variant="h6">
                  {selectedDevice
                    ? selectedDevice.equipment_name
                    : t("pagesUi.ioSignals.labels.selectEquipment")}
                </Typography>
                {selectedDevice ? (
                  <Typography variant="body2" color="text.secondary">
                    {[
                      selectedDevice.manufacturer_name,
                      selectedDevice.article,
                      selectedDevice.nomenclature_number
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </Typography>
                ) : null}
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              {selectedDevice && (
                <AppButton
                  startIcon={<SyncRoundedIcon />}
                  onClick={() => rebuildMutation.mutate(selectedDevice.equipment_in_operation_id)}
                  disabled={!canWrite || rebuildMutation.isPending}
                >
                  {t("pagesUi.ioSignals.actions.rebuild")}
                </AppButton>
              )}
            </Box>

            {!selectedDevice ? (
              <Typography variant="body2" color="text.secondary">
                {t("pagesUi.ioSignals.empty.select")}
              </Typography>
            ) : signalsQuery.data && signalsQuery.data.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("pagesUi.ioSignals.empty.noSignals")}
              </Typography>
            ) : (
              <DataTable
                data={signalsQuery.data || []}
                columns={columns}
                tableSx={{ tableLayout: "fixed", minWidth: 1280 }}
              />
            )}
          </CardContent>
        </Card>
      </Box>

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
