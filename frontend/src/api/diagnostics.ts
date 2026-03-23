import { apiFetch } from "./client";
import { buildQuery, type Pagination } from "./entities";

export type DiagnosticsStatus = "healthy" | "warning" | "critical" | "unknown";
export type DiagnosticsSeverity = "info" | "warning" | "error" | "critical";
export type DiagnosticsSource = "server" | "postgres" | "backend" | "frontend";
export type DiagnosticsEnvironment = "local" | "nginx" | "docker";

export type DiagnosticsCommandGroup = {
  environment: DiagnosticsEnvironment;
  title: string;
  commands: string[];
  warning: string | null;
};

export type DiagnosticsPort = {
  port: number;
  host: string;
  state: string;
  pid: number | null;
  process_name: string | null;
  command_line: string | null;
  service: string | null;
  detected_service: string | null;
  issues: string[];
};

export type DiagnosticsProcess = {
  pid: number;
  parent_pid: number | null;
  name: string;
  service: string | null;
  status: string | null;
  command_line: string | null;
  executable: string | null;
  started_at: string | null;
  uptime_seconds: number | null;
  ports: number[];
  suspicious_reasons: string[];
  can_kill: boolean;
};

export type DiagnosticsService = {
  service: string;
  display_name: string;
  status: DiagnosticsStatus;
  port: number | null;
  host: string | null;
  listener_pid: number | null;
  http_ok: boolean | null;
  process_count: number;
  warning_count: number;
  error_count: number;
  issues: string[];
  checked_at: string;
};

export type DiagnosticsSummary = {
  checked_at: string;
  host: string;
  refresh_seconds: number;
  services: DiagnosticsService[];
  ports: DiagnosticsPort[];
  process_count: number;
  warning_count: number;
  error_count: number;
};

export type DiagnosticsLogEntry = {
  id: string;
  entry_id: string;
  source: DiagnosticsSource;
  severity: DiagnosticsSeverity;
  signature: string;
  category: string;
  summary: string;
  normalized_message: string | null;
  raw_message: string;
  observed_at: string | null;
  file_path: string | null;
  line_number: number | null;
  is_low_signal: boolean;
  can_delete: boolean;
  possible_causes: string[];
  suggested_actions: string[];
  suggested_commands: DiagnosticsCommandGroup[];
};

export type DiagnosticsLogsPage = Pagination<DiagnosticsLogEntry>;

export type DiagnosticsDeleteLogsResult = {
  deleted_count: number;
  missing_entry_ids: string[];
};

export type DiagnosticsKillProcessResult = {
  pid: number;
  killed: boolean;
  message: string;
};

export async function getDiagnosticsSummary() {
  return apiFetch<DiagnosticsSummary>("/admin/diagnostics/summary");
}

export async function getDiagnosticsProcesses() {
  return apiFetch<DiagnosticsProcess[]>("/admin/diagnostics/processes");
}

export async function getDiagnosticsLogs(params: {
  source?: DiagnosticsSource | "";
  severity?: DiagnosticsSeverity | "";
  q?: string;
  include_low_signal?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}) {
  const qs = buildQuery({
    source: params.source || undefined,
    severity: params.severity || undefined,
    q: params.q || undefined,
    include_low_signal: params.include_low_signal ? "true" : undefined,
    date_from: params.date_from || undefined,
    date_to: params.date_to || undefined,
    page: params.page ?? 1,
    page_size: params.page_size ?? 20
  });
  return apiFetch<DiagnosticsLogsPage>(`/admin/diagnostics/logs${qs}`);
}

export async function deleteDiagnosticsLogs(entryIds: string[]) {
  return apiFetch<DiagnosticsDeleteLogsResult>("/admin/diagnostics/logs/delete", {
    method: "POST",
    body: JSON.stringify({ entry_ids: entryIds })
  });
}

export async function killDiagnosticsProcess(pid: number) {
  return apiFetch<DiagnosticsKillProcessResult>(`/admin/diagnostics/processes/${pid}/kill`, {
    method: "POST"
  });
}
