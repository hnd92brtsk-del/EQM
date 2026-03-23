import { SCHEDULE_STATUSES, type ScheduleStatus } from "../types/schedule.types";

export function createEmptyCounters(): Record<ScheduleStatus, number> {
  return SCHEDULE_STATUSES.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<ScheduleStatus, number>,
  );
}

export function countStatusesByDates(
  assignmentsByDate: Record<string, ScheduleStatus | null | undefined>,
  dates: string[],
): Record<ScheduleStatus, number> {
  const counters = createEmptyCounters();

  for (const isoDate of dates) {
    const status = assignmentsByDate[isoDate];
    if (status && status in counters) {
      counters[status] += 1;
    }
  }

  return counters;
}
