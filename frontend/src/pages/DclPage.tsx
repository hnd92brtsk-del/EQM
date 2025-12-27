import { Box, Card, CardContent, Typography } from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "../components/DataTable";

type DclRow = {
  from: string;
  to: string;
  protocol: string;
  comment: string;
};

const columns: ColumnDef<DclRow>[] = [
  { header: "Источник", accessorKey: "from" },
  { header: "Назначение", accessorKey: "to" },
  { header: "Протокол", accessorKey: "protocol" },
  { header: "Комментарий", accessorKey: "comment" }
];

export default function DclPage() {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">DCL</Typography>
      <Card>
        <CardContent>
          <DataTable data={[]} columns={columns} />
        </CardContent>
      </Card>
    </Box>
  );
}
