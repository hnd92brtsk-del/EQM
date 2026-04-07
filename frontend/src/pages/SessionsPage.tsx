import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
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
import { listOnlineSessions, type OnlineSession } from "../api/sessions";
import { listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { hasPermission } from "../utils/permissions";
import { formatDateTime } from "../utils/dateFormat";

const pageSizeOptions = [10, 20, 50, 100];

type Session = {
  id: number;
  user_id: number;
  display_user_label: string;
  started_at: string;
  ended_at?: string | null;
  end_reason?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

export default function SessionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canView = hasPermission(user, "admin_sessions", "read");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("-started_at");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: "-started_at", label: t("pagesUi.sessions.sort.byStartNewest") },
      { value: "started_at", label: t("pagesUi.sessions.sort.byStartOldest") },
      { value: "-ended_at", label: t("pagesUi.sessions.sort.byEndNewest") },
      { value: "ended_at", label: t("pagesUi.sessions.sort.byEndOldest") }
    ],
    [t]
  );

  const sessionsQuery = useQuery({
    queryKey: ["sessions", page, pageSize, sort, columnFilters],
    queryFn: () =>
      listEntity<Session>("/sessions", {
        page,
        page_size: pageSize,
        sort: sort || undefined,
        filters: {
          q: columnFilters.q || undefined,
          end_reason: columnFilters.end_reason || undefined,
          ip_address: columnFilters.ip_address || undefined
        }
      }),
    enabled: canView
  });

  const onlineQuery = useQuery({
    queryKey: ["sessions-online"],
    queryFn: () => listOnlineSessions(),
    enabled: canView,
    refetchInterval: 30_000
  });

  useEffect(() => {
    if (sessionsQuery.error || onlineQuery.error) {
      setErrorMessage(
        sessionsQuery.error instanceof Error
          ? sessionsQuery.error.message
          : onlineQuery.error instanceof Error
            ? onlineQuery.error.message
          : t("pagesUi.sessions.errors.load")
      );
    }
  }, [onlineQuery.error, sessionsQuery.error, t]);

  const columns = useMemo<ColumnDef<Session>[]>(
    () => [
      { header: t("pagesUi.sessions.columns.id"), accessorKey: "id" },
      {
        header: t("pagesUi.sessions.columns.user"),
        accessorKey: "display_user_label",
        meta: {
          filterType: "text",
          filterKey: "q",
          filterPlaceholder: "ID / ФИО / роль"
        } as ColumnMeta<Session>
      },
      { header: t("pagesUi.sessions.columns.startedAt"), accessorKey: "started_at", cell: ({ row }) => formatDateTime(row.original.started_at) },
      { header: t("pagesUi.sessions.columns.endedAt"), accessorKey: "ended_at", cell: ({ row }) => formatDateTime(row.original.ended_at) },
      {
        header: t("pagesUi.sessions.columns.endReason"),
        accessorKey: "end_reason",
        meta: {
          filterType: "text",
          filterKey: "end_reason",
          filterPlaceholder: t("pagesUi.sessions.fields.endReason")
        } as ColumnMeta<Session>
      },
      {
        header: t("pagesUi.sessions.columns.ip"),
        accessorKey: "ip_address",
        meta: {
          filterType: "text",
          filterKey: "ip_address",
          filterPlaceholder: t("pagesUi.sessions.columns.ip")
        } as ColumnMeta<Session>
      }
    ],
    [t]
  );

  const onlineColumns = useMemo<ColumnDef<OnlineSession>[]>(
    () => [
      { header: t("pagesUi.sessions.online.columns.id"), accessorKey: "user_id" },
      {
        header: t("pagesUi.sessions.online.columns.role"),
        accessorFn: (row) => row.system_role || "-"
      },
      {
        header: t("pagesUi.sessions.online.columns.name"),
        accessorFn: (row) => row.personnel_full_name || row.display_user_label
      }
    ],
    [t]
  );

  if (!canView) {
    return <Typography>{t("common.noAccess")}</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.sessions")}</Typography>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              p: 2
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Typography variant="h6">{t("pagesUi.sessions.online.title")}</Typography>
              <Button variant="outlined" size="small" onClick={() => void onlineQuery.refetch()}>
                {t("pagesUi.sessions.online.actions.refresh")}
              </Button>
            </Box>
            {onlineQuery.data && onlineQuery.data.length > 0 ? (
              <DataTable data={onlineQuery.data} columns={onlineColumns} />
            ) : (
              <List disablePadding>
                <ListItem disablePadding>
                  <ListItemText primary={t("pagesUi.sessions.online.empty")} />
                </ListItem>
              </List>
            )}
          </Box>
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
            data={sessionsQuery.data?.items || []}
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
            count={sessionsQuery.data?.total || 0}
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
