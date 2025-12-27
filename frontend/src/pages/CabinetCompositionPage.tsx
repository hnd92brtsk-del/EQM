import { Box, Card, CardContent, Typography } from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useParams } from "react-router-dom";

import { DataTable } from "../components/DataTable";

type CabinetCompositionRow = {
  name: string;
  quantity: number;
};

const columns: ColumnDef<CabinetCompositionRow>[] = [
  { header: "Позиция", accessorKey: "name" },
  { header: "Количество", accessorKey: "quantity" }
];

export default function CabinetCompositionPage() {
  const { id } = useParams();
  const title = id ? `Состав шкафа #${id}` : "Состав шкафа";

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{title}</Typography>
      <Card>
        <CardContent>
          <DataTable data={[]} columns={columns} />
        </CardContent>
      </Card>
    </Box>
  );
}
