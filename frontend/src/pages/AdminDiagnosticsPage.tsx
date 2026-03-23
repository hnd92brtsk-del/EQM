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
  TablePagination,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

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
  type DiagnosticsStatus
} from "../api/diagnostics";
import { type ColumnMeta, DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { useAuth } from "../context/AuthContext";

const pageSizeOptions = [10, 20, 50, 100];
const refreshIntervalMs = 3_600_000;

const statusColorMap: Record<DiagnosticsStatus, "success" | "warning" | "error" | "default"> = {
  healthy: "success",
  warning: "warning",
  critical: "error",
  unknown: "default"
};

const severityColorMap: Record<DiagnosticsSeverity, "info" | "warning" | "error" | "default"> = {
  info: "info",
  warning: "warning",
  error: "error",
  critical: "error"
};

type DiagnosticsTab = "overview" | "processes" | "logs";

export default function AdminDiagnosticsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canView = user?.role === "admin";

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
      { header: t("pagesUi.diagnostics.columns.status"), accessorKey: "status" },
      { header: t("pagesUi.diagnostics.columns.ports"), accessorKey: "ports", cell: ({ row }) => (row.original.ports.length ? row.original.ports.join(", ") : "-") },
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
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {service.issues.length ? service.issues.map((issue) => <Chip key={issue} size="small" variant="outlined" label={translateIssue(t, issue)} />) : <Typography variant="body2" color="text.secondary">{t("pagesUi.diagnostics.empty.noIssues")}</Typography>}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {tab === "processes" && (
        <Box sx={{ display: "grid", gap: 2 }}>
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
                    {(["info", "warning", "error", "critical"] as DiagnosticsSeverity[]).map((item) => <MenuItem key={item} value={item}>{t(`pagesUi.diagnostics.severity.${item}`)}</MenuItem>)}
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

function translateReason(t: ReturnType<typeof useTranslation>["t"], value: string) {
  return t(`pagesUi.diagnostics.reason.${value}`, { defaultValue: value });
}

function formatDateTime(value: string | null | undefined, language: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
