import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";

import { apiFetch } from "../api/client";
import { listEntity } from "../api/entities";
import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";

type DonutQtyItem = {
  name: string;
  qty: number;
};

type DonutValueItem = {
  name: string;
  value_rub: number;
};

type DashboardOverview = {
  kpis: {
    total_cabinets: number;
    total_plc_in_cabinets: number;
    total_plc_in_warehouses: number;
    ai_total: number;
    di_total: number;
    ao_total: number;
    do_total: number;
    total_channels: number;
    total_warehouse_value_rub: number;
  };
  donuts: {
    by_category: DonutQtyItem[];
    by_warehouse_qty: DonutQtyItem[];
    accounted_vs_not: DonutQtyItem[];
    by_warehouse_value: DonutValueItem[];
  };
};

type EquipmentAction = {
  id?: number;
  action?: string;
  entity?: string;
  entity_id?: number | null;
  created_at?: string;
  actor_id?: number;
  username?: string;
  movement_type?: string;
  equipment_type?: string;
};

type RecentLogin = {
  id?: number;
  user_id?: number;
  username?: string;
  started_at?: string;
  ended_at?: string | null;
  end_reason?: string | null;
};

type AuditLog = {
  id: number;
  actor_id: number;
  action: string;
  entity: string;
  entity_id?: number | null;
  created_at?: string;
};

type Session = {
  id: number;
  user_id: number;
  started_at: string;
  ended_at?: string | null;
  end_reason?: string | null;
};

type User = { id: number; username: string };

const CHART_COLORS = [
  "#00c49a",
  "#2ba3ff",
  "#f4a300",
  "#14e0b0",
  "#6ac5ff",
  "#ffbf3c",
  "#0aa37f",
  "#1f78d1"
];
const MAX_TABLE_ROWS = 10;
const PAGE_SIZE = 200;

const shouldFallback = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }
  return /not found|404|cannot get/i.test(error.message);
};

const normalizeText = (value: string | undefined | null) => (value ?? "").toLowerCase();

async function fetchAllPages<T>(path: string, params: Record<string, any> = {}) {
  let page = 1;
  const items: T[] = [];
  let total = 0;

  while (true) {
    const response = await listEntity<T>(path, { ...params, page, page_size: PAGE_SIZE });
    items.push(...response.items);
    total = response.total;
    if (items.length >= total || response.items.length === 0) {
      break;
    }
    page += 1;
  }

  return items;
}

async function safeFetchAllPages<T>(path: string, params: Record<string, any> = {}) {
  try {
    return await fetchAllPages<T>(path, params);
  } catch {
    return [];
  }
}

type KpiCardProps = {
  label: string;
  value: string;
  color: string;
  loading?: boolean;
};

