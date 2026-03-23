import type { CalendarDay } from "../types/schedule.types";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function buildCalendarDays(year: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  let index = 0;

  while (cursor.getUTCFullYear() === year) {
    const jsWeekday = cursor.getUTCDay();
    const weekday = jsWeekday === 0 ? 6 : jsWeekday - 1;

    days.push({
      index,
      isoDate: toIsoDate(cursor),
      year,
      month: cursor.getUTCMonth(),
      dayOfMonth: cursor.getUTCDate(),
      weekday,
      weekdayLabel: WEEKDAY_LABELS[weekday],
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
    index += 1;
  }

  return days;
}

export function getMonthDays(days: CalendarDay[], month: number) {
  return days.filter((day) => day.month === month);
}
