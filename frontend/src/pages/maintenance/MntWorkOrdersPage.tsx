import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, FormControl, FormControlLabel,
  InputLabel, MenuItem, Select, Switch, TablePagination, Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { type ColumnMeta, DataTable, type DataTableFiltersState } from "../../components/DataTable";
import { EntityDialog, DialogState, type FieldConfig } from "../../components/EntityDialog";
import { ErrorSnackbar } from "../../components/ErrorSnackbar";
import {
  listWorkOrders, createWorkOrder, updateWorkOrder, deleteWorkOrder, restoreWorkOrder,
  listMntDict, type MntWorkOrder,
} from "../../api/maintenance";
import { listEntity } from "../../api/entities";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { AppButton } from "../../components/ui/AppButton";
import { getTablePaginationProps } from "../../components/tablePaginationI18n";
import { formatDate, parseDisplayDate, toDisplayDate, withDateInputHint } from "../../utils/dateFormat";

type Cabinet = { id: number; name: string };

const pageSizeOptions = [10, 20, 50, 100];

const priorityColors: Record<string, "error" | "warning" | "info" | "default"> = {
  critical: "error", high: "warning", normal: "info", low: "default",
};
const statusColors: Record<string, "error" | "warning" | "info" | "success" | "default"> = {
  planned: "default", approved: "info", in_progress: "warning", completed: "success", closed: "default", cancelled: "error",
};

