import { useEffect, useMemo, useState } from "react";
import {
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
import { SearchableSelectField } from "../components/SearchableSelectField";
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
import { hasPermission } from "../utils/permissions";
import { fetchLocationsTree, buildLocationLookups } from "../utils/locations";
import { buildMainEquipmentLookups, fetchMainEquipmentTree } from "../utils/mainEquipment";

const pageSizeOptions = [10, 20, 50, 100];

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

  const openCreateDialog = () => {
    setDialog({
      open: true,
      title: t("pagesUi.technologicalEquipment.dialogs.createTitle"),
      fields: [
        { name: "name", label: t("common.fields.name"), type: "text" },
        {
          name: "main_equipment_id",
          label: t("pagesUi.technologicalEquipment.fields.type"),
          type: "select",
          options: mainEquipmentLookups.options,
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
        name: "",
        main_equipment_id: "",
        tag: "",
        location_id: "",
        description: "",
      },
      onSave: async (values) => {
        await createMutation.mutateAsync({
          name: values.name,
          main_equipment_id: Number(values.main_equipment_id),
          tag: values.tag || null,
          location_id: values.location_id === "" ? null : Number(values.location_id),
          description: values.description || null,
        });
        setDialog(null);
      },
    });
  };

  const openEditDialog = (item: TechnologicalEquipment) => {
    setDialog({
      open: true,
      title: t("pagesUi.technologicalEquipment.dialogs.editTitle"),
      fields: [
        { name: "name", label: t("common.fields.name"), type: "text" },
        {
          name: "main_equipment_id",
          label: t("pagesUi.technologicalEquipment.fields.type"),
          type: "select",
          options: mainEquipmentLookups.options,
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
        name: item.name,
        main_equipment_id: item.main_equipment_id,
        tag: item.tag || "",
        location_id: item.location_id || "",
        description: item.description || "",
      },
      onSave: async (values) => {
        await updateMutation.mutateAsync({
          id: item.id,
          payload: {
            name: values.name,
            main_equipment_id: Number(values.main_equipment_id),
            tag: values.tag || null,
            location_id: values.location_id === "" ? null : Number(values.location_id),
            description: values.description || null,
          },
        });
        setDialog(null);
      },
    });
  };

  const columns = useMemo<ColumnDef<TechnologicalEquipment>[]>(() => {
    const base: ColumnDef<TechnologicalEquipment>[] = [
      { header: t("common.fields.name"), accessorKey: "name" },
      {
        header: t("pagesUi.technologicalEquipment.fields.type"),
        cell: ({ row }) =>
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
            <AppButton size="small" startIcon={<EditRoundedIcon />} onClick={() => openEditDialog(row.original)}>
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
    locationTreeOptions,
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
            <Box sx={{ minWidth: 280, flex: "1 1 280px" }}>
              <SearchableSelectField
                label={t("pagesUi.technologicalEquipment.fields.type")}
                value={mainEquipmentFilter}
                options={mainEquipmentLookups.options}
                onChange={(value) => {
                  setMainEquipmentFilter(value);
                  setPage(1);
                }}
                placeholder={t("actions.notSelected")}
                emptyOptionLabel={t("actions.notSelected")}
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
              <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateDialog}>
                {t("pagesUi.technologicalEquipment.actions.add")}
              </AppButton>
            ) : null}
          </Box>
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
