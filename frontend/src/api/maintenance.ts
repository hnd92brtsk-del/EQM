import { apiFetch } from "./client";
import { type Pagination, buildQuery } from "./entities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MntDict = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  category?: string | null;
  equipment_category_id?: number | null;
  parent_id?: number | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type MntIncident = {
  id: number;
  incident_number: string | null;
  cabinet_id: number;
  location_id: number | null;
  severity: string | null;
  detection_method_id: number | null;
  failure_mode_id: number | null;
  failure_mechanism_id: number | null;
  failure_cause_id: number | null;
  status: string;
  occurred_at: string;
  detected_at: string;
  repair_started_at: string | null;
  resolved_at: string | null;
  title: string;
  description: string | null;
  root_cause_analysis: string | null;
  resolution_notes: string | null;
  man_hours: number | null;
  downtime_hours: number | null;
  operational_impact: string | null;
  reported_by_id: number;
  assigned_to_id: number | null;
  cabinet_name: string | null;
  reported_by_username: string | null;
  failure_mode_name: string | null;
  failure_mechanism_name: string | null;
  failure_cause_name: string | null;
  detection_method_name: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type MntIncidentComponent = {
  id: number;
  incident_id: number;
  cabinet_item_id: number;
  equipment_type_id: number | null;
  failure_mode_id: number | null;
  damage_description: string | null;
  action_taken: string | null;
  equipment_type_name: string | null;
  failure_mode_name: string | null;
  created_at: string;
};

export type MntWorkOrder = {
  id: number;
  order_number: string | null;
  order_type: string;
  activity_type_id: number | null;
  priority: string;
  status: string;
  cabinet_id: number | null;
  incident_id: number | null;
  plan_id: number | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  estimated_man_hours: number | null;
  actual_man_hours: number | null;
  assigned_to_id: number | null;
  performed_by_id: number;
  title: string;
  description: string | null;
  completion_notes: string | null;
  cabinet_name: string | null;
  activity_type_name: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type MntPlan = {
  id: number;
  name: string;
  code: string | null;
  equipment_category_id: number | null;
  equipment_type_id: number | null;
  cabinet_id: number | null;
  interval_days: number;
  activity_type_id: number | null;
  estimated_man_hours: number | null;
  description: string | null;
  last_generated_date: string | null;
  next_due_date: string | null;
  cabinet_name: string | null;
  activity_type_name: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type MntOperatingTime = {
  id: number;
  cabinet_id: number;
  recorded_date: string;
  operating_hours: number;
  standby_hours: number;
  downtime_hours: number;
  recorded_by_id: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  cabinet_name: string | null;
};

export type ReliabilitySummary = {
  cabinet_id: number | null;
  cabinet_name: string | null;
  total_incidents: number;
  total_operating_hours: number;
  total_downtime_hours: number;
  mtbf_hours: number | null;
  mttr_hours: number | null;
  availability_pct: number | null;
};

export type FailureTrendPoint = {
  period: string;
  incident_count: number;
};

export type TopFailure = {
  equipment_type_id: number;
  equipment_type_name: string | null;
  incident_count: number;
};

// ---------------------------------------------------------------------------
// Dictionary API
// ---------------------------------------------------------------------------

const dictEndpoints = {
  failureModes: "/maintenance/failure-modes",
  failureMechanisms: "/maintenance/failure-mechanisms",
  failureCauses: "/maintenance/failure-causes",
  detectionMethods: "/maintenance/detection-methods",
  activityTypes: "/maintenance/activity-types",
} as const;

export function listMntDict(kind: keyof typeof dictEndpoints, params: Record<string, any> = {}) {
  return apiFetch<Pagination<MntDict>>(`${dictEndpoints[kind]}${buildQuery(params)}`);
}

export function createMntDict(kind: keyof typeof dictEndpoints, payload: any) {
  return apiFetch<MntDict>(dictEndpoints[kind], { method: "POST", body: JSON.stringify(payload) });
}

export function updateMntDict(kind: keyof typeof dictEndpoints, id: number, payload: any) {
  return apiFetch<MntDict>(`${dictEndpoints[kind]}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteMntDict(kind: keyof typeof dictEndpoints, id: number) {
  return apiFetch<void>(`${dictEndpoints[kind]}/${id}`, { method: "DELETE" });
}

export function restoreMntDict(kind: keyof typeof dictEndpoints, id: number) {
  return apiFetch<void>(`${dictEndpoints[kind]}/${id}/restore`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Incidents API
// ---------------------------------------------------------------------------

export function listIncidents(params: Record<string, any> = {}) {
  return apiFetch<Pagination<MntIncident>>(`/maintenance/incidents/${buildQuery(params)}`);
}

export function getIncident(id: number) {
  return apiFetch<MntIncident>(`/maintenance/incidents/${id}`);
}

export function createIncident(payload: any) {
  return apiFetch<MntIncident>("/maintenance/incidents/", { method: "POST", body: JSON.stringify(payload) });
}

export function updateIncident(id: number, payload: any) {
  return apiFetch<MntIncident>(`/maintenance/incidents/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteIncident(id: number) {
  return apiFetch<void>(`/maintenance/incidents/${id}`, { method: "DELETE" });
}

export function restoreIncident(id: number) {
  return apiFetch<void>(`/maintenance/incidents/${id}/restore`, { method: "POST" });
}

export function listIncidentComponents(incidentId: number) {
  return apiFetch<MntIncidentComponent[]>(`/maintenance/incidents/${incidentId}/components`);
}

export function addIncidentComponent(incidentId: number, payload: any) {
  return apiFetch<MntIncidentComponent>(`/maintenance/incidents/${incidentId}/components`, {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function deleteIncidentComponent(incidentId: number, componentId: number) {
  return apiFetch<void>(`/maintenance/incidents/${incidentId}/components/${componentId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Work Orders API
// ---------------------------------------------------------------------------

export function listWorkOrders(params: Record<string, any> = {}) {
  return apiFetch<Pagination<MntWorkOrder>>(`/maintenance/work-orders/${buildQuery(params)}`);
}

export function getWorkOrder(id: number) {
  return apiFetch<MntWorkOrder>(`/maintenance/work-orders/${id}`);
}

export function createWorkOrder(payload: any) {
  return apiFetch<MntWorkOrder>("/maintenance/work-orders/", { method: "POST", body: JSON.stringify(payload) });
}

export function updateWorkOrder(id: number, payload: any) {
  return apiFetch<MntWorkOrder>(`/maintenance/work-orders/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteWorkOrder(id: number) {
  return apiFetch<void>(`/maintenance/work-orders/${id}`, { method: "DELETE" });
}

export function restoreWorkOrder(id: number) {
  return apiFetch<void>(`/maintenance/work-orders/${id}/restore`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Plans API
// ---------------------------------------------------------------------------

export function listPlans(params: Record<string, any> = {}) {
  return apiFetch<Pagination<MntPlan>>(`/maintenance/plans/${buildQuery(params)}`);
}

export function createPlan(payload: any) {
  return apiFetch<MntPlan>("/maintenance/plans/", { method: "POST", body: JSON.stringify(payload) });
}

export function updatePlan(id: number, payload: any) {
  return apiFetch<MntPlan>(`/maintenance/plans/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deletePlan(id: number) {
  return apiFetch<void>(`/maintenance/plans/${id}`, { method: "DELETE" });
}

export function restorePlan(id: number) {
  return apiFetch<void>(`/maintenance/plans/${id}/restore`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Operating Time API
// ---------------------------------------------------------------------------

export function listOperatingTime(params: Record<string, any> = {}) {
  return apiFetch<Pagination<MntOperatingTime>>(`/maintenance/operating-time/${buildQuery(params)}`);
}

export function createOperatingTime(payload: any) {
  return apiFetch<MntOperatingTime>("/maintenance/operating-time/", { method: "POST", body: JSON.stringify(payload) });
}

export function updateOperatingTime(id: number, payload: any) {
  return apiFetch<MntOperatingTime>(`/maintenance/operating-time/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteOperatingTime(id: number) {
  return apiFetch<void>(`/maintenance/operating-time/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Reliability API
// ---------------------------------------------------------------------------

export function getReliabilitySummary(params: Record<string, any> = {}) {
  return apiFetch<ReliabilitySummary[]>(`/maintenance/reliability/summary${buildQuery(params)}`);
}

export function getFailureTrend(params: Record<string, any> = {}) {
  return apiFetch<FailureTrendPoint[]>(`/maintenance/reliability/failure-trend${buildQuery(params)}`);
}

export function getTopFailures(params: Record<string, any> = {}) {
  return apiFetch<TopFailure[]>(`/maintenance/reliability/top-failures${buildQuery(params)}`);
}
