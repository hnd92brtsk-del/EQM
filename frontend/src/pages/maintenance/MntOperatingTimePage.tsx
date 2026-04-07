import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, FormControl, InputLabel, MenuItem, Select,
  TablePagination, Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { type ColumnMeta, DataTable, type DataTableFiltersState } from "../../components/DataTable";
import { EntityDialog, DialogState, type FieldConfig } from "../../components/EntityDialog";
import { ErrorSnackbar } from "../../components/ErrorSnackbar";
import { listOperatingTime, createOperatingTime, updateOperatingTime, deleteOperatingTime, type MntOperatingTime } from "../../api/maintenance";
import { listEntity } from "../../api/entities";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { AppButton } from "../../components/ui/AppButton";
import { getTablePaginationProps } from "../../components/tablePaginationI18n";
import { formatDate, parseDisplayDate, toDisplayDate, withDateInputHint } from "../../utils/dateFormat";

type Cabinet = { id: number; name: string };
const pageSizeOptions = [10, 20, 50, 100];

export default function MntOperatingTimePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "maintenance", "write");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("-recorded_date");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dataQuery = useQuery({
    queryKey: ["mnt-operating-time", page, pageSize, sort, columnFilters],
    queryFn: () => listOperatingTime({
      page, page_size: pageSize, sort: sort || undefined,
      cabinet_id: columnFilters.cabinet_id || undefined,
      date_from: columnFilters.date_from || undefined,
      date_to: columnFilters.date_to || undefined,
    }),
  });

  const cabinetsQuery = useQuery({ queryKey: ["cabinets-lookup"], queryFn: () => listEntity<Cabinet>("/cabinets", { page_size: 200 }), staleTime: 60000 });
  const cabinets = cabinetsQuery.data?.items ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteOperatingTime(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mnt-operating-time"] }),
    onError: (e) => setErrorMessage(e instanceof Error ? e.message : "Error"),
  });

  const buildFields = (): FieldConfig[] => [
    {
      name: "cabinet_id", label: t("mnt.operating_time.fields.cabinet"), type: "select",
      options: cabinets.map(c => ({ label: c.name, value: c.id })),
    },
    { name: "recorded_date", label: withDateInputHint(t("mnt.operating_time.fields.date")), type: "text", placeholder: "ДД.ММ.ГГГГ" },
    { name: "operating_hours", label: t("mnt.operating_time.fields.operating"), type: "number" },
    { name: "standby_hours", label: t("mnt.operating_time.fields.standby"), type: "number" },
    { name: "downtime_hours", label: t("mnt.operating_time.fields.downtime"), type: "number" },
    { name: "notes", label: t("mnt.operating_time.fields.notes"), type: "text", multiline: true, rows: 3 },
  ];

  const openCreateDialog = () => {
    const today = toDisplayDate(new Date().toISOString().slice(0, 10));
    setDialog({
      open: true,
      title: t("mnt.operating_time.dialog.create"),
      fields: buildFields(),
      values: { recorded_date: today, operating_hours: 0, standby_hours: 0, downtime_hours: 0 },
      onSave: async (values) => {
        await createOperatingTime({
          ...values,
          recorded_date: parseDisplayDate(values.recorded_date),
        });
        queryClient.invalidateQueries({ queryKey: ["mnt-operating-time"] });
        setDialog(null);
      },
    });
  };

  const openEditDialog = (item: MntOperatingTime) => {
    setDialog({
      open: true,
      title: t("mnt.operating_time.dialog.edit"),
      fields: buildFields(),
      values: { ...item, recorded_date: toDisplayDate(item.recorded_date) },
      onSave: async (values) => {
        await updateOperatingTime(item.id, {
          ...values,
          recorded_date: parseDisplayDate(values.recorded_date),
        });
        queryClient.invalidateQueries({ queryKey: ["mnt-operating-time"] });
        setDialog(null);
      },
    });
  };

  const columns = useMemo<ColumnDef<MntOperatingTime, any>[]>(() => [
    {
      accessorKey: "cabinet_name", header: t("mnt.operating_time.cols.cabinet"), size: 180,
      meta: { filterType: "select", filterKey: "cabinet_id", filterOptions: cabinets.map(c => ({ label: c.name, value: c.id })) } as ColumnMeta,
    },
    {
      accessorKey: "recorded_date", header: t("mnt.operating_time.cols.date"), size: 120,
      cell: ({ getValue }) => formatDate(getValue() as string | null | undefined),
    },
    { accessorKey: "operating_hours", header: t("mnt.operating_time.cols.operating"), size: 110, cell: ({ getValue }) => `${getValue()} h` },
    { accessorKey: "standby_hours", header: t("mnt.operating_time.cols.standby"), size: 110, cell: ({ getValue }) => `${getValue()} h` },
    { accessorKey: "downtime_hours", header: t("mnt.operating_time.cols.downtime"), size: 110, cell: ({ getValue }) => `${getValue()} h` },
    { accessorKey: "notes", header: t("mnt.operating_time.cols.notes"), size: 200 },
    {
      id: "actions", header: "", size: 100,
      cell: ({ row }) => {
        const item = row.original;
        if (!canWrite) return null;
        return (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <AppButton variant="text" size="small" onClick={() => openEditDialog(item)}>
              <EditRoundedIcon fontSize="small" />
            </AppButton>
            <AppButton variant="text" size="small" color="error" onClick={() => deleteMut.mutate(item.id)}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </AppButton>
          </Box>
        );
      },
    },
  ], [t, canWrite, cabinets, deleteMut]);

  const d = dataQuery.data;

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">{t("mnt.operating_time.title")}</Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>{t("common.sort")}</InputLabel>
                <Select value={sort} label={t("common.sort")} onChange={(e) => setSort(e.target.value)}>
                  <MenuItem value="-recorded_date">{t("mnt.operating_time.sort.newest")}</MenuItem>
                  <MenuItem value="recorded_date">{t("mnt.operating_time.sort.oldest")}</MenuItem>
                </Select>
              </FormControl>
              {canWrite && (
                <AppButton startIcon={<AddRoundedIcon />} onClick={openCreateDialog}>
                  {t("actions.add")}
                </AppButton>
              )}
            </Box>
          </Box>

          <DataTable data={d?.items ?? []} columns={columns} columnFilters={columnFilters} onColumnFiltersChange={setColumnFilters} />

          {d && (
            <TablePagination
              component="div" count={d.total} page={page - 1} rowsPerPage={pageSize}
              onPageChange={(_, p) => setPage(p + 1)}
              onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
              rowsPerPageOptions={pageSizeOptions}
              {...getTablePaginationProps(t)}
            />
          )}
        </CardContent>
      </Card>

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
