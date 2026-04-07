import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, FormControlLabel,
  Switch, TablePagination, Typography
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
import { listPlans, createPlan, updatePlan, deletePlan, restorePlan, listMntDict, type MntPlan } from "../../api/maintenance";
import { listEntity } from "../../api/entities";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { AppButton } from "../../components/ui/AppButton";
import { getTablePaginationProps } from "../../components/tablePaginationI18n";
import { formatDate, parseDisplayDate, toDisplayDate, withDateInputHint } from "../../utils/dateFormat";

type Cabinet = { id: number; name: string };
const pageSizeOptions = [10, 20, 50, 100];

export default function MntPlansPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "maintenance", "write");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["mnt-plans", page, pageSize, columnFilters, showDeleted],
    queryFn: () => listPlans({
      page, page_size: pageSize, include_deleted: showDeleted,
      q: columnFilters.q || undefined,
      cabinet_id: columnFilters.cabinet_id || undefined,
    }),
  });

  const cabinetsQuery = useQuery({ queryKey: ["cabinets-lookup"], queryFn: () => listEntity<Cabinet>("/cabinets", { page_size: 200 }), staleTime: 60000 });
  const activityTypesQuery = useQuery({ queryKey: ["mnt-activity-types-lookup"], queryFn: () => listMntDict("activityTypes", { page_size: 200 }), staleTime: 60000 });

  const cabinets = cabinetsQuery.data?.items ?? [];
  const activityTypes = activityTypesQuery.data?.items ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: number) => deletePlan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mnt-plans"] }),
    onError: (e) => setErrorMessage(e instanceof Error ? e.message : "Error"),
  });
  const restoreMut = useMutation({
    mutationFn: (id: number) => restorePlan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mnt-plans"] }),
    onError: (e) => setErrorMessage(e instanceof Error ? e.message : "Error"),
  });

  const buildFields = (): FieldConfig[] => [
    { name: "name", label: t("mnt.plans.fields.name"), type: "text" },
    { name: "code", label: t("mnt.plans.fields.code"), type: "text" },
    { name: "interval_days", label: t("mnt.plans.fields.interval_days"), type: "number" },
    {
      name: "cabinet_id", label: t("mnt.plans.fields.cabinet"), type: "select",
      options: cabinets.map(c => ({ label: c.name, value: c.id })),
    },
    {
      name: "activity_type_id", label: t("mnt.plans.fields.activity_type"), type: "select",
      options: activityTypes.map(a => ({ label: a.name, value: a.id })),
    },
    { name: "estimated_man_hours", label: t("mnt.plans.fields.est_hours"), type: "number" },
    { name: "next_due_date", label: withDateInputHint(t("mnt.plans.fields.next_due")), type: "text", placeholder: "ДД.ММ.ГГГГ" },
    { name: "description", label: t("mnt.plans.fields.description"), type: "text", multiline: true, rows: 3 },
  ];

  const openCreateDialog = () => {
    setDialog({
      open: true,
      title: t("mnt.plans.dialog.create"),
      fields: buildFields(),
      values: { next_due_date: "" },
      onSave: async (values) => {
        await createPlan({
          ...values,
          next_due_date: parseDisplayDate(values.next_due_date) || null,
        });
        queryClient.invalidateQueries({ queryKey: ["mnt-plans"] });
        setDialog(null);
      },
    });
  };

  const openEditDialog = (item: MntPlan) => {
    setDialog({
      open: true,
      title: t("mnt.plans.dialog.edit"),
      fields: buildFields(),
      values: { ...item, next_due_date: toDisplayDate(item.next_due_date) },
      onSave: async (values) => {
        await updatePlan(item.id, {
          ...values,
          next_due_date: parseDisplayDate(values.next_due_date) || null,
        });
        queryClient.invalidateQueries({ queryKey: ["mnt-plans"] });
        setDialog(null);
      },
    });
  };

  const columns = useMemo<ColumnDef<MntPlan, any>[]>(() => [
    { accessorKey: "name", header: t("mnt.plans.cols.name"), size: 220, meta: { filterType: "text", filterKey: "q" } as ColumnMeta },
    { accessorKey: "code", header: t("mnt.plans.cols.code"), size: 100 },
    { accessorKey: "interval_days", header: t("mnt.plans.cols.interval"), size: 110, cell: ({ getValue }) => `${getValue()} d` },
    {
      accessorKey: "cabinet_name", header: t("mnt.plans.cols.cabinet"), size: 160,
      meta: { filterType: "select", filterKey: "cabinet_id", filterOptions: cabinets.map(c => ({ label: c.name, value: c.id })) } as ColumnMeta,
    },
    { accessorKey: "activity_type_name", header: t("mnt.plans.cols.activity_type"), size: 160 },
    { accessorKey: "estimated_man_hours", header: t("mnt.plans.cols.est_hours"), size: 100, cell: ({ getValue }) => { const v = getValue(); return v != null ? `${v} h` : "—"; } },
    { accessorKey: "next_due_date", header: t("mnt.plans.cols.next_due"), size: 120, cell: ({ getValue }) => formatDate(getValue() as string | null | undefined) },
    { accessorKey: "last_generated_date", header: t("mnt.plans.cols.last_gen"), size: 120, cell: ({ getValue }) => formatDate(getValue() as string | null | undefined) },
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

  const d = plansQuery.data;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box className="page-title-block">
        <Box className="page-title-kicker">{t("menu.maintenance")}</Box>
        <Typography variant="h4">{t("mnt.plans.title")}</Typography>
      </Box>
      <Card className="crud-panel" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">{t("mnt.plans.title")}</Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <FormControlLabel
                control={<Switch checked={showDeleted} onChange={(_, v) => { setShowDeleted(v); setPage(1); }} size="small" />}
                label={t("common.showDeleted")}
              />
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
