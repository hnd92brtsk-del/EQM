import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TablePagination,
  Typography
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { type ColumnMeta, DataTable, type DataTableFiltersState } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { hasPermission } from "../utils/permissions";
import { formatDateTime } from "../utils/dateFormat";

const pageSizeOptions = [10, 20, 50, 100];

type AuditLog = {
  id: number;
  actor_id: number;
  display_user_label: string;
  action: string;
  entity: string;
  entity_id?: number | null;
  created_at: string;
};

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canView = hasPermission(user, "admin_audit", "read");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("-created_at");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: "-created_at", label: t("pagesUi.auditLogs.sort.byTimeNewest") },
      { value: "created_at", label: t("pagesUi.auditLogs.sort.byTimeOldest") },
      { value: "entity", label: t("pagesUi.auditLogs.sort.byEntityAsc") },
      { value: "-entity", label: t("pagesUi.auditLogs.sort.byEntityDesc") }
    ],
    [t]
  );

  const auditQuery = useQuery({
    queryKey: ["audit-logs", page, pageSize, sort, columnFilters],
    queryFn: () =>
      listEntity<AuditLog>("/audit-logs", {
        page,
        page_size: pageSize,
        sort: sort || undefined,
        filters: {
          q: columnFilters.q || undefined,
          entity: columnFilters.entity || undefined,
          action: columnFilters.action || undefined,
          entity_id:
            columnFilters.entity_id && !Number.isNaN(Number(columnFilters.entity_id))
              ? Number(columnFilters.entity_id)
              : undefined
        }
      }),
    enabled: canView
  });

  useEffect(() => {
    if (auditQuery.error) {
      setErrorMessage(
        auditQuery.error instanceof Error
          ? auditQuery.error.message
          : t("pagesUi.auditLogs.errors.load")
      );
    }
  }, [auditQuery.error, t]);

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      { header: t("pagesUi.auditLogs.columns.id"), accessorKey: "id" },
      {
        header: t("pagesUi.auditLogs.columns.actor"),
        accessorKey: "display_user_label",
        meta: {
          filterType: "text",
          filterKey: "q",
          filterPlaceholder: "ID / ФИО / роль"
        } as ColumnMeta<AuditLog>
      },
      {
        header: t("pagesUi.auditLogs.columns.action"),
        accessorKey: "action",
        meta: {
          filterType: "text",
          filterKey: "action",
          filterPlaceholder: t("pagesUi.auditLogs.fields.action")
        } as ColumnMeta<AuditLog>
      },
      {
        header: t("pagesUi.auditLogs.columns.entity"),
        accessorKey: "entity",
        meta: {
          filterType: "text",
          filterKey: "entity",
          filterPlaceholder: t("pagesUi.auditLogs.fields.entity")
        } as ColumnMeta<AuditLog>
      },
      {
        header: t("pagesUi.auditLogs.columns.entityId"),
        accessorKey: "entity_id",
        meta: {
          filterType: "number",
          filterKey: "entity_id",
          filterPlaceholder: t("pagesUi.auditLogs.columns.entityId")
        } as ColumnMeta<AuditLog>
      },
      { header: t("pagesUi.auditLogs.columns.time"), accessorKey: "created_at", cell: ({ row }) => formatDateTime(row.original.created_at) }
    ],
    [t]
  );

  if (!canView) {
    return <Typography>{t("common.noAccess")}</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.auditLogs")}</Typography>
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

          <DataTable
            data={auditQuery.data?.items || []}
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
            count={auditQuery.data?.total || 0}
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
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
