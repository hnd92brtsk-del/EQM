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
  TextField,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";

type Cabinet = {
  id: number;
  name: string;
  location_id?: number | null;
  is_deleted: boolean;
  created_at?: string;
};

type Location = { id: number; name: string };

const pageSizeOptions = [10, 20, 50, 100];

export default function CabinetsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [locationFilter, setLocationFilter] = useState<number | "">("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: "name", label: t("pagesUi.cabinets.sort.byNameAsc") },
      { value: "-name", label: t("pagesUi.cabinets.sort.byNameDesc") },
      { value: "created_at", label: t("pagesUi.cabinets.sort.byCreatedOldest") },
      { value: "-created_at", label: t("pagesUi.cabinets.sort.byCreatedNewest") }
    ],
    [t]
  );

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets", page, pageSize, q, sort, locationFilter, showDeleted],
    queryFn: () =>
      listEntity<Cabinet>("/cabinets", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          location_id: locationFilter || undefined
        }
      })
  });

  const locationsQuery = useQuery({
    queryKey: ["locations-options"],
    queryFn: () =>
      listEntity<Location>("/locations", {
        page: 1,
        page_size: 200,
        is_deleted: false
      })
  });

  useEffect(() => {
    if (cabinetsQuery.error) {
      setErrorMessage(
        cabinetsQuery.error instanceof Error
          ? cabinetsQuery.error.message
          : t("pagesUi.cabinets.errors.load")
      );
    }
  }, [cabinetsQuery.error, t]);

  const locationMap = useMemo(() => {
    const map = new Map<number, string>();
    locationsQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [locationsQuery.data?.items]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cabinets"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; location_id?: number | null }) =>
      createEntity("/cabinets", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Cabinet> }) =>
      updateEntity("/cabinets", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/cabinets", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/cabinets", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.restore"))
  });

  const columns = useMemo<ColumnDef<Cabinet>[]>(() => {
    const base: ColumnDef<Cabinet>[] = [
      { header: t("common.fields.name"), accessorKey: "name" },
      {
        header: t("common.fields.location"),
        cell: ({ row }) =>
          row.original.location_id
            ? locationMap.get(row.original.location_id) || row.original.location_id
            : "-"
      },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
        )
      }
    ];

    base.push({
      header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <AppButton size="small" onClick={() => navigate(`/cabinets/${row.original.id}/composition`)}>
            {t("pagesUi.cabinets.actions.openComposition")}
          </AppButton>
          {canWrite && (
            <>
              <AppButton
                size="small"
                startIcon={<EditRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.cabinets.dialogs.editTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      {
                        name: "location_id",
                        label: t("common.fields.location"),
                        type: "select",
                        options:
                          locationsQuery.data?.items.map((loc) => ({
                            label: loc.name,
                            value: loc.id
                          })) || []
                      }
                    ],
                    values: row.original,
                    onSave: (values) => {
                      const locationId =
                        values.location_id === "" || values.location_id === undefined
                          ? null
                          : Number(values.location_id);
                      updateMutation.mutate({
                        id: row.original.id,
                        payload: { name: values.name, location_id: locationId }
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
    });


    return base;
  }, [
    canWrite,
    deleteMutation,
    locationMap,
    locationsQuery.data?.items,
    navigate,
    restoreMutation,
    updateMutation,
    t,
    i18n.language
  ]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.cabinets")}</Typography>
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
                setPage(1);
              }}
              fullWidth
            />

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

            <FormControl fullWidth>
              <InputLabel>{t("common.fields.location")}</InputLabel>
              <Select
                label={t("common.fields.location")}
                value={locationFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setLocationFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {locationsQuery.data?.items.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
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
                    title: t("pagesUi.cabinets.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      {
                        name: "location_id",
                        label: t("common.fields.location"),
                        type: "select",
                        options:
                          locationsQuery.data?.items.map((loc) => ({
                            label: loc.name,
                            value: loc.id
                          })) || []
                      }
                    ],
                    values: { name: "", location_id: "" },
                    onSave: (values) => {
                      const locationId =
                        values.location_id === "" || values.location_id === undefined
                          ? null
                          : Number(values.location_id);
                      createMutation.mutate({ name: values.name, location_id: locationId });
                      setDialog(null);
                    }
                  })
                }
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable data={cabinetsQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
            count={cabinetsQuery.data?.total || 0}
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



