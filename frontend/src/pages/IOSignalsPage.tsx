import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  TextField,
  Typography
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { EntityImportExportIconActions } from "../components/EntityImportExportIconActions";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { AppButton } from "../components/ui/AppButton";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
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
import {
  buildIOSignalColumns,
  buildIOSignalUpdatePayload,
  buildTreeSelectOptions,
  createIOSignalEditDialogState,
  ioSignalTypeOptions,
  type TreeSelectNode,
} from "../features/ioSignals/shared";

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

export default function IOSignalsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "engineering", "write");
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
    const isNavigationLocation = (location.cabinets?.length || 0) === 0 && (location.children?.length || 0) > 0;
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
          <Typography sx={{ fontWeight: isNavigationLocation ? 800 : 700 }}>
            {location.name}
          </Typography>
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

  const columns = useMemo<ColumnDef<IOSignal>[]>(
    () =>
      buildIOSignalColumns({
        t,
        canWrite,
        lookupMaps: {
          dataTypeBreadcrumbs,
          signalKindBreadcrumbs,
          fieldEquipmentBreadcrumbs,
          measurementUnitBreadcrumbs
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
                fieldEquipmentTreeOptions
              },
              onSave: (values) =>
                updateMutation.mutateAsync({
                  id: signal.id,
                  payload: buildIOSignalUpdatePayload(values)
                }).then(() => undefined)
            })
          )
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
              <EntityImportExportIconActions
                basePath="/io-signals"
                filenamePrefix={
                  selectedDevice
                    ? `io-signals-${selectedDevice.equipment_in_operation_id}`
                    : "io-signals"
                }
                exportParams={{
                  equipment_in_operation_id: selectedDevice?.equipment_in_operation_id || undefined
                }}
                importParams={{
                  equipment_in_operation_id: selectedDevice?.equipment_in_operation_id || undefined
                }}
                canWrite={canWrite}
                disabled={!selectedDevice}
                disabledReason={t("pagesUi.ioSignals.labels.selectEquipment")}
                onCommitted={refreshSignals}
              />
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
