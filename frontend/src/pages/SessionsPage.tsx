import { useMemo } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

import { DataTable } from "../components/DataTable";
import { listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 200;

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
  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => listEntity<Session>("/sessions", { page: 1, page_size: PAGE_SIZE })
  });

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

  if (user?.role !== "admin") {
    return <Typography>Недостаточно прав.</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Сессии</Typography>
      <Card>
        <CardContent>
          <DataTable data={sessionsQuery.data?.items || []} columns={columns} />
        </CardContent>
      </Card>
    </Box>
  );
}