function KpiCard({ label, value, color, loading }: KpiCardProps) {
  return (
    <Card>
      <CardContent sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        <Box
          sx={{
            width: 6,
            height: 44,
            borderRadius: 8,
            backgroundColor: color
          }}
        />
        <Box sx={{ display: "grid", gap: 0.5 }}>
          <Typography color="text.secondary">{label}</Typography>
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {value}
              </Typography>
            </Box>
          ) : (
            <Typography variant="h5">{value}</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

type ChannelTotalsCardProps = {
  label: string;
  labels: {
    ai: string;
    di: string;
    ao: string;
    do: string;
    total: string;
  };
  color: string;
  totals: {
    ai: number;
    di: number;
    ao: number;
    do: number;
    total: number;
  };
  loading?: boolean;
  formatter: Intl.NumberFormat;
};

function ChannelTotalsCard({ label, labels, color, totals, loading, formatter }: ChannelTotalsCardProps) {
  const entries = [
    { label: labels.ai, value: totals.ai },
    { label: labels.di, value: totals.di },
    { label: labels.ao, value: totals.ao },
    { label: labels.do, value: totals.do },
    { label: labels.total, value: totals.total }
  ];

  return (
    <Card>
      <CardContent sx={{ display: "flex", gap: 1.5, alignItems: "stretch" }}>
        <Box
          sx={{
            width: 6,
            borderRadius: 8,
            backgroundColor: color
          }}
        />
        <Box sx={{ display: "grid", gap: 1.5, flex: 1 }}>
          <Typography color="text.secondary">{label}</Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" },
              gap: 1
            }}
          >
            {entries.slice(0, 4).map((item) => (
              <Box key={item.label} sx={{ display: "grid", gap: 0.25 }}>
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="subtitle2">
                  {loading ? "…" : formatter.format(item.value)}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ borderTop: 1, borderColor: "divider", pt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {labels.total}
            </Typography>
            <Typography variant="h4">
              {loading ? "…" : formatter.format(totals.total)}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [actionsSearch, setActionsSearch] = useState("");
  const [loginsSearch, setLoginsSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fallbackRef = useRef<Promise<{ users: User[] }> | null>(null);

  const getFallbackData = () => {
    if (!fallbackRef.current) {
      fallbackRef.current = (async () => {
        const users = await safeFetchAllPages<User>("/users");
        return { users };
      })();
    }
    return fallbackRef.current;
  };

  const overviewQuery = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: async () => apiFetch<DashboardOverview>("/dashboard/overview")
  });

  useEffect(() => {
    if (overviewQuery.error) {
      setErrorMessage(t("dashboard.errors.overview"));
    }
  }, [overviewQuery.error, t]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language]
  );
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0
      }),
    [i18n.language]
  );

  const recentActionsQuery = useQuery<EquipmentAction[]>({
    queryKey: ["dashboard", "recent-actions"],
    queryFn: async () => {
      try {
        return await apiFetch<EquipmentAction[]>("/dashboard/recent-equipment-actions");
      } catch (error) {
        if (!shouldFallback(error)) {
          throw error;
        }
        const fallback = await getFallbackData();
        let logs = { items: [] as AuditLog[] };
        try {
          logs = await listEntity<AuditLog>("/audit-logs", {
            page: 1,
            page_size: MAX_TABLE_ROWS * 2,
            sort: "-created_at"
          });
        } catch {
          logs = { items: [] };
        }
        const userMap = new Map<number, string>();
        fallback.users.forEach((user) => userMap.set(user.id, user.username));
        return logs.items
          .filter((item) => {
            const entity = normalizeText(item.entity);
            return entity.includes("equipment") || entity.includes("movement");
          })
          .map<EquipmentAction>((item) => ({
            id: item.id,
            action: item.action,
            entity: item.entity,
            entity_id: item.entity_id,
            created_at: item.created_at,
            actor_id: item.actor_id,
            username: userMap.get(item.actor_id)
          }));
      }
    }
  });

  const recentLoginsQuery = useQuery({
    queryKey: ["dashboard", "recent-logins"],
    queryFn: async () => {
      try {
        return await apiFetch<RecentLogin[]>("/dashboard/recent-logins");
      } catch (error) {
        if (!shouldFallback(error)) {
          throw error;
        }
        const fallback = await getFallbackData();
        let sessions = { items: [] as Session[] };
        try {
          sessions = await listEntity<Session>("/sessions", {
            page: 1,
            page_size: MAX_TABLE_ROWS * 2,
            sort: "-started_at"
          });
        } catch {
          sessions = { items: [] };
        }
        const userMap = new Map<number, string>();
        fallback.users.forEach((user) => userMap.set(user.id, user.username));
        return sessions.items.map((item) => ({
          id: item.id,
          user_id: item.user_id,
          username: userMap.get(item.user_id),
          started_at: item.started_at,
          ended_at: item.ended_at,
          end_reason: item.end_reason
        }));
      }
    }
  });

  const actionRows = useMemo(() => {
    const raw = recentActionsQuery.data || [];
    const allowedActions = ["create", "update", "movement"];
    const filtered = raw.filter((item) => {
      if (item.movement_type) {
        return true;
      }
      const actionLabel = normalizeText(item.action);
      if (actionLabel && !allowedActions.some((entry) => actionLabel.includes(entry))) {
        return false;
      }
      if (!actionsSearch) {
        return true;
      }
      const haystack = [
        item.action,
        item.entity,
        item.equipment_type,
        item.username,
        item.created_at
      ]
        .filter(Boolean)
        .join(" ");
      return normalizeText(haystack).includes(normalizeText(actionsSearch));
    });
    return filtered
      .slice()
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "") * -1)
      .slice(0, MAX_TABLE_ROWS);
  }, [actionsSearch, recentActionsQuery.data]);

  const loginRows = useMemo(() => {
    const raw = recentLoginsQuery.data || [];
    const filtered = raw.filter((item) => {
      if (!loginsSearch) {
        return true;
      }
      const haystack = [item.username, item.user_id, item.started_at, item.ended_at, item.end_reason]
        .filter(Boolean)
        .join(" ");
      return normalizeText(haystack).includes(normalizeText(loginsSearch));
    });
    return filtered
      .slice()
      .sort((a, b) => (a.started_at || "").localeCompare(b.started_at || "") * -1)
      .slice(0, MAX_TABLE_ROWS);
  }, [loginsSearch, recentLoginsQuery.data]);

  const actionColumns = useMemo<ColumnDef<EquipmentAction>[]>(
    () => [
      {
        header: t("dashboard.columns.action"),
        cell: ({ row }) => row.original.action || row.original.movement_type || "-"
      },
      {
        header: t("dashboard.columns.entity"),
        cell: ({ row }) =>
          row.original.equipment_type ||
          row.original.entity ||
          (row.original.entity_id ? `ID ${row.original.entity_id}` : "-")
      },
      {
        header: t("dashboard.columns.user"),
        cell: ({ row }) => row.original.username || row.original.actor_id || "-"
      },
      {
        header: t("dashboard.columns.date"),
        cell: ({ row }) => row.original.created_at || "-"
      }
    ],
    [t]
  );

  const loginColumns = useMemo<ColumnDef<RecentLogin>[]>(
    () => [
      {
        header: t("dashboard.columns.user"),
        cell: ({ row }) => row.original.username || row.original.user_id || "-"
      },
      {
        header: t("dashboard.columns.login"),
        cell: ({ row }) => row.original.started_at || "-"
      },
      {
        header: t("dashboard.columns.logout"),
        cell: ({ row }) => row.original.ended_at || "-"
      },
      {
        header: t("dashboard.columns.reason"),
        cell: ({ row }) => row.original.end_reason || "-"
      }
    ],
    [t]
  );

  const kpis = overviewQuery.data?.kpis ?? {
    total_cabinets: 0,
    total_plc_in_cabinets: 0,
    total_plc_in_warehouses: 0,
    ai_total: 0,
    di_total: 0,
    ao_total: 0,
    do_total: 0,
    total_channels: 0,
    total_warehouse_value_rub: 0
  };

  const donuts = overviewQuery.data?.donuts ?? {
    by_category: [],
    by_warehouse_qty: [],
    accounted_vs_not: [],
    by_warehouse_value: []
  };

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
      <Typography variant="h4">{t("pages.dashboard")}</Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 2 }}>
        <KpiCard
          label={t("dashboard.kpis.total_cabinets")}
          value={numberFormatter.format(kpis.total_cabinets)}
          color="#00c49a"
          loading={overviewQuery.isLoading}
        />
        <KpiCard
          label={t("dashboard.kpis.total_plc_in_cabinets")}
          value={numberFormatter.format(kpis.total_plc_in_cabinets)}
          color="#2ba3ff"
          loading={overviewQuery.isLoading}
        />
        <KpiCard
          label={t("dashboard.kpis.total_plc_in_warehouses")}
          value={numberFormatter.format(kpis.total_plc_in_warehouses)}
          color="#f4a300"
          loading={overviewQuery.isLoading}
        />
        <ChannelTotalsCard
          label={t("dashboard.kpis.total_channels")}
          labels={{
            ai: t("dashboard.kpis.ai"),
            di: t("dashboard.kpis.di"),
            ao: t("dashboard.kpis.ao"),
            do: t("dashboard.kpis.do"),
            total: t("dashboard.kpis.total")
          }}
          color="#14e0b0"
          totals={{
            ai: kpis.ai_total,
            di: kpis.di_total,
            ao: kpis.ao_total,
            do: kpis.do_total,
            total: kpis.total_channels
          }}
          loading={overviewQuery.isLoading}
          formatter={numberFormatter}
        />
        <KpiCard
          label={t("dashboard.kpis.total_warehouse_value_rub")}
          value={currencyFormatter.format(kpis.total_warehouse_value_rub)}
          color="#6ac5ff"
          loading={overviewQuery.isLoading}
        />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("dashboard.titles.by_type")}
            </Typography>
            {overviewQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.common.loading")}
                </Typography>
              </Box>
            ) : donuts.by_category.length === 0 ? (
              <Typography color="text.secondary">{t("dashboard.common.no_data")}</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={donuts.by_category} dataKey="qty" nameKey="name" outerRadius={90} innerRadius={58}>
                    {donuts.by_category.map((_, index) => (
                      <Cell key={`type-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      numberFormatter.format(Number(value)),
                      props.payload?.name ?? ""
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("dashboard.titles.by_warehouse_qty")}
            </Typography>
            {overviewQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.common.loading")}
                </Typography>
              </Box>
            ) : donuts.by_warehouse_qty.length === 0 ? (
              <Typography color="text.secondary">{t("dashboard.common.no_data")}</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={donuts.by_warehouse_qty} dataKey="qty" nameKey="name" outerRadius={90} innerRadius={58}>
                    {donuts.by_warehouse_qty.map((_, index) => (
                      <Cell key={`warehouse-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${numberFormatter.format(Number(value))} ${t("dashboard.units")}`,
                      props.payload?.name ?? ""
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("dashboard.titles.accounted_vs_not")}
            </Typography>
            {overviewQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.common.loading")}
                </Typography>
              </Box>
            ) : donuts.accounted_vs_not.length === 0 ? (
              <Typography color="text.secondary">{t("dashboard.common.no_data")}</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={donuts.accounted_vs_not} dataKey="qty" nameKey="name" outerRadius={90} innerRadius={58}>
                    {donuts.accounted_vs_not.map((_, index) => (
                      <Cell key={`accounting-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      numberFormatter.format(Number(value)),
                      props.payload?.name ?? ""
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("dashboard.titles.by_warehouse_value")}
            </Typography>
            {overviewQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.common.loading")}
                </Typography>
              </Box>
            ) : donuts.by_warehouse_value.length === 0 ? (
              <Typography color="text.secondary">{t("dashboard.common.no_data")}</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={donuts.by_warehouse_value} dataKey="value_rub" nameKey="name" outerRadius={90} innerRadius={58}>
                    {donuts.by_warehouse_value.map((_, index) => (
                      <Cell key={`warehouse-value-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      currencyFormatter.format(Number(value)),
                      props.payload?.name ?? ""
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 2 }}>
        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">{t("dashboard.titles.recent_actions")}</Typography>
            <TextField
              label={t("actions.search")}
              value={actionsSearch}
              onChange={(event) => setActionsSearch(event.target.value)}
              fullWidth
            />
            {recentActionsQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.common.loading")}
                </Typography>
              </Box>
            ) : recentActionsQuery.error ? (
              <Typography variant="body2" color="error">
                {t("dashboard.errors.actions")}
              </Typography>
            ) : actionRows.length === 0 ? (
              <Typography color="text.secondary">{t("dashboard.common.no_data")}</Typography>
            ) : (
              <DataTable data={actionRows} columns={actionColumns} />
            )}
            <Typography variant="caption" color="text.secondary">
              {t("dashboard.common.last_rows", { count: MAX_TABLE_ROWS })}
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">{t("dashboard.titles.recent_logins")}</Typography>
            <TextField
              label={t("actions.search")}
              value={loginsSearch}
              onChange={(event) => setLoginsSearch(event.target.value)}
              fullWidth
            />
            {recentLoginsQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.common.loading")}
                </Typography>
              </Box>
            ) : recentLoginsQuery.error ? (
              <Typography variant="body2" color="error">
                {t("dashboard.errors.logins")}
              </Typography>
            ) : loginRows.length === 0 ? (
              <Typography color="text.secondary">{t("dashboard.common.no_data")}</Typography>
            ) : (
              <DataTable data={loginRows} columns={loginColumns} />
            )}
            <Typography variant="caption" color="text.secondary">
              {t("dashboard.common.last_rows", { count: MAX_TABLE_ROWS })}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

