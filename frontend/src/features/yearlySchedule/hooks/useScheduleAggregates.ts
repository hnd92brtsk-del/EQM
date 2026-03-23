import { useMemo } from "react";

import type {
  CalendarDay,
  ScheduleStatus,
  YearlyScheduleEmployee,
  YearlyScheduleSummaryResponse,
} from "../types/schedule.types";
import { countStatusesByDates, createEmptyCounters } from "../utils/schedule-aggregates";

export function useScheduleAggregates(
  summary: YearlyScheduleSummaryResponse | undefined,
  selectedEmployee: YearlyScheduleEmployee | undefined,
  assignmentsByEmployee: Record<number, Record<string, ScheduleStatus | null>>,
  days: CalendarDay[],
  selectedMonth: number,
) {
  return useMemo(() => {
    const employeeAssignments =
      (selectedEmployee && assignmentsByEmployee[selectedEmployee.id]) || ({} as Record<string, ScheduleStatus | null>);
    const monthDates = days.filter((day) => day.month === selectedMonth).map((day) => day.isoDate);
    const yearDates = days.map((day) => day.isoDate);

    const employeeMonth =
      summary?.employees[String(selectedEmployee?.id ?? "")]?.months[String(selectedMonth)] ||
      countStatusesByDates(employeeAssignments, monthDates);
    const employeeYear =
      summary?.employees[String(selectedEmployee?.id ?? "")]?.year ||
      countStatusesByDates(employeeAssignments, yearDates);

    return {
      employeeMonth,
      employeeYear,
      global: summary?.global || createEmptyCounters(),
    };
  }, [assignmentsByEmployee, days, selectedEmployee, selectedMonth, summary]);
}
