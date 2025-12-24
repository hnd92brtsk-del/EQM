import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

import { apiFetch } from "../api/client";
import { listEntity } from "../api/entities";
import { DataTable } from "../components/DataTable";

type EquipmentByTypeItem = {
  equipment_type_id: number;
  name: string;
  quantity: number;
  percent?: number;
};

type EquipmentByWarehouseItem = {
  warehouse_id: number;
  warehouse: string;
  quantity: number;
};

type MetricsOut = {
  cabinets_total: number;
  plc_total: number;
  relay_total: number;
  io_stations_total: number;
  other_channel_forming_total: number;
  signals_total: number;
};

type AccountingStatusItem = {
  label: string;
  count: number;
};

type CostByTypeItem = {
  equipment_type_id: number;
  name: string;
  total_cost_rub: number;
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

type EquipmentType = {
  id: number;
  name: string;
  is_channel_forming?: boolean;
  channel_count?: number;
  meta_data?: Record<string, unknown> | null;
};

type WarehouseItem = {
  id: number;
  warehouse_id: number;
  equipment_type_id: number;
  quantity: number;
};

type CabinetItem = {
  id: number;
  cabinet_id: number;
  equipment_type_id: number;
  quantity: number;
};

type Warehouse = { id: number; name: string };
type Cabinet = { id: number; name: string };
type IOSignal = { id: number };
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

const CHART_COLORS = ["#1E3A5F", "#D97B41", "#7BA3C1", "#F0B37E", "#9BBF8B", "#C8D4E3"];
const MAX_TABLE_ROWS = 10;
const PAGE_SIZE = 200;

const shouldFallback = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }
  return /not found|404|cannot get/i.test(error.message);
};

const normalizeText = (value: string | undefined | null) => (value ?? "").toLowerCase();

