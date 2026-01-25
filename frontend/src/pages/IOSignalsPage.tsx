import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  Typography
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
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
import { buildSignalTypeLookups, fetchSignalTypesTree } from "../utils/signalTypes";

const signalTypeOptions = [
  { value: "AI", label: "AI" },
  { value: "AO", label: "AO" },
  { value: "DI", label: "DI" },
  { value: "DO", label: "DO" }
];

const measurementOptions = [
  { value: "4-20mA (AI)", label: "4-20mA (AI)" },
  { value: "0-20mA (AI)", label: "0-20mA (AI)" },
  { value: "0-10V (AI)", label: "0-10V (AI)" },
  { value: "Pt100 (RTD AI)", label: "Pt100 (RTD AI)" },
  { value: "Pt1000 (RTD AI)", label: "Pt1000 (RTD AI)" },
  { value: "M50 (RTD AI)", label: "M50 (RTD AI)" },
  { value: "24V (DI)", label: "24V (DI)" },
  { value: "220V (DI)", label: "220V (DI)" },
  { value: "8-16mA (DI)", label: "8-16mA (DI)" }
];

export default function IOSignalsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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

  const renderDevice = (device: IOTreeChannelDevice, level: number) => {
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

  const renderCabinet = (cabinet: IOTreeCabinet, level: number) => {
    const id = `cabinet-${cabinet.id}`;
    const expanded = expandedIds.has(id);
    const hasChildren = (cabinet.channel_devices || []).length > 0;
    const metaParts = [cabinet.factory_number, cabinet.inventory_number].filter(Boolean);
    return (
      <Box key={id}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: `${level * 16}px` }}>
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
              {cabinet.channel_devices.map((device) => renderDevice(device, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  const renderLocation = (location: IOTreeLocation, level: number) => {
    const id = `location-${location.id}`;
    const expanded = expandedIds.has(id);
    const children = location.children || [];
    const cabinets = location.cabinets || [];
    const hasChildren = children.length > 0 || cabinets.length > 0;
    return (
      <Box key={id}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: `${level * 16}px` }}>
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
              {children.map((child) => renderLocation(child, level + 1))}
              {cabinets.map((cabinet) => renderCabinet(cabinet, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  const columns = useMemo<ColumnDef<IOSignal>[]>(() => {
    const base: ColumnDef<IOSignal>[] = [
      {
        header: t("pagesUi.ioSignals.columns.channelIndex"),
        cell: ({ row }) => `${row.original.signal_type}-${row.original.channel_index}`
      },
      { header: t("pagesUi.ioSignals.columns.tag"), accessorKey: "tag" },
      { header: t("pagesUi.ioSignals.columns.signal"), accessorKey: "signal" },
      { header: t("pagesUi.ioSignals.columns.signalType"), accessorKey: "signal_type" },
      {
        header: t("pagesUi.ioSignals.columns.signalKind"),
        cell: ({ row }) =>
          row.original.signal_kind_id
            ? signalKindBreadcrumbs.get(row.original.signal_kind_id) || row.original.signal_kind_id
            : "-"
      },
      { header: t("pagesUi.ioSignals.columns.measurementType"), accessorKey: "measurement_type" },
      {
        header: t("pagesUi.ioSignals.columns.units"),
        cell: ({ row }) =>
          row.original.measurement_unit_full_path ||
          (row.original.measurement_unit_id
            ? measurementUnitBreadcrumbs.get(row.original.measurement_unit_id) ||
              row.original.measurement_unit_id
            : "-")
      },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_active ? t("common.status.active") : t("common.status.inactive")}
          </span>
        )
      }
    ];

    if (canWrite) {
      base.push({
        header: t("actions.actions"),
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
                    name: "signal_kind_id",
                    label: t("pagesUi.ioSignals.fields.signalKind"),
                    type: "select",
                    options: signalKindLeafOptions
                  },
                  {
                    name: "measurement_type",
                    label: t("pagesUi.ioSignals.fields.measurementType"),
                    type: "select",
                    options: measurementOptions
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
                  signal_kind_id: row.original.signal_kind_id ?? "",
                  measurement_type: row.original.measurement_type ?? ""
                },
                onSave: (values) => {
                  const measurementUnitId =
                    values.measurement_unit_id === "" || values.measurement_unit_id === undefined
                      ? null
                      : Number(values.measurement_unit_id);
                  const signalKindId =
                    values.signal_kind_id === "" || values.signal_kind_id === undefined
                      ? null
                      : Number(values.signal_kind_id);
                  const measurementType = values.measurement_type === "" ? null : values.measurement_type;
                  updateMutation.mutate({
                    id: row.original.id,
                    payload: {
                      tag: values.tag,
                      signal: values.signal,
                      signal_kind_id: signalKindId,
                      measurement_type: measurementType,
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
    measurementUnitBreadcrumbs,
    measurementUnitLeafOptions,
    signalKindBreadcrumbs,
    signalKindLeafOptions,
    t,
    updateMutation
  ]);

  const locations = ioTreeQuery.data?.locations || [];

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
            {locations.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("pagesUi.ioSignals.empty.tree")}
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gap: 0.5 }}>
                {locations.map((location) => renderLocation(location, 0))}
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
              <DataTable data={signalsQuery.data || []} columns={columns} />
            )}
          </CardContent>
        </Card>
      </Box>

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
