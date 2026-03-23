import { useMemo } from "react";

import { buildCalendarDays } from "../utils/calendar";

export function useCalendarDays(year: number) {
  return useMemo(() => buildCalendarDays(year), [year]);
}
