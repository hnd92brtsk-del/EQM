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
  TextField,
  Typography
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const pageSizeOptions = [10, 20, 50, 100];

const sortOptions = [
  { value: "-created_at", label: "По времени (новые)" },
  { value: "created_at", label: "По времени (старые)" },
  { value: "entity", label: "По сущности (А-Я)" },
  { value: "-entity", label: "По сущности (Я-А)" }
];

type AuditLog = {
  id: number;
  actor_id: number;
  action: string;
  entity: string;
  entity_id?: number | null;
  created_at: string;
};

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canView = user?.role === "admin" || user?.role === "engineer";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [actorIdFilter, setActorIdFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const auditQuery = useQuery({
    queryKey: ["audit-logs", page, pageSize, q, sort, actorIdFilter, entityFilter, actionFilter],
    queryFn: () =>
      listEntity<AuditLog>("/audit-logs", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        filters: {
          actor_id:
            actorIdFilter && !Number.isNaN(Number(actorIdFilter)) ? Number(actorIdFilter) : undefined,
          entity: entityFilter || undefined,
          action: actionFilter || undefined
        }
      }),
    enabled: canView
  });

  useEffect(() => {
    if (auditQuery.error) {
      setErrorMessage(
        auditQuery.error instanceof Error
          ? auditQuery.error.message
          : "Ошибка загрузки аудита"
      );
    }
  }, [auditQuery.error]);

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "Актор", accessorKey: "actor_id" },
      { header: "Действие", accessorKey: "action" },
      { header: "Сущность", accessorKey: "entity" },
      { header: "ID сущности", accessorKey: "entity_id" },
      { header: "Время", accessorKey: "created_at" }
    ],
    []
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
              <InputLabel>Сортировка</InputLabel>
              <Select label="Сортировка" value={sort} onChange={(event) => setSort(event.target.value)}>
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Actor ID"
              value={actorIdFilter}
              onChange={(event) => {
                setActorIdFilter(event.target.value);
                setPage(1);
              }}
              fullWidth
            />

            <TextField
              label="Сущность"
              value={entityFilter}
              onChange={(event) => {
                setEntityFilter(event.target.value);
                setPage(1);
              }}
              fullWidth
            />

            <TextField
              label="Действие"
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
              fullWidth
            />
          </Box>

          <DataTable data={auditQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
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
