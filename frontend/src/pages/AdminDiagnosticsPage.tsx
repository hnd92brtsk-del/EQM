import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  deleteDiagnosticsLogs,
  getDiagnosticsLogs,
  getDiagnosticsProcesses,
  getDiagnosticsSummary,
  killDiagnosticsProcess,
  type DiagnosticsPort,
  type DiagnosticsProcess,
  type DiagnosticsSeverity,
  type DiagnosticsSource,
  type DiagnosticsSourceKind,
  type DiagnosticsStatus
} from "../api/diagnostics";
import { APP_VERSION } from "../appVersion";
import { type ColumnMeta, DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { formatDateTime as formatDateTimeValue } from "../utils/dateFormat";

const pageSizeOptions = [10, 20, 50, 100];
const refreshIntervalMs = 3_600_000;

const statusColorMap: Record<DiagnosticsStatus, "success" | "warning" | "error" | "default"> = {
  healthy: "success",
  warning: "warning",
  critical: "error",
  unknown: "default"
};

const severityColorMap: Record<DiagnosticsSeverity, "info" | "warning" | "error" | "default"> = {
  warning: "warning",
  critical: "error"
};

type DiagnosticsTab = "overview" | "processes" | "logs";
type ChartDatum = { name: string; rows?: number; totalMb?: number; tableMb?: number; indexMb?: number };

export default function AdminDiagnosticsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canView = hasPermission(user, "admin_diagnostics", "read");

  const [tab, setTab] = useState<DiagnosticsTab>("overview");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processServiceFilter, setProcessServiceFilter] = useState("");
  const [processSearch, setProcessSearch] = useState("");
  const [suspiciousOnly, setSuspiciousOnly] = useState("");
  const [logSource, setLogSource] = useState<DiagnosticsSource | "">("");
  const [logSeverity, setLogSeverity] = useState<DiagnosticsSeverity | "">("");
  const [logQuery, setLogQuery] = useState("");
  const [showLowSignal, setShowLowSignal] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(20);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["admin-diagnostics-summary"],
    queryFn: getDiagnosticsSummary,
    enabled: canView,
    refetchInterval: refreshIntervalMs
  });

  const processesQuery = useQuery({
    queryKey: ["admin-diagnostics-processes"],
    queryFn: getDiagnosticsProcesses,
    enabled: canView,
    refetchInterval: refreshIntervalMs
  });

  const logsQuery = useQuery({
    queryKey: ["admin-diagnostics-logs", logSource, logSeverity, logQuery, showLowSignal, dateFrom, dateTo, logsPage, logsPageSize],
    queryFn: () =>
      getDiagnosticsLogs({
        source: logSource,
        severity: logSeverity,
        q: logQuery,
        include_low_signal: showLowSignal,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: logsPage,
        page_size: logsPageSize
      }),
    enabled: canView,
    refetchInterval: refreshIntervalMs
  });

  const deleteLogsMutation = useMutation({
    mutationFn: (entryIds: string[]) => deleteDiagnosticsLogs(entryIds),
    onSuccess: async () => {
      setDeleteDialogOpen(false);
      setSelectedLogIds([]);
      await logsQuery.refetch();
      await summaryQuery.refetch();
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.diagnostics.errors.deleteLogs"))
  });

  const killProcessMutation = useMutation({
    mutationFn: (pid: number) => killDiagnosticsProcess(pid),
    onSuccess: async () => {
      await Promise.all([processesQuery.refetch(), summaryQuery.refetch(), logsQuery.refetch()]);
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.diagnostics.errors.killProcess"))
  });

  useEffect(() => {
    const queryError = summaryQuery.error || processesQuery.error || logsQuery.error;
    if (queryError) {
      setErrorMessage(queryError instanceof Error ? queryError.message : t("pagesUi.diagnostics.errors.load"));
    }
  }, [logsQuery.error, processesQuery.error, summaryQuery.error, t]);

  useEffect(() => {
    setSelectedLogIds([]);
  }, [logSource, logSeverity, logQuery, showLowSignal, dateFrom, dateTo, logsPage, logsPageSize]);

  const serviceOptions = useMemo(
    () => (summaryQuery.data?.services || []).map((service) => ({ value: service.service, label: service.display_name })),
    [summaryQuery.data?.services]
  );

  const databaseTables = summaryQuery.data?.database_overview.tables || [];
  const topTablesByRows = useMemo<ChartDatum[]>(
    () =>
      [...databaseTables]
        .sort((left, right) => right.row_count - left.row_count)
        .slice(0, 8)
        .map((item) => ({ name: item.table_name, rows: item.row_count })),
    [databaseTables]
  );
  const topTablesBySize = useMemo<ChartDatum[]>(
    () =>
      [...databaseTables]
        .sort((left, right) => right.total_bytes - left.total_bytes)
        .slice(0, 8)
        .map((item) => ({
          name: item.table_name,
          totalMb: bytesToMb(item.total_bytes),
          tableMb: bytesToMb(item.table_bytes),
          indexMb: bytesToMb(item.index_bytes)
        })),
    [databaseTables]
  );
  const heaviestTable = databaseTables[0] || null;
  const busiestTable = useMemo(() => [...databaseTables].sort((left, right) => right.row_count - left.row_count)[0] || null, [databaseTables]);
  const primaryServiceCount = useMemo(
    () => (summaryQuery.data?.services || []).filter((service) => service.process_count_primary > 0 || service.listener_pid).length,
    [summaryQuery.data?.services]
  );
  const auxiliaryProcessCount = useMemo(
    () => (summaryQuery.data?.services || []).reduce((sum, service) => sum + service.process_count_auxiliary, 0),
    [summaryQuery.data?.services]
  );
  const problemProcessCount = useMemo(
    () => (processesQuery.data || []).filter((process) => process.suspicious_reasons.length > 0).length,
    [processesQuery.data]
  );
  const topTablesCompact = useMemo(() => [...databaseTables].sort((left, right) => right.total_bytes - left.total_bytes).slice(0, 10), [databaseTables]);

  const filteredPorts = useMemo(() => {
    return (summaryQuery.data?.ports || []).filter((item) => {
      if (processServiceFilter && item.service !== processServiceFilter) {
        return false;
      }
      if (suspiciousOnly === "true" && item.issues.length === 0) {
        return false;
      }
      if (!processSearch) {
        return true;
      }
      const haystack = [item.service, item.detected_service, item.process_name, item.command_line, item.pid?.toString(), item.port.toString()]
        .concat([item.port_role, item.owner_role, item.explanation])
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(processSearch.toLowerCase());
    });
  }, [processSearch, processServiceFilter, summaryQuery.data?.ports, suspiciousOnly]);

  const filteredProcesses = useMemo(() => {
    return (processesQuery.data || []).filter((item) => {
      if (processServiceFilter && item.service !== processServiceFilter) {
        return false;
      }
      if (suspiciousOnly === "true" && item.suspicious_reasons.length === 0) {
        return false;
      }
      if (!processSearch) {
        return true;
      }
      const haystack = [item.service, item.name, item.status, item.command_line, item.pid.toString(), item.parent_pid?.toString(), item.ports.join(" ")]
        .concat([item.role, item.explanation, item.runtime_root_pid?.toString()])
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(processSearch.toLowerCase());
    });
  }, [processSearch, processServiceFilter, processesQuery.data, suspiciousOnly]);

  const currentLogs = logsQuery.data?.items || [];
  const selectableCurrentLogIds = currentLogs.filter((entry) => entry.can_delete).map((entry) => entry.entry_id);
  const allCurrentSelected = selectableCurrentLogIds.length > 0 && selectableCurrentLogIds.every((entryId) => selectedLogIds.includes(entryId));

  const portColumns = useMemo<ColumnDef<DiagnosticsPort>[]>(
    () => [
      { header: t("pagesUi.diagnostics.columns.service"), accessorKey: "service" },
      { header: t("pagesUi.diagnostics.columns.port"), accessorKey: "port" },
      { header: t("pagesUi.diagnostics.columns.pid"), accessorKey: "pid" },
      { header: t("pagesUi.diagnostics.columns.process"), accessorKey: "process_name" },
      { header: t("pagesUi.diagnostics.columns.detectedService"), accessorKey: "detected_service" },
      {
        header: t("pagesUi.diagnostics.columns.portRole", { defaultValue: "Роль порта" }),
        accessorKey: "port_role",
        cell: ({ row }) => (
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="body2">{row.original.port_role || row.original.owner_role || "-"}</Typography>
            <Chip size="small" variant="outlined" label={translateSourceKind(row.original.source_kind)} />
          </Stack>
        )
      },
      {
        header: t("pagesUi.diagnostics.columns.explanation", { defaultValue: "Пояснение" }),
        accessorKey: "explanation",
        cell: ({ row }) => row.original.explanation || "-",
        meta: { cellSx: { minWidth: 280 } } as ColumnMeta<DiagnosticsPort>
      },
      {
        header: t("pagesUi.diagnostics.columns.issues"),
        accessorKey: "issues",
        cell: ({ row }) => row.original.issues.length ? row.original.issues.map((issue) => translateIssue(t, issue)).join(", ") : t("pagesUi.diagnostics.empty.noIssues"),
        meta: { cellSx: { minWidth: 260 } } as ColumnMeta<DiagnosticsPort>
      },
      { header: t("pagesUi.diagnostics.columns.command"), accessorKey: "command_line", meta: { cellSx: { minWidth: 360 } } as ColumnMeta<DiagnosticsPort> }
    ],
    [t]
  );

  const processColumns = useMemo<ColumnDef<DiagnosticsProcess>[]>(
    () => [
      { header: t("pagesUi.diagnostics.columns.service"), accessorKey: "service" },
      { header: t("pagesUi.diagnostics.columns.pid"), accessorKey: "pid" },
      { header: t("pagesUi.diagnostics.columns.parentPid"), accessorKey: "parent_pid" },
      { header: t("pagesUi.diagnostics.columns.process"), accessorKey: "name" },
      {
        header: t("pagesUi.diagnostics.columns.processType", { defaultValue: "Тип процесса" }),
        accessorKey: "role",
        cell: ({ row }) => (
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="body2">{translateProcessRole(t, row.original.role)}</Typography>
            <Chip
              size="small"
              variant={row.original.is_primary_runtime ? "filled" : "outlined"}
              color={row.original.is_primary_runtime ? "success" : row.original.suspicious_reasons.length ? "warning" : "default"}
              label={row.original.is_primary_runtime ? "primary" : row.original.is_auxiliary_runtime ? "auxiliary" : "runtime"}
            />
            <Chip size="small" variant="outlined" label={translateSourceKind(row.original.source_kind)} />
          </Stack>
        )
      },
      {
        header: t("pagesUi.diagnostics.columns.runtimeRootPid", { defaultValue: "Root PID" }),
        accessorKey: "runtime_root_pid",
        cell: ({ row }) => row.original.runtime_root_pid ?? "-"
      },
      { header: t("pagesUi.diagnostics.columns.status"), accessorKey: "status" },
      { header: t("pagesUi.diagnostics.columns.ports"), accessorKey: "ports", cell: ({ row }) => (row.original.ports.length ? row.original.ports.join(", ") : "-") },
      {
        header: t("pagesUi.diagnostics.columns.explanation", { defaultValue: "Пояснение" }),
        accessorKey: "explanation",
        cell: ({ row }) => row.original.explanation || "-",
        meta: { cellSx: { minWidth: 300 } } as ColumnMeta<DiagnosticsProcess>
      },
      {
        header: t("pagesUi.diagnostics.columns.reasons"),
        accessorKey: "suspicious_reasons",
        cell: ({ row }) => row.original.suspicious_reasons.length ? row.original.suspicious_reasons.map((reason) => translateReason(t, reason)).join(", ") : t("pagesUi.diagnostics.empty.noIssues"),
        meta: { cellSx: { minWidth: 260 } } as ColumnMeta<DiagnosticsProcess>
      },
      {
        header: t("pagesUi.diagnostics.columns.actions"),
        id: "actions",
        cell: ({ row }) =>
          row.original.can_kill ? (
            <Button size="small" color="error" variant="outlined" disabled={killProcessMutation.isPending} onClick={() => killProcessMutation.mutate(row.original.pid)}>
              {t("pagesUi.diagnostics.actions.killProcess")}
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("pagesUi.diagnostics.actions.killUnavailable")}
            </Typography>
          ),
        meta: { cellSx: { minWidth: 180 } } as ColumnMeta<DiagnosticsProcess>
      },
      { header: t("pagesUi.diagnostics.columns.command"), accessorKey: "command_line", meta: { cellSx: { minWidth: 360 } } as ColumnMeta<DiagnosticsProcess> }
    ],
    [killProcessMutation.isPending, t]
  );

  const refreshAll = async () => {
    await Promise.all([summaryQuery.refetch(), processesQuery.refetch(), logsQuery.refetch()]);
  };

  const toggleLogSelection = (entryId: string) => {
    setSelectedLogIds((current) => (current.includes(entryId) ? current.filter((item) => item !== entryId) : [...current, entryId]));
  };

  const toggleSelectAllCurrentPage = () => {
    if (allCurrentSelected) {
      setSelectedLogIds((current) => current.filter((entryId) => !selectableCurrentLogIds.includes(entryId)));
      return;
    }
    setSelectedLogIds((current) => Array.from(new Set([...current, ...selectableCurrentLogIds])));
  };

  if (!canView) {
    return <Typography>{t("common.noAccess")}</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "grid", gap: 0.5 }}>
          <Typography variant="h4">{t("pages.adminDiagnostics")}</Typography>
          <Typography color="text.secondary">{t("pagesUi.diagnostics.subtitle")}</Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {t("pagesUi.diagnostics.lastCheck", { checkedAt: formatDateTime(summaryQuery.data?.checked_at, i18n.language) })}
          </Typography>
          <Button variant="contained" onClick={() => void refreshAll()} disabled={summaryQuery.isFetching || processesQuery.isFetching || logsQuery.isFetching}>
            {t("actions.refresh")}
          </Button>
        </Stack>
      </Box>

      <Tabs value={tab} onChange={(_, value: DiagnosticsTab) => setTab(value)}>
        <Tab value="overview" label={t("pagesUi.diagnostics.tabs.overview")} />
        <Tab value="processes" label={t("pagesUi.diagnostics.tabs.processes")} />
        <Tab value="logs" label={t("pagesUi.diagnostics.tabs.logs")} />
      </Tabs>

      {tab === "overview" && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Card>
            <CardContent sx={{ display: "grid", gap: 1 }}>
              <Typography variant="h6">{t("pagesUi.diagnostics.overview.title")}</Typography>
              <Typography color="text.secondary">
                {t("pagesUi.diagnostics.overview.host", { host: summaryQuery.data?.host || "-", processCount: summaryQuery.data?.process_count || 0, warningCount: summaryQuery.data?.warning_count || 0, errorCount: summaryQuery.data?.error_count || 0 })}
              </Typography>
            </CardContent>
          </Card>
          <Card
            sx={{
              border: 1,
              borderColor:
                summaryQuery.data?.runtime_topology.status === "critical"
                  ? "error.main"
                  : summaryQuery.data?.runtime_topology.status === "warning"
                    ? "warning.main"
                    : "success.main",
              bgcolor: "background.paper"
            }}
          >
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
                <Box sx={{ display: "grid", gap: 0.75 }}>
                  <Typography variant="overline" color="text.secondary">Сводка runtime</Typography>
                  <Typography variant="h5">Основные сервисы: {primaryServiceCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Дополнительные процессы PostgreSQL, reload, shell-wrapper, docker и nginx считаются служебными runtime-компонентами.
                  </Typography>
                </Box>
                <Chip color={statusColorMap[summaryQuery.data?.runtime_topology.status || "unknown"]} label={summaryQuery.data?.runtime_topology.status === "critical" ? "Нужна проверка" : summaryQuery.data?.runtime_topology.status === "warning" ? "Есть расхождения" : "Система согласована"} />
              </Box>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <Box>
                  <Typography variant="overline" color="text.secondary">Основные</Typography>
                  <Typography variant="h4">{primaryServiceCount}</Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">Служебные</Typography>
                  <Typography variant="h4">{auxiliaryProcessCount}</Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">Проблемные</Typography>
                  <Typography variant="h4">{problemProcessCount}</Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {(summaryQuery.data?.services || []).map((service) => (
                  <Chip
                    key={service.service}
                    variant="outlined"
                    label={`${service.display_name}: ${service.process_count_primary}/${service.process_count_auxiliary}`}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">{t("pagesUi.diagnostics.overview.versionLabel")}</Typography>
                <Typography variant="h5">{summaryQuery.data?.app_version || APP_VERSION}</Typography>
                <Typography variant="body2" color="text.secondary">{t("pagesUi.diagnostics.overview.versionHint")}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">База данных</Typography>
                <Typography variant="h5">{formatBytes(summaryQuery.data?.database_overview.database_bytes || 0)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {summaryQuery.data?.database_overview.database_name || "-"} @ {summaryQuery.data?.database_overview.host || "-"}:{summaryQuery.data?.database_overview.port || "-"}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Таблицы</Typography>
                <Typography variant="h5">{summaryQuery.data?.database_overview.table_count || 0}</Typography>
                <Typography variant="body2" color="text.secondary">public schema без alembic_version</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Всего записей</Typography>
                <Typography variant="h5">{formatInteger(summaryQuery.data?.database_overview.total_rows || 0, i18n.language)}</Typography>
                <Typography variant="body2" color="text.secondary">Сумма строк по ключевым таблицам БД</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Runtime-цепочка</Typography>
                <Typography variant="h5">{summaryQuery.data?.runtime_topology.status === "critical" ? "Нужна проверка" : summaryQuery.data?.runtime_topology.status === "warning" ? "Есть расхождения" : "Согласована"}</Typography>
                <Typography variant="body2" color="text.secondary">{summaryQuery.data?.runtime_topology.issues.length || 0} проблем(ы) в связке frontend/backend/database</Typography>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {(summaryQuery.data?.services || []).map((service) => (
              <Card key={service.service}>
                <CardContent sx={{ display: "grid", gap: 1.25 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                    <Typography variant="h6">{service.display_name}</Typography>
                    <Chip size="small" color={statusColorMap[service.status]} label={t(`pagesUi.diagnostics.status.${service.status}`)} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t("pagesUi.diagnostics.overview.serviceLine", { port: service.port ?? "-", pid: service.listener_pid ?? "-", http: service.http_ok === null ? "-" : service.http_ok ? "OK" : "FAIL" })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("pagesUi.diagnostics.overview.countsLine", { processCount: service.process_count, warningCount: service.warning_count, errorCount: service.error_count })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Основных процессов: {service.process_count_primary}, вспомогательных: {service.process_count_auxiliary}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {service.issues.length ? service.issues.map((issue) => <Chip key={issue} size="small" variant="outlined" label={translateIssue(t, issue)} />) : <Typography variant="body2" color="text.secondary">{t("pagesUi.diagnostics.empty.noIssues")}</Typography>}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <Card>
              <CardContent sx={{ display: "grid", gap: 2 }}>
                <Typography variant="h6">Заполняемость БД по числу записей</Typography>
                {topTablesByRows.length ? (
                  <Box sx={{ width: "100%", height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart data={topTablesByRows} margin={{ left: 8, right: 8, top: 8, bottom: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-20} textAnchor="end" height={72} interval={0} />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatInteger(value, i18n.language)} />
                        <Legend />
                        <Bar dataKey="rows" name="Строки" fill="#2ba3ff" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Alert severity="info">Не удалось собрать статистику таблиц БД.</Alert>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ display: "grid", gap: 2 }}>
                <Typography variant="h6">Размер таблиц и индексов</Typography>
                {topTablesBySize.length ? (
                  <Box sx={{ width: "100%", height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart data={topTablesBySize} margin={{ left: 8, right: 8, top: 8, bottom: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-20} textAnchor="end" height={72} interval={0} />
                        <YAxis />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)} MB`} />
                        <Legend />
                        <Bar dataKey="tableMb" name="Таблица, MB" fill="#00c49a" />
                        <Bar dataKey="indexMb" name="Индексы, MB" fill="#f4a300" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Alert severity="info">Нет данных по размеру таблиц.</Alert>
                )}
              </CardContent>
            </Card>
          </Box>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                <Box>
                  <Typography variant="h6">Top-таблицы БД</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Самая тяжёлая: {heaviestTable?.table_name || "-"}, максимум строк: {busiestTable?.table_name || "-"}, общий размер: {formatBytes(summaryQuery.data?.database_overview.database_bytes || 0)}
                  </Typography>
                </Box>
                <Chip variant="outlined" label={`Всего строк: ${formatInteger(summaryQuery.data?.database_overview.total_rows || 0, i18n.language)}`} />
              </Box>
              {topTablesCompact.length ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Таблица</TableCell>
                      <TableCell align="right">Строк</TableCell>
                      <TableCell align="right">Таблица</TableCell>
                      <TableCell align="right">Индексы</TableCell>
                      <TableCell align="right">Всего</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topTablesCompact.map((table) => (
                      <TableRow key={table.table_name} hover>
                        <TableCell>{table.table_name}</TableCell>
                        <TableCell align="right">{formatInteger(table.row_count, i18n.language)}</TableCell>
                        <TableCell align="right">{formatBytes(table.table_bytes)}</TableCell>
                        <TableCell align="right">{formatBytes(table.index_bytes)}</TableCell>
                        <TableCell align="right">{formatBytes(table.total_bytes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert severity="info">Нет данных для компактного обзора таблиц.</Alert>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Typography variant="h6">Связка приложения</Typography>
              <Box sx={{ display: "flex", alignItems: "stretch", gap: 1, flexWrap: "wrap" }}>
                {buildRuntimeChain(summaryQuery.data?.runtime_topology.nodes || []).map((item, index, items) => (
                  <Box key={`${item.key}-${index}`} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        minWidth: 148,
                        border: 1,
                        borderColor: item.status === "critical" ? "error.main" : item.status === "warning" ? "warning.main" : "divider",
                        bgcolor: item.key === "client" ? "action.hover" : "background.paper",
                        px: 1.25,
                        py: 1,
                        display: "grid",
                        gap: 0.5
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle2">{item.label}</Typography>
                        <Chip size="small" variant="outlined" label={item.badge} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{item.caption}</Typography>
                    </Box>
                    {index < items.length - 1 ? <Typography variant="h6" color="text.secondary">→</Typography> : null}
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: "grid", gap: 1 }}>
                <Typography variant="body2"><strong>Режим окружения:</strong> {translateEnvironmentMode(summaryQuery.data?.environment_mode || "unknown")}</Typography>
                <Typography variant="body2"><strong>Публичная точка входа:</strong> {summaryQuery.data?.public_entrypoint || "-"}</Typography>
                <Typography variant="body2"><strong>Frontend:</strong> {summaryQuery.data?.runtime_topology.frontend_url || "-"}</Typography>
                <Typography variant="body2"><strong>API base:</strong> {summaryQuery.data?.runtime_topology.frontend_api_base || "-"}</Typography>
                <Typography variant="body2"><strong>Backend HTTP:</strong> {summaryQuery.data?.runtime_topology.backend_http_url || "-"}</Typography>
                <Typography variant="body2"><strong>Backend listener:</strong> PID {summaryQuery.data?.runtime_topology.backend_listener_pid ?? "-"}, порт {summaryQuery.data?.runtime_topology.backend_listener_port ?? "-"}</Typography>
                <Typography variant="body2"><strong>Database:</strong> {summaryQuery.data?.runtime_topology.database_dsn || "-"}</Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" color={summaryQuery.data?.runtime_topology.is_frontend_backend_match ? "success" : "warning"} label={summaryQuery.data?.runtime_topology.is_frontend_backend_match ? "Frontend подключён к текущему backend" : "Frontend указывает на другой backend"} />
                <Chip size="small" color={summaryQuery.data?.runtime_topology.is_backend_database_local ? "success" : "warning"} label={summaryQuery.data?.runtime_topology.is_backend_database_local ? "Backend работает с локальной БД" : "Backend подключён к нестандартной БД"} />
                <Chip
                  size="small"
                  color={summaryQuery.data?.runtime_topology.backend_http_ok === true ? "success" : summaryQuery.data?.runtime_topology.backend_http_ok === false ? "error" : "default"}
                  label={summaryQuery.data?.runtime_topology.backend_http_ok === true ? "Backend HTTP OK" : summaryQuery.data?.runtime_topology.backend_http_ok === false ? "Backend HTTP FAIL" : "Backend HTTP неизвестен"}
                />
              </Stack>
              <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                {(summaryQuery.data?.runtime_topology.nodes || []).map((node) => (
                  <Box key={node.key} sx={{ border: 1, borderColor: "divider", p: 1.5, display: "grid", gap: 0.75 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2">{node.label}</Typography>
                      <Chip size="small" variant="outlined" label={translateSourceKind(node.source_kind)} />
                    </Stack>
                    <Typography variant="body2"><strong>Endpoint:</strong> {node.endpoint || "-"}</Typography>
                    {node.target ? <Typography variant="body2"><strong>Target:</strong> {node.target}</Typography> : null}
                    <Chip size="small" color={statusColorMap[node.status]} label={t(`pagesUi.diagnostics.status.${node.status}`, { defaultValue: node.status })} sx={{ width: "fit-content" }} />
                    {node.details.map((detail) => (
                      <Typography key={`${node.key}-${detail}`} variant="caption" color="text.secondary">{detail}</Typography>
                    ))}
                  </Box>
                ))}
              </Box>
              {summaryQuery.data?.runtime_topology.issues.length ? (
                <Alert severity={summaryQuery.data.runtime_topology.status === "critical" ? "error" : "warning"}>
                  {summaryQuery.data.runtime_topology.issues.join(" ")}
                </Alert>
              ) : (
                <Alert severity="success">Frontend, backend и база данных согласованы и доступны.</Alert>
              )}
              {summaryQuery.data?.database_overview.issues.length ? (
                <Alert severity="warning">{summaryQuery.data.database_overview.issues.join(" ")}</Alert>
              ) : null}
            </CardContent>
          </Card>
        </Box>
      )}

      {tab === "processes" && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Alert severity="info">EQM использует 3 основных сервиса. Дополнительные процессы это reload, shell-wrapper, PostgreSQL workers, docker и nginx-runtime.</Alert>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Typography variant="h6">{t("pagesUi.diagnostics.processes.title")}</Typography>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <TextField label={t("pagesUi.diagnostics.filters.search")} value={processSearch} onChange={(event) => setProcessSearch(event.target.value)} size="small" />
                <FormControl size="small">
                  <InputLabel>{t("pagesUi.diagnostics.filters.service")}</InputLabel>
                  <Select value={processServiceFilter} label={t("pagesUi.diagnostics.filters.service")} onChange={(event) => setProcessServiceFilter(event.target.value)}>
                    <MenuItem value="">{t("pagesUi.diagnostics.filters.all")}</MenuItem>
                    {serviceOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel>{t("pagesUi.diagnostics.filters.problemState")}</InputLabel>
                  <Select value={suspiciousOnly} label={t("pagesUi.diagnostics.filters.problemState")} onChange={(event) => setSuspiciousOnly(event.target.value)}>
                    <MenuItem value="">{t("pagesUi.diagnostics.filters.all")}</MenuItem>
                    <MenuItem value="true">{t("pagesUi.diagnostics.filters.onlyProblematic")}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Typography variant="h6">{t("pagesUi.diagnostics.processes.portsTitle")}</Typography>
              <DataTable data={filteredPorts} columns={portColumns} />
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Typography variant="h6">{t("pagesUi.diagnostics.processes.processesTitle")}</Typography>
              <DataTable data={filteredProcesses} columns={processColumns} />
            </CardContent>
          </Card>
        </Box>
      )}

      {tab === "logs" && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Typography variant="h6">{t("pagesUi.diagnostics.logs.title")}</Typography>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <FormControl size="small">
                  <InputLabel>{t("pagesUi.diagnostics.filters.source")}</InputLabel>
                  <Select value={logSource} label={t("pagesUi.diagnostics.filters.source")} onChange={(event) => { setLogSource(event.target.value as DiagnosticsSource | ""); setLogsPage(1); }}>
                    <MenuItem value="">{t("pagesUi.diagnostics.filters.all")}</MenuItem>
                    {(["server", "postgres", "backend", "frontend"] as DiagnosticsSource[]).map((item) => <MenuItem key={item} value={item}>{t(`pagesUi.diagnostics.source.${item}`)}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel>{t("pagesUi.diagnostics.filters.severity")}</InputLabel>
                  <Select value={logSeverity} label={t("pagesUi.diagnostics.filters.severity")} onChange={(event) => { setLogSeverity(event.target.value as DiagnosticsSeverity | ""); setLogsPage(1); }}>
                    <MenuItem value="">{t("pagesUi.diagnostics.filters.all")}</MenuItem>
                    {(["warning", "critical"] as DiagnosticsSeverity[]).map((item) => <MenuItem key={item} value={item}>{t(`pagesUi.diagnostics.severity.${item}`, { defaultValue: item })}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" label={t("pagesUi.diagnostics.filters.search")} value={logQuery} onChange={(event) => { setLogQuery(event.target.value); setLogsPage(1); }} />
                <TextField size="small" type="date" label={t("pagesUi.diagnostics.filters.dateFrom")} value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setLogsPage(1); }} InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="date" label={t("pagesUi.diagnostics.filters.dateTo")} value={dateTo} onChange={(event) => { setDateTo(event.target.value); setLogsPage(1); }} InputLabelProps={{ shrink: true }} />
                <FormControlLabel control={<Checkbox checked={showLowSignal} onChange={(event) => { setShowLowSignal(event.target.checked); setLogsPage(1); }} />} label={t("pagesUi.diagnostics.filters.showLowSignal")} />
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <FormControlLabel control={<Checkbox checked={allCurrentSelected} onChange={toggleSelectAllCurrentPage} />} label={t("pagesUi.diagnostics.actions.selectAllPage")} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <Typography variant="body2" color="text.secondary">{t("pagesUi.diagnostics.actions.selectedCount", { count: selectedLogIds.length })}</Typography>
                <Button color="error" variant="contained" disabled={selectedLogIds.length === 0 || deleteLogsMutation.isPending} onClick={() => setDeleteDialogOpen(true)}>
                  {t("pagesUi.diagnostics.actions.deleteSelected")}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {currentLogs.length === 0 ? (
            <Alert severity="info">{t("pagesUi.diagnostics.empty.logs")}</Alert>
          ) : (
            <Stack spacing={2}>
              {currentLogs.map((entry) => (
                <Card key={entry.entry_id}>
                  <CardContent sx={{ display: "grid", gap: 1.25 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Checkbox disabled={!entry.can_delete} checked={selectedLogIds.includes(entry.entry_id)} onChange={() => toggleLogSelection(entry.entry_id)} />
                        <Chip size="small" variant="outlined" label={t(`pagesUi.diagnostics.source.${entry.source}`)} />
                        <Chip size="small" color={severityColorMap[entry.severity]} label={t(`pagesUi.diagnostics.severity.${entry.severity}`)} />
                        {entry.is_low_signal ? <Chip size="small" variant="outlined" label={t("pagesUi.diagnostics.logs.lowSignal")} /> : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">{formatDateTime(entry.observed_at, i18n.language)}</Typography>
                    </Box>
                    <Typography variant="subtitle1">{entry.summary}</Typography>
                    {entry.normalized_message && entry.normalized_message !== entry.summary ? <Alert severity="info">{entry.normalized_message}</Alert> : null}
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{entry.raw_message}</Typography>
                    {entry.file_path ? <Typography variant="caption" color="text.secondary">{t("pagesUi.diagnostics.logs.file", { file: entry.file_path, line: entry.line_number ?? "-" })}</Typography> : null}
                    {entry.possible_causes.length > 0 && (
                      <Box sx={{ display: "grid", gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>{t("pagesUi.diagnostics.logs.causes")}</Typography>
                        {entry.possible_causes.map((item, index) => <Typography key={`${entry.entry_id}-cause-${index}`} variant="body2" color="text.secondary">- {item}</Typography>)}
                      </Box>
                    )}
                    {entry.suggested_actions.length > 0 && (
                      <Box sx={{ display: "grid", gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>{t("pagesUi.diagnostics.logs.actions")}</Typography>
                        {entry.suggested_actions.map((item, index) => <Typography key={`${entry.entry_id}-action-${index}`} variant="body2" color="text.secondary">- {item}</Typography>)}
                      </Box>
                    )}
                    {entry.suggested_commands.length > 0 && (
                      <>
                        <Divider />
                        <Box sx={{ display: "grid", gap: 1 }}>
                          <Typography variant="body2" fontWeight={600}>{t("pagesUi.diagnostics.logs.commands")}</Typography>
                          {entry.suggested_commands.map((group) => (
                            <Box key={`${entry.entry_id}-${group.environment}`} sx={{ display: "grid", gap: 0.5 }}>
                              <Typography variant="body2" fontWeight={600}>{group.title}</Typography>
                              {group.commands.map((command, index) => <Typography key={`${entry.entry_id}-${group.environment}-${index}`} variant="body2" sx={{ fontFamily: "monospace" }}>{command}</Typography>)}
                              {group.warning ? <Typography variant="caption" color="text.secondary">{group.warning}</Typography> : null}
                            </Box>
                          ))}
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
            count={logsQuery.data?.total || 0}
            page={logsPage - 1}
            onPageChange={(_, nextPage) => setLogsPage(nextPage + 1)}
            rowsPerPage={logsPageSize}
            onRowsPerPageChange={(event) => { setLogsPageSize(Number(event.target.value)); setLogsPage(1); }}
            rowsPerPageOptions={pageSizeOptions}
          />
        </Box>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t("pagesUi.diagnostics.dialogs.deleteTitle")}</DialogTitle>
        <DialogContent>
          <Typography>{t("pagesUi.diagnostics.dialogs.deleteBody", { count: selectedLogIds.length })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t("actions.cancel")}</Button>
          <Button color="error" variant="contained" disabled={deleteLogsMutation.isPending} onClick={() => deleteLogsMutation.mutate(selectedLogIds)}>
            {t("pagesUi.diagnostics.actions.confirmDelete")}
          </Button>
        </DialogActions>
      </Dialog>

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}

function translateIssue(t: ReturnType<typeof useTranslation>["t"], value: string) {
  return t(`pagesUi.diagnostics.issue.${value}`, { defaultValue: value });
}

function buildRuntimeChain(
  nodes: Array<{ key: string; label: string; source_kind: DiagnosticsSourceKind; endpoint: string | null; status: DiagnosticsStatus }>
) {
  const orderedKeys = ["frontend", "nginx", "backend", "database"];
  const orderedNodes = orderedKeys.map((key) => nodes.find((node) => node.key === key)).filter(Boolean) as Array<{
    key: string;
    label: string;
    source_kind: DiagnosticsSourceKind;
    endpoint: string | null;
    status: DiagnosticsStatus;
  }>;

  return [
    { key: "client", label: "Client", badge: "user", caption: "Пользовательский вход", status: "healthy" as DiagnosticsStatus },
    ...orderedNodes.map((node) => ({
      key: node.key,
      label: node.label,
      badge: translateSourceKind(node.source_kind),
      caption: node.endpoint || "endpoint не определён",
      status: node.status
    }))
  ];
}

function translateReason(t: ReturnType<typeof useTranslation>["t"], value: string) {
  return t(`pagesUi.diagnostics.reason.${value}`, { defaultValue: value });
}

function translateProcessRole(t: ReturnType<typeof useTranslation>["t"], value: string | null) {
  if (!value) {
    return "-";
  }
  return t(`pagesUi.diagnostics.processRole.${value}`, { defaultValue: value });
}

function translateEnvironmentMode(value: string) {
  const mapping: Record<string, string> = {
    local: "Локальный runtime",
    docker: "Docker runtime",
    nginx: "Nginx / reverse proxy",
    mixed: "Смешанное окружение",
    unknown: "Не определено"
  };
  return mapping[value] || value;
}

function translateSourceKind(value: DiagnosticsSourceKind) {
  const mapping: Record<DiagnosticsSourceKind, string> = {
    local_process: "local",
    docker_container: "docker",
    proxy: "proxy",
    config: "config",
    unknown: "unknown"
  };
  return mapping[value];
}

function formatBytes(value: number) {
  if (!value) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(current >= 100 || index === 0 ? 0 : 2)} ${units[index]}`;
}

function bytesToMb(value: number) {
  return Math.round((value / (1024 * 1024)) * 100) / 100;
}

function formatInteger(value: number, language: string) {
  return new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US").format(value);
}

function formatDateTime(value: string | null | undefined, language: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  void language;
  return formatDateTimeValue(value, { invalidFallback: value });
}
