import { apiFetch } from "./client";
import { buildQuery, type Pagination } from "./entities";

export type DiagnosticsStatus = "healthy" | "warning" | "critical" | "unknown";
export type DiagnosticsSeverity = "warning" | "critical";
export type DiagnosticsSource = "server" | "postgres" | "backend" | "frontend";
export type DiagnosticsEnvironment = "local" | "nginx" | "docker";
export type DiagnosticsEnvironmentMode = "local" | "docker" | "nginx" | "mixed" | "unknown";
export type DiagnosticsSourceKind = "local_process" | "docker_container" | "proxy" | "config" | "unknown";

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
  port_role: string | null;
  owner_role: string | null;
  source_kind: DiagnosticsSourceKind;
  is_primary_listener: boolean;
  explanation: string | null;
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
  role: string | null;
  source_kind: DiagnosticsSourceKind;
  runtime_root_pid: number | null;
  is_primary_runtime: boolean;
  is_auxiliary_runtime: boolean;
  explanation: string | null;
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
  process_count_total: number;
  process_count_primary: number;
  process_count_auxiliary: number;
  warning_count: number;
  error_count: number;
  issues: string[];
  checked_at: string;
};

export type DiagnosticsDatabaseTable = {
  table_name: string;
  row_count: number;
  table_bytes: number;
  index_bytes: number;
  total_bytes: number;
};

export type DiagnosticsDatabaseOverview = {
  database_name: string;
  host: string;
  port: number;
  user: string;
  database_bytes: number;
  table_count: number;
  total_rows: number;
  tables: DiagnosticsDatabaseTable[];
  issues: string[];
};

export type DiagnosticsRuntimeTopology = {
  environment_mode: DiagnosticsEnvironmentMode;
  public_entrypoint: string | null;
  frontend_url: string;
  frontend_api_base: string;
  backend_base_url: string;
  backend_http_url: string | null;
  backend_listener_pid: number | null;
  backend_listener_port: number | null;
  backend_http_ok: boolean | null;
  database_dsn: string;
  database_host: string;
  database_port: number;
  database_name: string;
  database_user: string;
  is_frontend_backend_match: boolean;
  is_backend_database_local: boolean;
  status: DiagnosticsStatus;
  nodes: DiagnosticsRuntimeNode[];
  issues: string[];
};

export type DiagnosticsRuntimeNode = {
  key: string;
  label: string;
  source_kind: DiagnosticsSourceKind;
  endpoint: string | null;
  target?: string | null;
  status: DiagnosticsStatus;
  details: string[];
};

export type DiagnosticsSummary = {
  app_version: string;
  checked_at: string;
  host: string;
  refresh_seconds: number;
  environment_mode: DiagnosticsEnvironmentMode;
  public_entrypoint: string | null;
  services: DiagnosticsService[];
  ports: DiagnosticsPort[];
  database_overview: DiagnosticsDatabaseOverview;
  runtime_topology: DiagnosticsRuntimeTopology;
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
