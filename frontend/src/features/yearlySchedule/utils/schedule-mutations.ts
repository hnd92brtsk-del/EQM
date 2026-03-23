import type { ScheduleStatus } from "../types/schedule.types";

export function applyStatusRange(
  assignmentsByDate: Record<string, ScheduleStatus | null | undefined>,
  orderedDates: string[],
  startIsoDate: string,
  status: ScheduleStatus,
  daysForward: number,
): Record<string, ScheduleStatus | null> {
  const next = { ...assignmentsByDate } as Record<string, ScheduleStatus | null>;
  const startIndex = orderedDates.indexOf(startIsoDate);

  if (startIndex === -1) {
    return next;
  }

  const safeLength = Math.max(daysForward, 1);
  const endIndex = Math.min(startIndex + safeLength - 1, orderedDates.length - 1);
  for (let index = startIndex; index <= endIndex; index += 1) {
    next[orderedDates[index]] = status;
  }
  return next;
}

export function applyStatusToMonth(
  assignmentsByDate: Record<string, ScheduleStatus | null | undefined>,
  monthDates: string[],
  status: ScheduleStatus,
): Record<string, ScheduleStatus | null> {
  const next = { ...assignmentsByDate } as Record<string, ScheduleStatus | null>;
  for (const isoDate of monthDates) {
    next[isoDate] = status;
  }
  return next;
}