const getUnitPrice = (meta: Record<string, unknown> | null | undefined): number => {
  if (!meta) {
    return 0;
  }
  const candidates = ["unit_price_rub", "price_rub", "unit_price", "price"];
  for (const key of candidates) {
    const value = meta[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
};

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

export default function DashboardPage() {
  const [actionsSearch, setActionsSearch] = useState("");
  const [loginsSearch, setLoginsSearch] = useState("");
  const fallbackRef = useRef<Promise<{
    equipmentTypes: EquipmentType[];
    warehouseItems: WarehouseItem[];
    cabinetItems: CabinetItem[];
    warehouses: Warehouse[];
    cabinets: Cabinet[];
    ioSignals: IOSignal[];
    users: User[];
  }> | null>(null);

  const getFallbackData = () => {
    if (!fallbackRef.current) {
      fallbackRef.current = (async () => {
        const [equipmentTypes, warehouseItems, cabinetItems, warehouses, cabinets, ioSignals] =
          await Promise.all([
            safeFetchAllPages<EquipmentType>("/equipment-types"),
            safeFetchAllPages<WarehouseItem>("/warehouse-items"),
            safeFetchAllPages<CabinetItem>("/cabinet-items"),
            safeFetchAllPages<Warehouse>("/warehouses"),
            safeFetchAllPages<Cabinet>("/cabinets"),
            safeFetchAllPages<IOSignal>("/io-signals")
          ]);

        let users: User[] = [];
        users = await safeFetchAllPages<User>("/users");

        return {
          equipmentTypes,
          warehouseItems,
          cabinetItems,
          warehouses,
          cabinets,
          ioSignals,
          users
        };
      })();
    }
    return fallbackRef.current;
  };

  const equipmentByTypeQuery = useQuery({
    queryKey: ["dashboard", "equipment-by-type"],
    queryFn: async () => {
      try {
        return await apiFetch<EquipmentByTypeItem[]>("/dashboard/equipment-by-type");
      } catch (error) {
        if (!shouldFallback(error)) {
          throw error;
        }
        const fallback = await getFallbackData();
        const totals = new Map<number, number>();
        [...fallback.warehouseItems, ...fallback.cabinetItems].forEach((item) => {
          totals.set(item.equipment_type_id, (totals.get(item.equipment_type_id) || 0) + item.quantity);
        });
        const totalQuantity = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
        return fallback.equipmentTypes
          .map((item) => ({
            equipment_type_id: item.id,
            name: item.name,
            quantity: totals.get(item.id) || 0,
            percent: totalQuantity ? (totals.get(item.id) || 0) / totalQuantity : 0
          }))
          .filter((item) => item.quantity > 0);
      }
    }
  });

  const equipmentByWarehouseQuery = useQuery({
    queryKey: ["dashboard", "equipment-by-warehouse"],
    queryFn: async () => {
      try {
        return await apiFetch<EquipmentByWarehouseItem[]>("/dashboard/equipment-by-warehouse");
      } catch (error) {
        if (!shouldFallback(error)) {
          throw error;
        }
        const fallback = await getFallbackData();
        const totals = new Map<number, number>();
        fallback.warehouseItems.forEach((item) => {
          totals.set(item.warehouse_id, (totals.get(item.warehouse_id) || 0) + item.quantity);
        });
        const warehouseMap = new Map<number, string>();
        fallback.warehouses.forEach((warehouse) => warehouseMap.set(warehouse.id, warehouse.name));
        return Array.from(totals.entries()).map(([warehouseId, quantity]) => ({
          warehouse_id: warehouseId,
          warehouse: warehouseMap.get(warehouseId) || `Склад ${warehouseId}`,
          quantity
        }));
      }
    }
  });

  const metricsQuery = useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: async () => {
      try {
        return await apiFetch<MetricsOut>("/dashboard/metrics");
      } catch (error) {
        if (!shouldFallback(error)) {
          throw error;
        }
        const fallback = await getFallbackData();
        const totals = new Map<number, number>();
        [...fallback.warehouseItems, ...fallback.cabinetItems].forEach((item) => {
          totals.set(item.equipment_type_id, (totals.get(item.equipment_type_id) || 0) + item.quantity);
        });

        let plcTotal = 0;
        let relayTotal = 0;
        let ioStationsTotal = 0;
        let otherChannelFormingTotal = 0;

        fallback.equipmentTypes.forEach((item) => {
          const name = normalizeText(item.name);
          const quantity = totals.get(item.id) || 0;
          const isPlc = name.includes("plc") || name.includes("плк");
          const isRelay = name.includes("relay") || name.includes("реле");
          const isIoStation =
            name.includes("io") ||
            name.includes("i/o") ||
            name.includes("ввода") ||
            name.includes("вывода") ||
            name.includes("станц");

          if (isPlc) {
            plcTotal += quantity;
            return;
          }
          if (isRelay) {
            relayTotal += quantity;
            return;
          }
          if (isIoStation) {
            ioStationsTotal += quantity;
            return;
          }
          if (item.is_channel_forming) {
            otherChannelFormingTotal += quantity;
          }
        });

        return {
          cabinets_total: fallback.cabinets.length,
          plc_total: plcTotal,
          relay_total: relayTotal,
          io_stations_total: ioStationsTotal,
          other_channel_forming_total: otherChannelFormingTotal,
          signals_total: fallback.ioSignals.length
        };
      }
    }
  });

  const accountingStatusQuery = useQuery({
    queryKey: ["dashboard", "accounting-status"],
    queryFn: async () => {
      try {
        const result = await apiFetch<unknown>("/dashboard/accounting-status");
        if (Array.isArray(result)) {
          return result
            .map((item) => ({
              label: String((item as any).label ?? (item as any).name ?? "Статус"),
              count: Number((item as any).count ?? (item as any).quantity ?? 0)
            }))
            .filter((item) => Number.isFinite(item.count));
        }
        if (result && typeof result === "object") {
          const accounted = Number((result as any).accounted ?? (result as any).accounted_total ?? 0);
          const unaccounted = Number((result as any).unaccounted ?? (result as any).unaccounted_total ?? 0);
          return [
            { label: "Учтено", count: Number.isFinite(accounted) ? accounted : 0 },
            { label: "Не учтено", count: Number.isFinite(unaccounted) ? unaccounted : 0 }
          ];
        }
        return [
          { label: "Учтено", count: 0 },
          { label: "Не учтено", count: 0 }
        ];
      } catch (error) {
        if (!shouldFallback(error)) {
          throw error;
        }
        return [
          { label: "Учтено", count: 0 },
          { label: "Не учтено", count: 0 }
        ];
      }
    }
  });

  const costByTypeQuery = useQuery({
    queryKey: ["dashboard", "cost-by-type"],
    queryFn: async () => {
      try {
        return await apiFetch<CostByTypeItem[]>("/dashboard/cost-by-type");
      } catch (error) {
        if (!shouldFallback(error)) {
          throw error;
        }
        const fallback = await getFallbackData();
        const totals = new Map<number, number>();
        [...fallback.warehouseItems, ...fallback.cabinetItems].forEach((item) => {
          totals.set(item.equipment_type_id, (totals.get(item.equipment_type_id) || 0) + item.quantity);
        });
        return fallback.equipmentTypes
          .map((item) => {
            const quantity = totals.get(item.id) || 0;
            const price = getUnitPrice(item.meta_data || undefined);
            return {
              equipment_type_id: item.id,
              name: item.name,
              total_cost_rub: quantity * price
            };
          })
          .sort((a, b) => b.total_cost_rub - a.total_cost_rub);
      }
    }
  });

  const recentActionsQuery = useQuery({
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
          .map((item) => ({
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
        header: "Действие",
        cell: ({ row }) => row.original.action || row.original.movement_type || "-"
      },
      {
        header: "Сущность",
        cell: ({ row }) =>
          row.original.equipment_type ||
          row.original.entity ||
          (row.original.entity_id ? `ID ${row.original.entity_id}` : "-")
      },
      {
        header: "Пользователь",
        cell: ({ row }) => row.original.username || row.original.actor_id || "-"
      },
      {
        header: "Время",
        cell: ({ row }) => row.original.created_at || "-"
      }
    ],
    []
  );

  const loginColumns = useMemo<ColumnDef<RecentLogin>[]>(
    () => [
      {
        header: "Пользователь",
        cell: ({ row }) => row.original.username || row.original.user_id || "-"
      },
      {
        header: "Начало",
        cell: ({ row }) => row.original.started_at || "-"
      },
      {
        header: "Окончание",
        cell: ({ row }) => row.original.ended_at || "-"
      },
      {
        header: "Причина",
        cell: ({ row }) => row.original.end_reason || "-"
      }
    ],
    []
  );

  const accountingData =
    accountingStatusQuery.data && accountingStatusQuery.data.length > 0
      ? accountingStatusQuery.data
      : [
          { label: "Учтено", count: 0 },
          { label: "Не учтено", count: 0 }
        ];

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Typography variant="h4">Обзор</Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        {[
          { label: "Шкафы", value: metricsQuery.data?.cabinets_total ?? 0 },
          { label: "ПЛК", value: metricsQuery.data?.plc_total ?? 0 },
          { label: "Реле", value: metricsQuery.data?.relay_total ?? 0 },
          { label: "I/O станции", value: metricsQuery.data?.io_stations_total ?? 0 },
          { label: "Другие канал.", value: metricsQuery.data?.other_channel_forming_total ?? 0 },
          { label: "Сигналы", value: metricsQuery.data?.signals_total ?? 0 }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent>
              <Typography color="text.secondary">{item.label}</Typography>
              {metricsQuery.isLoading ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Загрузка
                  </Typography>
                </Box>
              ) : metricsQuery.error ? (
                <Typography variant="body2" color="error">
                  Ошибка
                </Typography>
              ) : (
                <Typography variant="h5">{item.value}</Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Распределение по типам
            </Typography>
            {equipmentByTypeQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Загрузка данных
                </Typography>
              </Box>
            ) : equipmentByTypeQuery.error ? (
              <Alert severity="error">Ошибка загрузки распределения по типам.</Alert>
            ) : (equipmentByTypeQuery.data || []).length === 0 ? (
              <Typography color="text.secondary">Нет данных</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={equipmentByTypeQuery.data || []} dataKey="quantity" nameKey="name" outerRadius={90}>
                    {(equipmentByTypeQuery.data || []).map((_, index) => (
                      <Cell key={`type-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Остатки по складам
            </Typography>
            {equipmentByWarehouseQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Загрузка данных
                </Typography>
              </Box>
            ) : equipmentByWarehouseQuery.error ? (
              <Alert severity="error">Ошибка загрузки остатков по складам.</Alert>
            ) : (equipmentByWarehouseQuery.data || []).length === 0 ? (
              <Typography color="text.secondary">Нет данных</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={equipmentByWarehouseQuery.data || []}
                    dataKey="quantity"
                    nameKey="warehouse"
                    outerRadius={90}
                  >
                    {(equipmentByWarehouseQuery.data || []).map((_, index) => (
                      <Cell key={`warehouse-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Учтено / не учтено
            </Typography>
            {accountingStatusQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Загрузка данных
                </Typography>
              </Box>
            ) : accountingStatusQuery.error ? (
              <Alert severity="error">Ошибка загрузки статуса учета.</Alert>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={accountingData} dataKey="count" nameKey="label" outerRadius={90}>
                    {accountingData.map((_, index) => (
                      <Cell key={`accounting-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Стоимость по типам
            </Typography>
            {costByTypeQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Загрузка данных
                </Typography>
              </Box>
            ) : costByTypeQuery.error ? (
              <Alert severity="error">Ошибка загрузки стоимости по типам.</Alert>
            ) : (costByTypeQuery.data || []).length === 0 ? (
              <Typography color="text.secondary">Нет данных</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={costByTypeQuery.data || []}>
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total_cost_rub" fill="#1E3A5F" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 2 }}>
        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">Последние действия</Typography>
            <TextField
              label="Поиск"
              value={actionsSearch}
              onChange={(event) => setActionsSearch(event.target.value)}
              fullWidth
            />
            {recentActionsQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Загрузка действий
                </Typography>
              </Box>
            ) : recentActionsQuery.error ? (
              <Alert severity="error">Ошибка загрузки действий.</Alert>
            ) : actionRows.length === 0 ? (
              <Typography color="text.secondary">Нет данных</Typography>
            ) : (
              <DataTable data={actionRows} columns={actionColumns} />
            )}
            <Typography variant="caption" color="text.secondary">
              Показаны последние {MAX_TABLE_ROWS} записей по дате.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6">Последние логины</Typography>
            <TextField
              label="Поиск"
              value={loginsSearch}
              onChange={(event) => setLoginsSearch(event.target.value)}
              fullWidth
            />
            {recentLoginsQuery.isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Загрузка логинов
                </Typography>
              </Box>
            ) : recentLoginsQuery.error ? (
              <Alert severity="error">Ошибка загрузки логинов.</Alert>
            ) : loginRows.length === 0 ? (
              <Typography color="text.secondary">Нет данных</Typography>
            ) : (
              <DataTable data={loginRows} columns={loginColumns} />
            )}
            <Typography variant="caption" color="text.secondary">
              Показаны последние {MAX_TABLE_ROWS} записей по дате.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
