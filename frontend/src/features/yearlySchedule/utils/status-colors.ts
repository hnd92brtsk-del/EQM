import type { ScheduleStatus } from "../types/schedule.types";

export const scheduleStatusColors: Record<
  ScheduleStatus,
  { background: string; border: string; text: string }
> = {
  МО: { background: "#E8F2FF", border: "#A4C8FF", text: "#184A8C" },
  ДЗ: { background: "#FFF2CC", border: "#F2D38B", text: "#8A5A00" },
  ДВ: { background: "#EEE7FF", border: "#C6B5FF", text: "#5F3FA3" },
  Я: { background: "#DDF8E8", border: "#9FDFB8", text: "#18633C" },
  ЯН: { background: "#FFE0E6", border: "#F2A7B5", text: "#8B2940" },
};
