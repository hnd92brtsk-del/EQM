import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

import { apiFetch } from "../api/client";

type DashboardOut = {
  metrics: {
    cabinets_total: number;
    equipment_types_total: number;
    warehouse_items_total: number;
    cabinet_items_total: number;
    signals_total: number;
  };
  equipment_by_type: { equipment_type_id: number; name: string; quantity: number; percent: number }[];
  equipment_by_warehouse: { warehouse_id: number; warehouse: string; quantity: number }[];
};

const COLORS = ["#1E3A5F", "#D97B41", "#7BA3C1", "#F0B37E", "#9BBF8B"];

export default function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardOut>("/dashboard")
  });

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Typography variant="h4">Дашборд</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
        <Card>
          <CardContent>
            <Typography color="text.secondary">Шкафы</Typography>
            <Typography variant="h5">{data?.metrics.cabinets_total ?? 0}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">Номенклатура</Typography>
            <Typography variant="h5">{data?.metrics.equipment_types_total ?? 0}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">Остаток на складах</Typography>
            <Typography variant="h5">{data?.metrics.warehouse_items_total ?? 0}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">В шкафах</Typography>
            <Typography variant="h5">{data?.metrics.cabinet_items_total ?? 0}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">I/O сигналы</Typography>
            <Typography variant="h5">{data?.metrics.signals_total ?? 0}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Распределение по типам
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data?.equipment_by_type || []} dataKey="quantity" nameKey="name" outerRadius={90}>
                  {(data?.equipment_by_type || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Остатки по складам
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.equipment_by_warehouse || []}>
                <XAxis dataKey="warehouse" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#1E3A5F" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
