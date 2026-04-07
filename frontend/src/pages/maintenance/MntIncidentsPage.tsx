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
  listIncidents, createIncident, updateIncident, deleteIncident, restoreIncident,
  listMntDict, type MntIncident,
} from "../../api/maintenance";
import { listEntity } from "../../api/entities";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { AppButton } from "../../components/ui/AppButton";
import { getTablePaginationProps } from "../../components/tablePaginationI18n";
import { formatDateTime } from "../../utils/dateFormat";

type Cabinet = { id: number; name: string; location_id?: number | null };

const pageSizeOptions = [10, 20, 50, 100];

const severityColors: Record<string, "error" | "warning" | "info"> = {
  critical: "error", degraded: "warning", incipient: "info",
};
const statusColors: Record<string, "error" | "warning" | "info" | "success" | "default"> = {
  open: "error", investigating: "warning", in_repair: "info", resolved: "success", closed: "default",
};

export default function MntIncidentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "maintenance", "write");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("-occurred_at");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortOptions = useMemo(() => [
    { value: "-occurred_at", label: t("mnt.incidents.sort.newest") },
    { value: "occurred_at", label: t("mnt.incidents.sort.oldest") },
    { value: "-severity", label: t("mnt.incidents.sort.severity") },
    { value: "title", label: t("mnt.incidents.sort.title") },
  ], [t]);

  const incidentsQuery = useQuery({
    queryKey: ["mnt-incidents", page, pageSize, sort, columnFilters, showDeleted],
    queryFn: () => listIncidents({
      page, page_size: pageSize, sort: sort || undefined,
      include_deleted: showDeleted,
      q: columnFilters.q || undefined,
      cabinet_id: columnFilters.cabinet_id || undefined,
      status: columnFilters.status || undefined,
      severity: columnFilters.severity || undefined,
    }),
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-lookup"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page_size: 200 }),
    staleTime: 60000,
  });
  const failureModesQuery = useQuery({
    queryKey: ["mnt-failure-modes-lookup"],
    queryFn: () => listMntDict("failureModes", { page_size: 200 }),
    staleTime: 60000,
  });
  const failureMechanismsQuery = useQuery({
    queryKey: ["mnt-failure-mechanisms-lookup"],
    queryFn: () => listMntDict("failureMechanisms", { page_size: 200 }),
    staleTime: 60000,
  });
  const failureCausesQuery = useQuery({
    queryKey: ["mnt-failure-causes-lookup"],
    queryFn: () => listMntDict("failureCauses", { page_size: 200 }),
    staleTime: 60000,
  });
  const detectionMethodsQuery = useQuery({
    queryKey: ["mnt-detection-methods-lookup"],
    queryFn: () => listMntDict("detectionMethods", { page_size: 200 }),
    staleTime: 60000,
  });

  const cabinets = cabinetsQuery.data?.items ?? [];
  const failureModes = failureModesQuery.data?.items ?? [];
  const failureMechanisms = failureMechanismsQuery.data?.items ?? [];
  const failureCauses = failureCausesQuery.data?.items ?? [];
  const detectionMethods = detectionMethodsQuery.data?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteIncident(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mnt-incidents"] }),
    onError: (e) => setErrorMessage(e instanceof Error ? e.message : "Error"),
  });
  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreIncident(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mnt-incidents"] }),
    onError: (e) => setErrorMessage(e instanceof Error ? e.message : "Error"),
  });

  const buildFields = (): FieldConfig[] => [
    { name: "title", label: t("mnt.incidents.fields.title"), type: "text" },
    {
      name: "cabinet_id", label: t("mnt.incidents.fields.cabinet"), type: "select",
      options: cabinets.map(c => ({ label: c.name, value: c.id })),
    },
    {
      name: "severity", label: t("mnt.incidents.fields.severity"), type: "select",
      options: [
        { label: "Critical", value: "critical" },
        { label: "Degraded", value: "degraded" },
        { label: "Incipient", value: "incipient" },
      ],
    },
    {
      name: "status", label: t("mnt.incidents.fields.status"), type: "select",
      options: ["open", "investigating", "in_repair", "resolved", "closed"].map(s => ({ label: s, value: s })),
    },
    {
      name: "failure_mode_id", label: t("mnt.incidents.fields.failure_mode"), type: "select",
      options: failureModes.map(f => ({ label: `${f.code ? `${f.code} — ` : ""}${f.name}`, value: f.id })),
    },
    {
      name: "failure_mechanism_id", label: t("mnt.incidents.fields.failure_mechanism"), type: "select",
      options: failureMechanisms.map(f => ({ label: `${f.code ? `${f.code} — ` : ""}${f.name}`, value: f.id })),
    },
    {
      name: "failure_cause_id", label: t("mnt.incidents.fields.failure_cause"), type: "select",
      options: failureCauses.map(f => ({ label: `${f.code ? `${f.code} — ` : ""}${f.name}`, value: f.id })),
    },
    {
      name: "detection_method_id", label: t("mnt.incidents.fields.detection_method"), type: "select",
      options: detectionMethods.map(f => ({ label: `${f.code ? `${f.code} — ` : ""}${f.name}`, value: f.id })),
    },
    {
      name: "operational_impact", label: t("mnt.incidents.fields.operational_impact"), type: "select",
      options: [
        { label: "Total loss", value: "total_loss" },
        { label: "Partial loss", value: "partial_loss" },
        { label: "No effect", value: "no_effect" },
      ],
    },
    { name: "downtime_hours", label: t("mnt.incidents.fields.downtime_hours"), type: "number" },
    { name: "man_hours", label: t("mnt.incidents.fields.man_hours"), type: "number" },
    { name: "description", label: t("mnt.incidents.fields.description"), type: "text", multiline: true, rows: 3 },
    { name: "root_cause_analysis", label: t("mnt.incidents.fields.rca"), type: "text", multiline: true, rows: 3 },
    { name: "resolution_notes", label: t("mnt.incidents.fields.resolution_notes"), type: "text", multiline: true, rows: 3 },
  ];

  const openCreateDialog = () => {
    const now = new Date().toISOString().slice(0, 16);
    setDialog({
      open: true,
      title: t("mnt.incidents.dialog.create"),
      fields: buildFields(),
      values: { occurred_at: now, detected_at: now },
      onSave: async (values) => {
        await createIncident(values);
        queryClient.invalidateQueries({ queryKey: ["mnt-incidents"] });
        setDialog(null);
      },
    });
  };

  const openEditDialog = (item: MntIncident) => {
    setDialog({
      open: true,
      title: t("mnt.incidents.dialog.edit"),
      fields: buildFields(),
      values: { ...item },
      onSave: async (values) => {
        await updateIncident(item.id, values);
        queryClient.invalidateQueries({ queryKey: ["mnt-incidents"] });
        setDialog(null);
      },
    });
  };

  const columns = useMemo<ColumnDef<MntIncident, any>[]>(() => [
    {
      accessorKey: "incident_number", header: t("mnt.incidents.cols.number"), size: 130,
      meta: { filterType: "text", filterKey: "q" } as ColumnMeta,
    },
    { accessorKey: "title", header: t("mnt.incidents.cols.title"), size: 220 },
    {
      accessorKey: "cabinet_name", header: t("mnt.incidents.cols.cabinet"), size: 160,
      meta: {
        filterType: "select", filterKey: "cabinet_id",
        filterOptions: cabinets.map(c => ({ label: c.name, value: c.id })),
      } as ColumnMeta,
    },
    {
      accessorKey: "severity", header: t("mnt.incidents.cols.severity"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <Chip label={v} size="small" color={severityColors[v] ?? "default"} /> : "—";
      },
      meta: {
        filterType: "select", filterKey: "severity",
        filterOptions: [
          { label: "Critical", value: "critical" },
          { label: "Degraded", value: "degraded" },
          { label: "Incipient", value: "incipient" },
        ],
      } as ColumnMeta,
    },
    {
      accessorKey: "status", header: t("mnt.incidents.cols.status"), size: 120,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <Chip label={v} size="small" color={statusColors[v] ?? "default"} variant="outlined" />;
      },
      meta: {
        filterType: "select", filterKey: "status",
        filterOptions: ["open", "investigating", "in_repair", "resolved", "closed"].map(s => ({ label: s, value: s })),
      } as ColumnMeta,
    },
    {
      accessorKey: "occurred_at", header: t("mnt.incidents.cols.occurred_at"), size: 155,
      cell: ({ getValue }) => formatDateTime(getValue() as string | null | undefined),
    },
    {
      accessorKey: "downtime_hours", header: t("mnt.incidents.cols.downtime"), size: 100,
      cell: ({ getValue }) => { const v = getValue(); return v != null ? `${v} h` : "—"; },
    },
    { accessorKey: "reported_by_username", header: t("mnt.incidents.cols.reported_by"), size: 130 },
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
              <AppButton variant="text" size="small" onClick={() => restoreMutation.mutate(item.id)}>
                <RestoreRoundedIcon fontSize="small" />
              </AppButton>
            ) : (
              <AppButton variant="text" size="small" color="error" onClick={() => deleteMutation.mutate(item.id)}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </AppButton>
            )}
          </Box>
        );
      },
    },
  ], [t, canWrite, cabinets, failureModes, failureMechanisms, failureCauses, detectionMethods, deleteMutation, restoreMutation]);

  const data = incidentsQuery.data;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box className="page-title-block">
        <Box className="page-title-kicker">{t("menu.maintenance")}</Box>
        <Typography variant="h4">{t("mnt.incidents.title")}</Typography>
      </Box>
      <Card className="crud-panel" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">{t("mnt.incidents.title")}</Typography>
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

          <DataTable
            data={data?.items ?? []}
            columns={columns}
            columnFilters={columnFilters}
            onColumnFiltersChange={setColumnFilters}
          />

          {data && (
            <TablePagination
              component="div"
              count={data.total}
              page={page - 1}
              rowsPerPage={pageSize}
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
