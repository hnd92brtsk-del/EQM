import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  TablePagination,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, type DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import {
  SearchableTreeSelectField,
  type SearchableTreeSelectOption,
} from "../components/SearchableTreeSelectField";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import {
  createTechnologicalEquipment,
  deleteTechnologicalEquipment,
  listTechnologicalEquipment,
  restoreTechnologicalEquipment,
  type TechnologicalEquipment,
  updateTechnologicalEquipment,
} from "../api/technologicalEquipment";
import { useAuth } from "../context/AuthContext";
import { fetchLocationsTree, buildLocationLookups } from "../utils/locations";
import { buildMainEquipmentLookups, fetchMainEquipmentTree } from "../utils/mainEquipment";
import { hasPermission } from "../utils/permissions";

const pageSizeOptions = [10, 20, 50, 100];

function toOptionalNumber(value: number | string | null | undefined): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

export default function TechnologicalEquipmentRegistryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "equipment", "write");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [mainEquipmentFilter, setMainEquipmentFilter] = useState<number | string>("");
  const [locationFilter, setLocationFilter] = useState<number | string>("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const technologicalEquipmentQuery = useQuery({
    queryKey: [
      "technological-equipment",
      page,
      pageSize,
      q,
      mainEquipmentFilter,
      locationFilter,
      showDeleted,
    ],
    queryFn: () =>
      listTechnologicalEquipment({
        page,
        page_size: pageSize,
        q: q || undefined,
        main_equipment_id: mainEquipmentFilter === "" ? undefined : Number(mainEquipmentFilter),
        location_id: locationFilter === "" ? undefined : Number(locationFilter),
        include_deleted: showDeleted ? true : undefined,
        sort: "name",
      }),
  });

  const mainEquipmentQuery = useQuery({
    queryKey: ["technological-equipment-main-equipment-options"],
    queryFn: () => fetchMainEquipmentTree(false),
  });

  const locationsQuery = useQuery({
    queryKey: ["technological-equipment-location-options"],
    queryFn: () => fetchLocationsTree(false),
  });

  useEffect(() => {
    if (technologicalEquipmentQuery.error) {
      setErrorMessage(
        technologicalEquipmentQuery.error instanceof Error
          ? technologicalEquipmentQuery.error.message
          : t("errors.load_technological_equipment_failed"),
      );
    }
  }, [technologicalEquipmentQuery.error, t]);

  const mainEquipmentLookups = useMemo(
    () => buildMainEquipmentLookups(mainEquipmentQuery.data || []),
    [mainEquipmentQuery.data],
  );

  const locationLookups = useMemo(
    () => buildLocationLookups(locationsQuery.data || []),
    [locationsQuery.data],
  );

  const locationTreeOptions = useMemo(() => {
    const mapNode = (node: {
      id: number;
      name: string;
      children?: { id: number; name: string; children?: unknown[] }[];
    }): SearchableTreeSelectOption => ({
      label: node.name,
      value: node.id,
      children: node.children?.map((child) =>
        mapNode(child as { id: number; name: string; children?: { id: number; name: string; children?: unknown[] }[] }),
      ),
    });

    return (locationsQuery.data || []).map((node) => mapNode(node));
  }, [locationsQuery.data]);

  const isValveTypeSelection = (value: number | string | null | undefined) => {
    const numeric = toOptionalNumber(value);
    return numeric !== null && mainEquipmentLookups.valveTypeIds.has(numeric);
  };

  const isMisconfiguredValveSelection = (value: number | string | null | undefined) => {
    const numeric = toOptionalNumber(value);
    return numeric !== null && mainEquipmentLookups.misconfiguredValveLeafIds.has(numeric);
  };

  const isDialogSaveBlocked = (values: Record<string, unknown>) => {
    const mainEquipmentId = toOptionalNumber(values.main_equipment_id as number | string | null | undefined);
    const mainEquipmentDriveId = toOptionalNumber(
      values.main_equipment_drive_id as number | string | null | undefined,
    );

    if (mainEquipmentId === null) {
      return true;
    }
    if (isMisconfiguredValveSelection(mainEquipmentId)) {
      return true;
    }
    if (isValveTypeSelection(mainEquipmentId) && mainEquipmentDriveId === null) {
      return true;
    }
    if (!isValveTypeSelection(mainEquipmentId) && mainEquipmentDriveId !== null) {
      return true;
    }
    return false;
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["technological-equipment"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Partial<TechnologicalEquipment>) => createTechnologicalEquipment(payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.create_technological_equipment_failed"),
      ),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TechnologicalEquipment> }) =>
      updateTechnologicalEquipment(id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.update_technological_equipment_failed"),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTechnologicalEquipment(id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.delete_technological_equipment_failed"),
      ),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreTechnologicalEquipment(id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.restore_technological_equipment_failed"),
      ),
  });

  const buildDialogState = (item?: TechnologicalEquipment): DialogState => ({
    open: true,
    title: item
      ? t("pagesUi.technologicalEquipment.dialogs.editTitle")
      : t("pagesUi.technologicalEquipment.dialogs.createTitle"),
    fields: [
      { name: "name", label: t("common.fields.name"), type: "text" },
      {
        name: "main_equipment_id",
        label: t("pagesUi.technologicalEquipment.fields.type"),
        type: "treeSelect",
        treeOptions: mainEquipmentLookups.primaryTreeOptions,
        leafOnly: true,
        onChange: (value) => {
          if (!isValveTypeSelection(value)) {
            return { main_equipment_drive_id: "" };
          }
          return undefined;
        },
      },
      {
        name: "main_equipment_drive_id",
        label: t("pagesUi.technologicalEquipment.fields.driveType"),
        type: "treeSelect",
        treeOptions: mainEquipmentLookups.driveTreeOptions,
        leafOnly: true,
        visibleWhen: (values) => isValveTypeSelection(values.main_equipment_id),
      },
      { name: "tag", label: t("pagesUi.technologicalEquipment.fields.tag"), type: "text" },
      {
        name: "location_id",
        label: t("common.fields.location"),
        type: "treeSelect",
        treeOptions: locationTreeOptions,
      },
      {
        name: "description",
        label: t("pagesUi.technologicalEquipment.fields.description"),
        type: "text",
        multiline: true,
        rows: 4,
      },
    ],
    values: {
      name: item?.name || "",
      main_equipment_id: item?.main_equipment_id || "",
      main_equipment_drive_id: item?.main_equipment_drive_id || "",
      tag: item?.tag || "",
      location_id: item?.location_id || "",
      description: item?.description || "",
    },
    renderExtra: (values) => {
      const showValveConfigWarning =
        Boolean(mainEquipmentLookups.valveRootId) &&
        !mainEquipmentLookups.valveConfigurationValid &&
        (isMisconfiguredValveSelection(values.main_equipment_id) || !values.main_equipment_id);

      const showDriveHint =
        isValveTypeSelection(values.main_equipment_id) &&
        values.main_equipment_drive_id === "";

      if (!showValveConfigWarning && !showDriveHint) {
        return null;
      }

      return (
        <Box sx={{ display: "grid", gap: 1 }}>
          {isValveTypeSelection(values.main_equipment_id) ? (
            <Alert severity="info">
              {t("pagesUi.technologicalEquipment.messages.valveStepFlow")}
            </Alert>
          ) : null}
          {showValveConfigWarning ? (
            <Alert severity="warning">
              {t("pagesUi.technologicalEquipment.messages.valveConfigurationMissing")}
            </Alert>
          ) : null}
          {showDriveHint ? (
            <Alert severity="info">
              {t("pagesUi.technologicalEquipment.messages.driveRequired")}
            </Alert>
          ) : null}
        </Box>
      );
    },
    disableSaveWhen: isDialogSaveBlocked,
    onSave: async (values) => {
      const mainEquipmentId = toOptionalNumber(values.main_equipment_id);
      const mainEquipmentDriveId = toOptionalNumber(values.main_equipment_drive_id);
      const locationId = toOptionalNumber(values.location_id);

      if (mainEquipmentId === null) {
        throw new Error(t("pagesUi.technologicalEquipment.messages.typeRequired"));
      }
      if (isMisconfiguredValveSelection(mainEquipmentId)) {
        throw new Error(t("pagesUi.technologicalEquipment.messages.valveConfigurationMissing"));
      }
      if (isValveTypeSelection(mainEquipmentId) && mainEquipmentDriveId === null) {
        throw new Error(t("pagesUi.technologicalEquipment.messages.driveRequired"));
      }
      if (!isValveTypeSelection(mainEquipmentId) && mainEquipmentDriveId !== null) {
        throw new Error(t("pagesUi.technologicalEquipment.messages.driveOnlyForValve"));
      }

      const payload: Partial<TechnologicalEquipment> = {
        name: values.name,
        tag: values.tag || null,
        location_id: locationId,
        description: values.description || null,
      };

      if (item) {
        if (item.main_equipment_id !== mainEquipmentId) {
          payload.main_equipment_id = mainEquipmentId;
        }
        const normalizedDriveId = isValveTypeSelection(mainEquipmentId) ? mainEquipmentDriveId : null;
        if ((item.main_equipment_drive_id || null) !== normalizedDriveId) {
          payload.main_equipment_drive_id = normalizedDriveId;
        }
        await updateMutation.mutateAsync({ id: item.id, payload });
      } else {
        payload.main_equipment_id = mainEquipmentId;
        payload.main_equipment_drive_id = isValveTypeSelection(mainEquipmentId) ? mainEquipmentDriveId : null;
        await createMutation.mutateAsync(payload);
      }
      setDialog(null);
    },
  });

  const columns = useMemo<ColumnDef<TechnologicalEquipment>[]>(() => {
    const base: ColumnDef<TechnologicalEquipment>[] = [
      { header: t("common.fields.name"), accessorKey: "name" },
      {
        header: t("pagesUi.technologicalEquipment.fields.type"),
        cell: ({ row }) =>
          row.original.type_display ||
          row.original.main_equipment_full_path ||
          row.original.main_equipment_name ||
          mainEquipmentLookups.breadcrumbMap.get(row.original.main_equipment_id) ||
          "-",
      },
      {
        header: t("pagesUi.technologicalEquipment.fields.tag"),
        cell: ({ row }) => row.original.tag || "-",
      },
      {
        header: t("common.fields.location"),
        cell: ({ row }) =>
          row.original.location_path ||
          row.original.location_name ||
          (row.original.location_id ? locationLookups.breadcrumbMap.get(row.original.location_id) : null) ||
          "-",
      },
      {
        header: t("pagesUi.technologicalEquipment.fields.description"),
        cell: ({ row }) => row.original.description || "-",
      },
    ];

    if (canWrite) {
      base.push({
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
        ),
      });
      base.push({
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <AppButton size="small" startIcon={<EditRoundedIcon />} onClick={() => setDialog(buildDialogState(row.original))}>
              {t("actions.edit")}
            </AppButton>
            {row.original.is_deleted ? (
              <AppButton
                size="small"
                color="success"
                startIcon={<RestoreRoundedIcon />}
                onClick={() => restoreMutation.mutate(row.original.id)}
              >
                {t("actions.restore")}
              </AppButton>
            ) : (
              <AppButton
                size="small"
                color="error"
                startIcon={<DeleteOutlineRoundedIcon />}
                onClick={() => deleteMutation.mutate(row.original.id)}
              >
                {t("actions.delete")}
              </AppButton>
            )}
          </Box>
        ),
      });
    }

    return base;
  }, [
    canWrite,
    deleteMutation,
    locationLookups.breadcrumbMap,
    mainEquipmentLookups.breadcrumbMap,
    restoreMutation,
    t,
  ]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("menu.technological_equipment")}</Typography>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              label={t("actions.search")}
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 320 }}
            />
            <Box sx={{ minWidth: 320, flex: "1 1 320px" }}>
              <SearchableTreeSelectField
                label={t("pagesUi.technologicalEquipment.fields.type")}
                value={mainEquipmentFilter}
                options={mainEquipmentLookups.primaryTreeOptions}
                onChange={(value) => {
                  setMainEquipmentFilter(value);
                  setPage(1);
                }}
                placeholder={t("actions.notSelected")}
                emptyOptionLabel={t("actions.notSelected")}
                leafOnly
                groupOnlyLabel={t("common.treeSelect.groupOnly")}
              />
            </Box>
            <Box sx={{ minWidth: 320, flex: "1 1 320px" }}>
              <SearchableTreeSelectField
                label={t("common.fields.location")}
                value={locationFilter}
                options={locationTreeOptions}
                onChange={(value) => {
                  setLocationFilter(value);
                  setPage(1);
                }}
                placeholder={t("actions.notSelected")}
                emptyOptionLabel={t("actions.notSelected")}
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showDeleted}
                  onChange={(event) => {
                    setShowDeleted(event.target.checked);
                    setPage(1);
                  }}
                />
              }
              label={t("common.showDeleted")}
            />
            {canWrite ? (
              <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialog(buildDialogState())}>
                {t("pagesUi.technologicalEquipment.actions.add")}
              </AppButton>
            ) : null}
          </Box>
          {!mainEquipmentLookups.valveConfigurationValid && mainEquipmentLookups.valveRootId ? (
            <Alert severity="warning">
              {t("pagesUi.technologicalEquipment.messages.valveConfigurationMissing")}
            </Alert>
          ) : null}
          <DataTable
            data={technologicalEquipmentQuery.data?.items || []}
            columns={columns}
            emptyMessage={t("dashboard.common.no_data")}
          />
          <TablePagination
            component="div"
            count={technologicalEquipmentQuery.data?.total || 0}
            page={page - 1}
            onPageChange={(_, nextPage) => setPage(nextPage + 1)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            rowsPerPageOptions={pageSizeOptions}
            {...getTablePaginationProps(t)}
          />
        </CardContent>
      </Card>
      {dialog ? <EntityDialog state={dialog} onClose={() => setDialog(null)} /> : null}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