export default function MntWorkOrdersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "maintenance", "write");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("-created_at");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortOptions = useMemo(() => [
    { value: "-created_at", label: t("mnt.work_orders.sort.newest") },
    { value: "planned_start_date", label: t("mnt.work_orders.sort.planned") },
    { value: "-priority", label: t("mnt.work_orders.sort.priority") },
    { value: "title", label: t("mnt.work_orders.sort.title") },
  ], [t]);

  const query = useQuery({
    queryKey: ["mnt-work-orders", page, pageSize, sort, columnFilters, showDeleted],
    queryFn: () => listWorkOrders({
      page, page_size: pageSize, sort: sort || undefined,
      include_deleted: showDeleted,
      q: columnFilters.q || undefined,
      cabinet_id: columnFilters.cabinet_id || undefined,
      status: columnFilters.status || undefined,
      order_type: columnFilters.order_type || undefined,
      priority: columnFilters.priority || undefined,
    }),
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-lookup"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page_size: 200 }),
    staleTime: 60000,
  });
  const activityTypesQuery = useQuery({
    queryKey: ["mnt-activity-types-lookup"],
    queryFn: () => listMntDict("activityTypes", { page_size: 200 }),
    staleTime: 60000,
  });

  const cabinets = cabinetsQuery.data?.items ?? [];
  const activityTypes = activityTypesQuery.data?.items ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteWorkOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mnt-work-orders"] }),
    onError: (e) => setErrorMessage(e instanceof Error ? e.message : "Error"),
  });
  const restoreMut = useMutation({
    mutationFn: (id: number) => restoreWorkOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mnt-work-orders"] }),
    onError: (e) => setErrorMessage(e instanceof Error ? e.message : "Error"),
  });

  const orderTypeOptions = [
    { label: t("mnt.work_orders.types.corrective"), value: "corrective" },
    { label: t("mnt.work_orders.types.preventive"), value: "preventive" },
    { label: t("mnt.work_orders.types.condition_based"), value: "condition_based" },
    { label: t("mnt.work_orders.types.replacement"), value: "replacement" },
    { label: t("mnt.work_orders.types.modification"), value: "modification" },
    { label: t("mnt.work_orders.types.inspection"), value: "inspection" },
  ];

  const buildFields = (): FieldConfig[] => [
    { name: "title", label: t("mnt.work_orders.fields.title"), type: "text" },
    { name: "order_type", label: t("mnt.work_orders.fields.type"), type: "select", options: orderTypeOptions },
    {
      name: "priority", label: t("mnt.work_orders.fields.priority"), type: "select",
      options: ["critical", "high", "normal", "low"].map(s => ({ label: s, value: s })),
    },
    {
      name: "status", label: t("mnt.work_orders.fields.status"), type: "select",
      options: ["planned", "approved", "in_progress", "completed", "closed", "cancelled"].map(s => ({ label: s, value: s })),
    },
    {
      name: "cabinet_id", label: t("mnt.work_orders.fields.cabinet"), type: "select",
      options: cabinets.map(c => ({ label: c.name, value: c.id })),
    },
    {
      name: "activity_type_id", label: t("mnt.work_orders.fields.activity_type"), type: "select",
      options: activityTypes.map(a => ({ label: a.name, value: a.id })),
    },
    { name: "planned_start_date", label: withDateInputHint(t("mnt.work_orders.fields.planned_start")), type: "text", placeholder: "ДД.ММ.ГГГГ" },
    { name: "planned_end_date", label: withDateInputHint(t("mnt.work_orders.fields.planned_end")), type: "text", placeholder: "ДД.ММ.ГГГГ" },
    { name: "estimated_man_hours", label: t("mnt.work_orders.fields.estimated_hours"), type: "number" },
    { name: "actual_man_hours", label: t("mnt.work_orders.fields.actual_hours"), type: "number" },
    { name: "description", label: t("mnt.work_orders.fields.description"), type: "text", multiline: true, rows: 3 },
    { name: "completion_notes", label: t("mnt.work_orders.fields.completion_notes"), type: "text", multiline: true, rows: 3 },
  ];

  const openCreateDialog = () => {
    setDialog({
      open: true,
      title: t("mnt.work_orders.dialog.create"),
      fields: buildFields(),
      values: { status: "planned", priority: "normal", planned_start_date: "", planned_end_date: "" },
      onSave: async (values) => {
        await createWorkOrder({
          ...values,
          planned_start_date: parseDisplayDate(values.planned_start_date) || null,
          planned_end_date: parseDisplayDate(values.planned_end_date) || null,
        });
        queryClient.invalidateQueries({ queryKey: ["mnt-work-orders"] });
        setDialog(null);
      },
    });
  };

  const openEditDialog = (item: MntWorkOrder) => {
    setDialog({
      open: true,
      title: t("mnt.work_orders.dialog.edit"),
      fields: buildFields(),
      values: {
        ...item,
        planned_start_date: toDisplayDate(item.planned_start_date),
        planned_end_date: toDisplayDate(item.planned_end_date),
      },
      onSave: async (values) => {
        await updateWorkOrder(item.id, {
          ...values,
          planned_start_date: parseDisplayDate(values.planned_start_date) || null,
          planned_end_date: parseDisplayDate(values.planned_end_date) || null,
        });
        queryClient.invalidateQueries({ queryKey: ["mnt-work-orders"] });
        setDialog(null);
      },
    });
  };

  const columns = useMemo<ColumnDef<MntWorkOrder, any>[]>(() => [
    { accessorKey: "order_number", header: t("mnt.work_orders.cols.number"), size: 130, meta: { filterType: "text", filterKey: "q" } as ColumnMeta },
    { accessorKey: "title", header: t("mnt.work_orders.cols.title"), size: 220 },
    {
      accessorKey: "order_type", header: t("mnt.work_orders.cols.type"), size: 130,
      meta: { filterType: "select", filterKey: "order_type", filterOptions: orderTypeOptions } as ColumnMeta,
    },
    {
      accessorKey: "priority", header: t("mnt.work_orders.cols.priority"), size: 100,
      cell: ({ getValue }) => { const v = getValue() as string; return <Chip label={v} size="small" color={priorityColors[v] ?? "default"} />; },
      meta: { filterType: "select", filterKey: "priority", filterOptions: ["critical", "high", "normal", "low"].map(s => ({ label: s, value: s })) } as ColumnMeta,
    },
    {
      accessorKey: "status", header: t("mnt.work_orders.cols.status"), size: 120,
      cell: ({ getValue }) => { const v = getValue() as string; return <Chip label={v} size="small" color={statusColors[v] ?? "default"} variant="outlined" />; },
      meta: { filterType: "select", filterKey: "status", filterOptions: ["planned", "approved", "in_progress", "completed", "closed", "cancelled"].map(s => ({ label: s, value: s })) } as ColumnMeta,
    },
    {
      accessorKey: "cabinet_name", header: t("mnt.work_orders.cols.cabinet"), size: 160,
      meta: { filterType: "select", filterKey: "cabinet_id", filterOptions: cabinets.map(c => ({ label: c.name, value: c.id })) } as ColumnMeta,
    },
    {
      accessorKey: "planned_start_date", header: t("mnt.work_orders.cols.planned_start"), size: 120,
      cell: ({ getValue }) => formatDate(getValue() as string | null | undefined),
    },
    {
      accessorKey: "planned_end_date", header: t("mnt.work_orders.cols.planned_end"), size: 120,
      cell: ({ getValue }) => formatDate(getValue() as string | null | undefined),
    },
    { accessorKey: "activity_type_name", header: t("mnt.work_orders.cols.activity_type"), size: 150 },
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
            {item.is_deleted ? (
              <AppButton variant="text" size="small" onClick={() => restoreMut.mutate(item.id)}>
                <RestoreRoundedIcon fontSize="small" />
              </AppButton>
            ) : (
              <AppButton variant="text" size="small" color="error" onClick={() => deleteMut.mutate(item.id)}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </AppButton>
            )}
          </Box>
        );
      },
    },
  ], [t, canWrite, cabinets, activityTypes, deleteMut, restoreMut]);

  const d = query.data;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box className="page-title-block">
        <Box className="page-title-kicker">{t("menu.maintenance")}</Box>
        <Typography variant="h4">{t("mnt.work_orders.title")}</Typography>
      </Box>
      <Card className="crud-panel" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">{t("mnt.work_orders.title")}</Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <FormControlLabel
                control={<Switch checked={showDeleted} onChange={(_, v) => { setShowDeleted(v); setPage(1); }} size="small" />}
                label={t("common.showDeleted")}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>{t("common.sort")}</InputLabel>
                <Select value={sort} label={t("common.sort")} onChange={(e) => setSort(e.target.value)}>
                  {sortOptions.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
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
