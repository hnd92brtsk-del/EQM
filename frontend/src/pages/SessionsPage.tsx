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

import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const pageSizeOptions = [10, 20, 50, 100];

const sortOptions = [
  { value: "-started_at", label: "По началу (новые)" },
  { value: "started_at", label: "По началу (старые)" },
  { value: "-ended_at", label: "По окончанию (новые)" },
  { value: "ended_at", label: "По окончанию (старые)" }
];

type Session = {
  id: number;
  user_id: number;
  started_at: string;
  ended_at?: string | null;
  end_reason?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

export default function SessionsPage() {
  const { user } = useAuth();
  const canView = user?.role === "admin";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-started_at");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [endReasonFilter, setEndReasonFilter] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["sessions", page, pageSize, q, sort, userIdFilter, endReasonFilter],
    queryFn: () =>
      listEntity<Session>("/sessions", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        filters: {
          user_id:
            userIdFilter && !Number.isNaN(Number(userIdFilter)) ? Number(userIdFilter) : undefined,
          end_reason: endReasonFilter || undefined
        }
      }),
    enabled: canView
  });

  useEffect(() => {
    if (sessionsQuery.error) {
      setErrorMessage(
        sessionsQuery.error instanceof Error
          ? sessionsQuery.error.message
          : "Ошибка загрузки сессий"
      );
    }
  }, [sessionsQuery.error]);

  const columns = useMemo<ColumnDef<Session>[]>(
    () => [
      { header: "ID", accessorKey: "id" },
      { header: "User", accessorKey: "user_id" },
      { header: "Начало", accessorKey: "started_at" },
      { header: "Окончание", accessorKey: "ended_at" },
      { header: "Причина", accessorKey: "end_reason" },
      { header: "IP", accessorKey: "ip_address" }
    ],
    []
  );

  if (!canView) {
    return <Typography>Недостаточно прав.</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Сессии</Typography>
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
              label="Поиск"
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
              label="User ID"
              value={userIdFilter}
              onChange={(event) => {
                setUserIdFilter(event.target.value);
                setPage(1);
              }}
              fullWidth
            />

            <TextField
              label="Причина завершения"
              value={endReasonFilter}
              onChange={(event) => {
                setEndReasonFilter(event.target.value);
                setPage(1);
              }}
              fullWidth
            />
          </Box>

          <DataTable data={sessionsQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
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
