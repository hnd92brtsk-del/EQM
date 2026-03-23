import type { ReactNode, RefObject } from "react";
import { Box, Checkbox, Typography } from "@mui/material";

import type { CalendarDay, ScheduleStatus, SelectedCell, YearlyScheduleEmployee } from "../types/schedule.types";
import { scheduleStatusColors } from "../utils/status-colors";

type Props = {
  employees: YearlyScheduleEmployee[];
  days: CalendarDay[];
  assignmentsByEmployee: Record<number, Record<string, ScheduleStatus | null>>;
  eventsByEmployee: Record<number, Record<string, string | null>>;
  selectedCell: SelectedCell;
  selectedEmployeeId: number | null;
  showOnlyMonth: boolean;
  onShowOnlyMonthChange: (value: boolean) => void;
  onEmployeeSelect: (employeeId: number) => void;
  onCellSelect: (employeeId: number, isoDate: string) => void;
  scrollContainerRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
  canWrite: boolean;
};

export function ScheduleGrid({
  employees,
  days,
  assignmentsByEmployee,
  eventsByEmployee,
  selectedCell,
  selectedEmployeeId,
  showOnlyMonth,
  onShowOnlyMonthChange,
  onEmployeeSelect,
  onCellSelect,
  scrollContainerRef,
  onScroll,
}: Props) {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h6">Таблица расписания</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Checkbox checked={showOnlyMonth} onChange={(event) => onShowOnlyMonthChange(event.target.checked)} />
          <Typography variant="body2">Показывать только выбранный месяц</Typography>
        </Box>
      </Box>

      <Box
        ref={scrollContainerRef}
        onScroll={onScroll}
        sx={{
          overflow: "auto",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 3,
          bgcolor: "background.paper",
          maxWidth: "100%",
        }}
      >
        <Box sx={{ width: "max-content", minWidth: "100%" }}>
          <Box sx={{ display: "flex", position: "sticky", top: 0, zIndex: 5, bgcolor: "background.paper" }}>
            <StickyHeaderCell left={0} width={220}>
              ФИО
            </StickyHeaderCell>
            <StickyHeaderCell left={220} width={160}>
              График
            </StickyHeaderCell>
            {days.map((day) => (
              <Box
                key={day.isoDate}
                sx={{
                  width: 52,
                  minWidth: 52,
                  p: 0.75,
                  textAlign: "center",
                  borderLeft: day.dayOfMonth === 1 ? "2px solid" : "1px solid",
                  borderColor: day.dayOfMonth === 1 ? "divider" : "rgba(0,0,0,0.08)",
                  borderBottom: "1px solid",
                  borderBottomColor: "divider",
                }}
              >
                <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>
                  {day.dayOfMonth}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {day.weekdayLabel}
                </Typography>
              </Box>
            ))}
          </Box>

          {employees.map((employee) => {
            const rowAssignments = assignmentsByEmployee[employee.id] || {};
            const rowEvents = eventsByEmployee[employee.id] || {};

            return (
              <Box
                key={employee.id}
                sx={{
                  display: "flex",
                  bgcolor: selectedEmployeeId === employee.id ? "rgba(25,118,210,0.04)" : "transparent",
                }}
              >
                <StickyBodyCell left={0} width={220} onClick={() => onEmployeeSelect(employee.id)}>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={employee.full_name}
                  >
                    {employee.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Нажмите для анализа
                  </Typography>
                </StickyBodyCell>
                <StickyBodyCell left={220} width={160}>
                  <Typography
                    sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={employee.schedule_label || "—"}
                  >
                    {employee.schedule_label || "—"}
                  </Typography>
                </StickyBodyCell>
                {days.map((day) => {
                  const status = rowAssignments[day.isoDate];
                  const eventLabel = rowEvents[day.isoDate];
                  const selected = selectedCell.employeeId === employee.id && selectedCell.isoDate === day.isoDate;
                  const palette = status ? scheduleStatusColors[status] : null;

                  return (
                    <Box
                      key={`${employee.id}-${day.isoDate}`}
                      onClick={() => onCellSelect(employee.id, day.isoDate)}
                      sx={{
                        width: 52,
                        minWidth: 52,
                        height: 52,
                        p: 0.25,
                        borderLeft: day.dayOfMonth === 1 ? "2px solid" : "1px solid",
                        borderBottom: "1px solid",
                        borderColor: day.dayOfMonth === 1 ? "divider" : "rgba(0,0,0,0.08)",
                        cursor: "pointer",
                      }}
                    >
                      <Box
                        title={eventLabel || status || "—"}
                        sx={{
                          height: "100%",
                          borderRadius: 1.5,
                          border: eventLabel ? "1px dashed #57728f" : "1px solid transparent",
                          outline: selected ? "2px solid #0f172a" : "none",
                          bgcolor: palette?.background || "transparent",
                          color: palette?.text || "text.secondary",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          position: "relative",
                        }}
                      >
                        {status || "—"}
                        {eventLabel ? (
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 2,
                              borderRadius: 1,
                              border: "1px dashed rgba(87,114,143,0.75)",
                              pointerEvents: "none",
                            }}
                          />
                        ) : null}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function StickyHeaderCell({ left, width, children }: { left: number; width: number; children: ReactNode }) {
  return (
    <Box
      sx={{
        position: "sticky",
        left,
        zIndex: 6,
        width,
        minWidth: width,
        p: 1.25,
        fontWeight: 700,
        borderRight: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {children}
    </Box>
  );
}

function StickyBodyCell({
  left,
  width,
  children,
  onClick,
}: {
  left: number;
  width: number;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: "sticky",
        left,
        zIndex: 4,
        width,
        minWidth: width,
        p: 1.25,
        borderRight: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {children}
    </Box>
  );
}
