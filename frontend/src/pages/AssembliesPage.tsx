import { useEffect, useMemo, useState } from "react";
import {
  Box,Card,
  CardContent,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TablePagination,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { type ColumnMeta, DataTable, type DataTableFiltersState } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { buildLocationLookups, fetchLocationsTree } from "../utils/locations";

type Assembly = {
  id: number;
  name: string;
  factory_number?: string | null;
  nomenclature_number?: string | null;
  location_id?: number | null;
  location_full_path?: string | null;
  is_deleted: boolean;
  created_at?: string;
};

const pageSizeOptions = [10, 20, 50, 100];

export default function AssembliesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("-created_at");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: "name", label: t("pagesUi.assemblies.sort.byNameAsc") },
      { value: "-name", label: t("pagesUi.assemblies.sort.byNameDesc") },
      { value: "created_at", label: t("pagesUi.assemblies.sort.byCreatedOldest") },
      { value: "-created_at", label: t("pagesUi.assemblies.sort.byCreatedNewest") }
    ],
    [t]
  );

  const assembliesQuery = useQuery({
    queryKey: ["assemblies", page, pageSize, sort, columnFilters, showDeleted],
    queryFn: () =>
      listEntity<Assembly>("/assemblies", {
        page,
        page_size: pageSize,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          name: columnFilters.name || undefined,
          name_alphabet: columnFilters.name_alphabet || undefined,
          factory_number: columnFilters.factory_number || undefined,
          nomenclature_number: columnFilters.nomenclature_number || undefined,
          location_id:
            columnFilters.location_id && !Number.isNaN(Number(columnFilters.location_id))
              ? Number(columnFilters.location_id)
              : undefined
        }
      })
  });

  const locationsTreeQuery = useQuery({
    queryKey: ["locations-tree-options", false],
    queryFn: () => fetchLocationsTree(false)
  });

  useEffect(() => {
    if (assembliesQuery.error) {
      setErrorMessage(
        assembliesQuery.error instanceof Error
          ? assembliesQuery.error.message
          : t("pagesUi.assemblies.errors.load")
      );
    }
  }, [assembliesQuery.error, t]);

  const { options: locationOptions, breadcrumbMap: locationBreadcrumbs } = useMemo(
    () => buildLocationLookups(locationsTreeQuery.data || []),
    [locationsTreeQuery.data]
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["assemblies"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      factory_number?: string | null;
      nomenclature_number?: string | null;
      location_id?: number | null;
    }) => createEntity("/assemblies", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.assemblies.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Assembly> }) =>
      updateEntity("/assemblies", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.assemblies.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/assemblies", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.assemblies.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/assemblies", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.assemblies.errors.restore"))
  });

  const columns = useMemo<ColumnDef<Assembly>[]>(() => {
    const base: ColumnDef<Assembly>[] = [
      {
        header: t("common.fields.name"),
        accessorKey: "name",
        meta: {
          filterType: "text",
          filterKey: "name",
          alphabetFilterKey: "name_alphabet",
          filterPlaceholder: t("actions.search")
        } as ColumnMeta<Assembly>
      },
      {
        header: t("common.fields.factoryNumber"),
        meta: {
          filterType: "text",
          filterKey: "factory_number",
          filterPlaceholder: t("common.fields.factoryNumber")
        } as ColumnMeta<Assembly>,
        cell: ({ row }) => row.original.factory_number || "-"
      },
      {
        header: t("common.fields.nomenclatureNumber"),
        meta: {
          filterType: "text",
          filterKey: "nomenclature_number",
          filterPlaceholder: t("common.fields.nomenclatureNumber")
        } as ColumnMeta<Assembly>,
        cell: ({ row }) => row.original.nomenclature_number || "-"
      },
      {
        header: t("common.fields.location"),
        meta: {
          filterType: "select",
          filterKey: "location_id",
          filterPlaceholder: t("common.all"),
          filterOptions: locationOptions.map((option) => ({
            label: option.label,
            value: option.value
          }))
        } as ColumnMeta<Assembly>,
        cell: ({ row }) => {
          const fullPath = row.original.location_full_path;
          if (fullPath) {
            return fullPath;
          }
          return row.original.location_id
            ? locationBreadcrumbs.get(row.original.location_id) || row.original.location_id
            : "-";
        }
      },
      {
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {canWrite && (
              <>
                <AppButton
                  size="small"
                  startIcon={<EditRoundedIcon />}
                  onClick={() =>
                    setDialog({
                      open: true,
                      title: t("pagesUi.assemblies.dialogs.editTitle"),
                      fields: [
                        { name: "name", label: t("common.fields.name"), type: "text" },
                        { name: "factory_number", label: t("common.fields.factoryNumber"), type: "text" },
                        {
                          name: "nomenclature_number",
                          label: t("common.fields.nomenclatureNumber"),
                          type: "text"
                        },
                        {
                          name: "location_id",
                          label: t("common.fields.location"),
                          type: "select",
                          options: locationOptions
                        }
                      ],
                      values: row.original,
                      onSave: (values) => {
                        const locationId =
                          values.location_id === "" || values.location_id === undefined
                            ? null
                            : Number(values.location_id);
                        const factoryNumber = values.factory_number
                          ? String(values.factory_number).trim()
                          : "";
                        const nomenclatureNumber = values.nomenclature_number
                          ? String(values.nomenclature_number).trim()
                          : "";
                        updateMutation.mutate({
                          id: row.original.id,
                          payload: {
                            name: values.name,
                            factory_number: factoryNumber || null,
                            nomenclature_number: nomenclatureNumber || null,
                            location_id: locationId
                          }
                        });
                        setDialog(null);
                      }
                    })
                  }
                >
                  {t("actions.edit")}
                </AppButton>
                <AppButton
                  size="small"
                  color={row.original.is_deleted ? "success" : "error"}
                  startIcon={
                    row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />
                  }
                  onClick={() =>
                    row.original.is_deleted
                      ? restoreMutation.mutate(row.original.id)
                      : deleteMutation.mutate(row.original.id)
                  }
                >
                  {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
                </AppButton>
              </>
            )}
          </Box>
        )
      }
    ];

    return base;
  }, [
    canWrite,
    deleteMutation,
    locationBreadcrumbs,
    locationOptions,
    restoreMutation,
    updateMutation,
    t,
    i18n.language
  ]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.assemblies")}</Typography>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <FormControl fullWidth>
              <InputLabel>{t("common.sort")}</InputLabel>
              <Select label={t("common.sort")} value={sort} onChange={(event) => setSort(event.target.value)}>
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.assemblies.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      { name: "factory_number", label: t("common.fields.factoryNumber"), type: "text" },
                      {
                        name: "nomenclature_number",
                        label: t("common.fields.nomenclatureNumber"),
                        type: "text"
                      },
                      {
                        name: "location_id",
                        label: t("common.fields.location"),
                        type: "select",
                        options: locationOptions
                      }
                    ],
                    values: { name: "", factory_number: "", nomenclature_number: "", location_id: "" },
                    onSave: (values) => {
                      const locationId =
                        values.location_id === "" || values.location_id === undefined
                          ? null
                          : Number(values.location_id);
                      const factoryNumber = values.factory_number
                        ? String(values.factory_number).trim()
                        : "";
                      const nomenclatureNumber = values.nomenclature_number
                        ? String(values.nomenclature_number).trim()
                        : "";
                      createMutation.mutate({
                        name: values.name,
                        factory_number: factoryNumber || null,
                        nomenclature_number: nomenclatureNumber || null,
                        location_id: locationId
                      });
                      setDialog(null);
                    }
                  })
                }
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable
            data={assembliesQuery.data?.items || []}
            columns={columns}
            showColumnFilters
            columnFilters={columnFilters}
            onColumnFiltersChange={(nextFilters) => {
              setColumnFilters(nextFilters);
              setPage(1);
            }}
          />
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
            count={assembliesQuery.data?.total || 0}
            page={page - 1}
            onPageChange={(_, value) => setPage(value + 1)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            rowsPerPageOptions={pageSizeOptions}
          />
        </CardContent>
      </Card>

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
