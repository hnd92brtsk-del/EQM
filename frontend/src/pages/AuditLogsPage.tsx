import { useMemo } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

import { DataTable } from "../components/DataTable";
import { listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 200;

type AuditLog = {
  id: number;
  actor_id: number;
  action: string;
  entity: string;
  entity_id?: number | null;
  created_at: string;
};

export default function AuditLogsPage() {
  const { user } = useAuth();
  const auditQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => listEntity<AuditLog>("/audit-logs", { page: 1, page_size: PAGE_SIZE })
  });

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

  if (user?.role !== "admin") {
    return <Typography>Недостаточно прав.</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Аудит</Typography>
      <Card>
        <CardContent>
          <DataTable data={auditQuery.data?.items || []} columns={columns} />
        </CardContent>
      </Card>
    </Box>
  );
}
