export type ScheduleStatus = "МО" | "ДЗ" | "ДВ" | "Я" | "ЯН";

export type YearlyScheduleEmployee = {
  id: number;
  full_name: string;
  schedule_label?: string | null;
  schedule_template_id?: number | null;
  is_deleted: boolean;
};

export type YearlyScheduleAssignment = {
  personnel_id: number;
  iso_date: string;
  status: ScheduleStatus;
};

export type YearlyScheduleEvent = {
  personnel_id: number;
  iso_date: string;
  label: string;
};

export type YearlyScheduleResponse = {
  year: number;
  employees: YearlyScheduleEmployee[];
  assignments: YearlyScheduleAssignment[];
  events: YearlyScheduleEvent[];
};

export type YearlyScheduleSummaryEmployee = {
  year: Record<ScheduleStatus, number>;
  months: Record<string, Record<ScheduleStatus, number>>;
};

export type YearlyScheduleSummaryResponse = {
  global: Record<ScheduleStatus, number>;
  employees: Record<string, YearlyScheduleSummaryEmployee>;
};

export type CalendarDay = {
  index: number;
  isoDate: string;
  year: number;
  month: number;
  dayOfMonth: number;
  weekday: number;
  weekdayLabel: string;
};

export type SelectedCell = {
  employeeId: number | null;
  isoDate: string | null;
};

export type YearlyScheduleUiState = {
  selectedYear: number;
  selectedMonth: number;
  showOnlyMonth: boolean;
  selectedEmployeeId: number | null;
  selectedCell: SelectedCell;
  activeStatus: ScheduleStatus;
  fillDays: number;
  eventDraftLabel: string;
  selectionMode: "month" | "year";
  showRightPanel: boolean;
};

export const SCHEDULE_STATUSES: ScheduleStatus[] = ["МО", "ДЗ", "ДВ", "Я", "ЯН"];
