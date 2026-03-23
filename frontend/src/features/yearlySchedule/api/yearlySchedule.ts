import { apiFetch } from "../../../api/client";

import type {
  YearlyScheduleResponse,
  YearlyScheduleSummaryResponse,
  ScheduleStatus,
  YearlyScheduleAssignment,
  YearlyScheduleEvent,
} from "../types/schedule.types";

export function getYearlySchedule(year: number) {
  return apiFetch<YearlyScheduleResponse>(`/personnel/schedules/yearly?year=${year}`);
}

export function getYearlyScheduleSummary(year: number) {
  return apiFetch<YearlyScheduleSummaryResponse>(`/personnel/schedules/yearly/summary?year=${year}`);
}

export function updateYearlyScheduleStatuses(
  year: number,
  operations: Array<{
    personnel_id: number;
    from_date: string;
    to_date: string;
    status: ScheduleStatus;
  }>,
) {
  return apiFetch<YearlyScheduleAssignment[]>("/personnel/schedules/yearly/statuses", {
    method: "PATCH",
    body: JSON.stringify({ year, operations }),
  });
}

export function fillYearlyScheduleMonth(
  year: number,
  personnel_id: number,
  month: number,
  status: ScheduleStatus,
) {
  return apiFetch<YearlyScheduleAssignment[]>("/personnel/schedules/yearly/month-fill", {
    method: "PATCH",
    body: JSON.stringify({ year, personnel_id, month, status }),
  });
}

export function upsertYearlyScheduleEvent(
  year: number,
  personnel_id: number,
  iso_date: string,
  label: string,
) {
  return apiFetch<YearlyScheduleEvent>("/personnel/schedules/yearly/event", {
    method: "PUT",
    body: JSON.stringify({ year, personnel_id, iso_date, label }),
  });
}

export function deleteYearlyScheduleEvent(year: number, personnel_id: number, iso_date: string) {
  return apiFetch<{ status: string }>("/personnel/schedules/yearly/event", {
    method: "DELETE",
    body: JSON.stringify({ year, personnel_id, iso_date }),
  });
}
