import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, FormControl, Grid, InputLabel, MenuItem, Select, Typography
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

import { getReliabilitySummary, getFailureTrend, getTopFailures } from "../../api/maintenance";
import { listEntity } from "../../api/entities";

type Cabinet = { id: number; name: string };

function KpiCard({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <Card sx={{ minWidth: 160, textAlign: "center" }}>
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" sx={{ mt: 0.5 }}>
          {value != null ? value : "—"}{unit && value != null ? ` ${unit}` : ""}
        </Typography>
      </CardContent>
    </Card>
  );
}

const COLORS = ["#f44336", "#ff9800", "#2196f3", "#4caf50", "#9c27b0", "#00bcd4", "#795548", "#607d8b", "#e91e63", "#3f51b5"];

export default function MntReliabilityPage() {
  const { t } = useTranslation();
  const [cabinetId, setCabinetId] = useState<number | "">("");

  const cabinetsQuery = useQuery({ queryKey: ["cabinets-lookup"], queryFn: () => listEntity<Cabinet>("/cabinets", { page_size: 200 }), staleTime: 60000 });
  const cabinets = cabinetsQuery.data?.items ?? [];

  const params = cabinetId ? { cabinet_id: cabinetId } : {};

  const summaryQuery = useQuery({
    queryKey: ["mnt-reliability-summary", cabinetId],
    queryFn: () => getReliabilitySummary(params),
  });
  const trendQuery = useQuery({
    queryKey: ["mnt-reliability-trend", cabinetId],
    queryFn: () => getFailureTrend(params),
  });
  const topQuery = useQuery({
    queryKey: ["mnt-reliability-top", cabinetId],
    queryFn: () => getTopFailures({ ...params, limit: 10 }),
  });

  const summary = summaryQuery.data ?? [];
  const trend = trendQuery.data ?? [];
  const topFailures = topQuery.data ?? [];

  const totals = useMemo(() => {
    const total_incidents = summary.reduce((s, r) => s + r.total_incidents, 0);
    const total_op = summary.reduce((s, r) => s + r.total_operating_hours, 0);
    const total_dt = summary.reduce((s, r) => s + r.total_downtime_hours, 0);
    const mtbf_vals = summary.filter(r => r.mtbf_hours != null).map(r => r.mtbf_hours!);
    const mttr_vals = summary.filter(r => r.mttr_hours != null).map(r => r.mttr_hours!);
    const avg_mtbf = mtbf_vals.length ? (mtbf_vals.reduce((a, b) => a + b, 0) / mtbf_vals.length) : null;
    const avg_mttr = mttr_vals.length ? (mttr_vals.reduce((a, b) => a + b, 0) / mttr_vals.length) : null;
    const avail = avg_mtbf != null && avg_mttr != null && (avg_mtbf + avg_mttr) > 0
      ? Math.round(avg_mtbf / (avg_mtbf + avg_mttr) * 10000) / 100 : null;
    return { total_incidents, total_op: Math.round(total_op * 100) / 100, total_dt: Math.round(total_dt * 100) / 100,
      avg_mtbf: avg_mtbf != null ? Math.round(avg_mtbf * 100) / 100 : null,
      avg_mttr: avg_mttr != null ? Math.round(avg_mttr * 100) / 100 : null,
      avail };
  }, [summary]);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">{t("mnt.reliability.title")}</Typography>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>{t("mnt.reliability.filter_cabinet")}</InputLabel>
          <Select value={cabinetId} label={t("mnt.reliability.filter_cabinet")} onChange={(e) => setCabinetId(e.target.value as number | "")}>
            <MenuItem value="">{t("mnt.reliability.all_cabinets")}</MenuItem>
            {cabinets.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* KPI cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item><KpiCard label={t("mnt.reliability.kpi.incidents")} value={totals.total_incidents} /></Grid>
        <Grid item><KpiCard label={t("mnt.reliability.kpi.operating_hours")} value={totals.total_op} unit="h" /></Grid>
        <Grid item><KpiCard label={t("mnt.reliability.kpi.downtime_hours")} value={totals.total_dt} unit="h" /></Grid>
        <Grid item><KpiCard label="MTBF" value={totals.avg_mtbf} unit="h" /></Grid>
        <Grid item><KpiCard label="MTTR" value={totals.avg_mttr} unit="h" /></Grid>
        <Grid item><KpiCard label={t("mnt.reliability.kpi.availability")} value={totals.avail} unit="%" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Failure trend */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>{t("mnt.reliability.trend_title")}</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="incident_count" stroke="#f44336" strokeWidth={2} dot={{ r: 4 }} name={t("mnt.reliability.incidents")} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top failures */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>{t("mnt.reliability.top_failures_title")}</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topFailures} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="equipment_type_name" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="incident_count" name={t("mnt.reliability.incidents")}>
                    {topFailures.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Per-cabinet table */}
        {summary.length > 1 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>{t("mnt.reliability.per_cabinet")}</Typography>
                <Box sx={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #ddd" }}>
                        <th style={{ textAlign: "left", padding: 8 }}>{t("mnt.reliability.cols.cabinet")}</th>
                        <th style={{ textAlign: "right", padding: 8 }}>{t("mnt.reliability.cols.incidents")}</th>
                        <th style={{ textAlign: "right", padding: 8 }}>{t("mnt.reliability.cols.op_hours")}</th>
                        <th style={{ textAlign: "right", padding: 8 }}>{t("mnt.reliability.cols.downtime")}</th>
                        <th style={{ textAlign: "right", padding: 8 }}>MTBF (h)</th>
                        <th style={{ textAlign: "right", padding: 8 }}>MTTR (h)</th>
                        <th style={{ textAlign: "right", padding: 8 }}>{t("mnt.reliability.cols.availability")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((r, i) => (
                        <tr key={r.cabinet_id ?? i} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: 8 }}>{r.cabinet_name}</td>
                          <td style={{ padding: 8, textAlign: "right" }}>{r.total_incidents}</td>
                          <td style={{ padding: 8, textAlign: "right" }}>{r.total_operating_hours}</td>
                          <td style={{ padding: 8, textAlign: "right" }}>{r.total_downtime_hours}</td>
                          <td style={{ padding: 8, textAlign: "right" }}>{r.mtbf_hours ?? "—"}</td>
                          <td style={{ padding: 8, textAlign: "right" }}>{r.mttr_hours ?? "—"}</td>
                          <td style={{ padding: 8, textAlign: "right" }}>{r.availability_pct != null ? `${r.availability_pct}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
