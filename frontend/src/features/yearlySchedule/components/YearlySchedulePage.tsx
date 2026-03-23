import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Card, CardContent, CircularProgress, Slider, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ErrorSnackbar } from "../../../components/ErrorSnackbar";
import { AppButton } from "../../../components/ui/AppButton";
import { useAuth } from "../../../context/AuthContext";
import {
  deleteYearlyScheduleEvent,
  fillYearlyScheduleMonth,
  getYearlySchedule,
  getYearlyScheduleSummary,
  updateYearlyScheduleStatuses,
  upsertYearlyScheduleEvent,
} from "../api/yearlySchedule";
import { useCalendarDays } from "../hooks/useCalendarDays";
import { useScheduleAggregates } from "../hooks/useScheduleAggregates";
import type {
  ScheduleStatus,
  YearlyScheduleUiState,
} from "../types/schedule.types";
import { getMonthDays } from "../utils/calendar";
import { applyStatusRange, applyStatusToMonth } from "../utils/schedule-mutations";
import { MonthJumpBar } from "./MonthJumpBar";
import { RightSidebar } from "./RightSidebar";
import { ScheduleGrid } from "./ScheduleGrid";
import { ScheduleToolbar } from "./ScheduleToolbar";

function buildAssignmentsMap(
  items: Array<{ personnel_id: number; iso_date: string; status: ScheduleStatus }>,
): Record<number, Record<string, ScheduleStatus | null>> {
  const map: Record<number, Record<string, ScheduleStatus | null>> = {};
  for (const item of items) {
    map[item.personnel_id] = map[item.personnel_id] || {};
    map[item.personnel_id][item.iso_date] = item.status;
  }
  return map;
}

function buildEventsMap(
  items: Array<{ personnel_id: number; iso_date: string; label: string }>,
): Record<number, Record<string, string | null>> {
  const map: Record<number, Record<string, string | null>> = {};
  for (const item of items) {
    map[item.personnel_id] = map[item.personnel_id] || {};
    map[item.personnel_id][item.iso_date] = item.label;
  }
  return map;
}

function getInitialYear(searchParams: URLSearchParams) {
  const rawYear = Number(searchParams.get("year"));
  return Number.isFinite(rawYear) && rawYear > 2000 ? rawYear : new Date().getFullYear();
}

export default function YearlySchedulePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialYear = getInitialYear(searchParams);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uiState, setUiState] = useState<YearlyScheduleUiState>({
    selectedYear: initialYear,
    selectedMonth: new Date().getMonth(),
    showOnlyMonth: false,
    selectedEmployeeId: null,
    selectedCell: { employeeId: null, isoDate: null },
    activeStatus: "МО",
    fillDays: 1,
    eventDraftLabel: "",
    selectionMode: "year",
    showRightPanel: true,
  });
  const [localAssignments, setLocalAssignments] = useState<Record<number, Record<string, ScheduleStatus | null>>>({});
  const [localEvents, setLocalEvents] = useState<Record<number, Record<string, string | null>>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollRange, setScrollRange] = useState({ value: 0, max: 0 });

  const scheduleQuery = useQuery({
    queryKey: ["yearly-schedule", uiState.selectedYear],
    queryFn: () => getYearlySchedule(uiState.selectedYear),
  });
  const summaryQuery = useQuery({
    queryKey: ["yearly-schedule-summary", uiState.selectedYear],
    queryFn: () => getYearlyScheduleSummary(uiState.selectedYear),
  });

  const days = useCalendarDays(uiState.selectedYear);
  const visibleDays = useMemo(
    () => (uiState.showOnlyMonth ? getMonthDays(days, uiState.selectedMonth) : days),
    [days, uiState.selectedMonth, uiState.showOnlyMonth],
  );
  const selectedEmployee = scheduleQuery.data?.employees.find((item) => item.id === uiState.selectedEmployeeId);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("year", String(uiState.selectedYear));
      return next;
    });
  }, [setSearchParams, uiState.selectedYear]);

  useEffect(() => {
    if (!scheduleQuery.data) {
      return;
    }
    setLocalAssignments(buildAssignmentsMap(scheduleQuery.data.assignments));
    setLocalEvents(buildEventsMap(scheduleQuery.data.events));
    setUiState((prev) => ({
      ...prev,
      selectedEmployeeId: prev.selectedEmployeeId ?? scheduleQuery.data?.employees[0]?.id ?? null,
    }));
  }, [scheduleQuery.data]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    setScrollRange({
      value: container.scrollLeft,
      max: Math.max(container.scrollWidth - container.clientWidth, 0),
    });
  }, [visibleDays.length, uiState.showRightPanel, scheduleQuery.data?.employees.length]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["yearly-schedule", uiState.selectedYear] });
    queryClient.invalidateQueries({ queryKey: ["yearly-schedule-summary", uiState.selectedYear] });
  };

  const updateStatusesMutation = useMutation({
    mutationFn: (payload: { personnelId: number; fromDate: string; toDate: string; status: ScheduleStatus }) =>
      updateYearlyScheduleStatuses(uiState.selectedYear, [
        {
          personnel_id: payload.personnelId,
          from_date: payload.fromDate,
          to_date: payload.toDate,
          status: payload.status,
        },
      ]),
    onSuccess: refresh,
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("errors.saveFailed")),
  });

  const fillMonthMutation = useMutation({
    mutationFn: (payload: { personnelId: number; month: number; status: ScheduleStatus }) =>
      fillYearlyScheduleMonth(uiState.selectedYear, payload.personnelId, payload.month, payload.status),
    onSuccess: refresh,
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("errors.saveFailed")),
  });

  const upsertEventMutation = useMutation({
    mutationFn: (payload: { personnelId: number; isoDate: string; label: string }) =>
      upsertYearlyScheduleEvent(uiState.selectedYear, payload.personnelId, payload.isoDate, payload.label),
    onSuccess: refresh,
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("errors.saveFailed")),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (payload: { personnelId: number; isoDate: string }) =>
      deleteYearlyScheduleEvent(uiState.selectedYear, payload.personnelId, payload.isoDate),
    onSuccess: refresh,
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("errors.saveFailed")),
  });

  const { employeeMonth, employeeYear, global } = useScheduleAggregates(
    summaryQuery.data,
    selectedEmployee,
    localAssignments,
    days,
    uiState.selectedMonth,
  );

  const selectedCellStatus =
    (uiState.selectedCell.employeeId &&
      uiState.selectedCell.isoDate &&
      localAssignments[uiState.selectedCell.employeeId]?.[uiState.selectedCell.isoDate]) ||
    null;
  const selectedCellEvent =
    (uiState.selectedCell.employeeId &&
      uiState.selectedCell.isoDate &&
      localEvents[uiState.selectedCell.employeeId]?.[uiState.selectedCell.isoDate]) ||
    null;

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    setScrollRange({
      value: container.scrollLeft,
      max: Math.max(container.scrollWidth - container.clientWidth, 0),
    });
  };

  const handleMonthJump = (month: number) => {
    setUiState((prev) => ({ ...prev, selectedMonth: month }));
    const monthStartIndex = days.findIndex((day) => day.month === month);
    if (monthStartIndex === -1 || !scrollContainerRef.current) {
      return;
    }
    scrollContainerRef.current.scrollLeft = monthStartIndex * 52;
    handleScroll();
  };

  const handleCellSelect = (employeeId: number, isoDate: string) => {
    setUiState((prev) => ({
      ...prev,
      selectedEmployeeId: employeeId,
      selectedCell: { employeeId, isoDate },
    }));

    if (!canWrite) {
      return;
    }

    const orderedDates = days.map((day) => day.isoDate);
    setLocalAssignments((prev) => ({
      ...prev,
      [employeeId]: applyStatusRange(prev[employeeId] || {}, orderedDates, isoDate, uiState.activeStatus, uiState.fillDays),
    }));

    const startIndex = orderedDates.indexOf(isoDate);
    const endIndex = Math.min(startIndex + Math.max(uiState.fillDays, 1) - 1, orderedDates.length - 1);
    updateStatusesMutation.mutate({
      personnelId: employeeId,
      fromDate: isoDate,
      toDate: orderedDates[endIndex],
      status: uiState.activeStatus,
    });
  };

  const handleFillMonth = () => {
    if (!uiState.selectedEmployeeId) {
      return;
    }
    const monthDates = getMonthDays(days, uiState.selectedMonth).map((day) => day.isoDate);
    setLocalAssignments((prev) => ({
      ...prev,
      [uiState.selectedEmployeeId!]: applyStatusToMonth(
        prev[uiState.selectedEmployeeId!] || {},
        monthDates,
        uiState.activeStatus,
      ),
    }));
    fillMonthMutation.mutate({
      personnelId: uiState.selectedEmployeeId,
      month: uiState.selectedMonth,
      status: uiState.activeStatus,
    });
  };

  const handleToggleEvent = () => {
    if (!uiState.selectedEmployeeId || !uiState.selectedCell.isoDate) {
      return;
    }
    if (selectedCellEvent) {
      setLocalEvents((prev) => ({
        ...prev,
        [uiState.selectedEmployeeId!]: {
          ...(prev[uiState.selectedEmployeeId!] || {}),
          [uiState.selectedCell.isoDate!]: null,
        },
      }));
      deleteEventMutation.mutate({
        personnelId: uiState.selectedEmployeeId,
        isoDate: uiState.selectedCell.isoDate,
      });
      return;
    }
    const label = uiState.eventDraftLabel.trim();
    if (!label) {
      setErrorMessage(t("yearlySchedule.errors.eventLabelRequired"));
      return;
    }
    setLocalEvents((prev) => ({
      ...prev,
      [uiState.selectedEmployeeId!]: {
        ...(prev[uiState.selectedEmployeeId!] || {}),
        [uiState.selectedCell.isoDate!]: label,
      },
    }));
    upsertEventMutation.mutate({
      personnelId: uiState.selectedEmployeeId,
      isoDate: uiState.selectedCell.isoDate,
      label,
    });
  };

  if (scheduleQuery.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!scheduleQuery.data) {
    return <Typography>{t("yearlySchedule.errors.loadFailed")}</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: uiState.showRightPanel ? "1.3fr 1fr" : "1fr" }}>
        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
              <Box sx={{ display: "grid", gap: 0.5 }}>
                <Typography variant="h4">{t("yearlySchedule.title")}</Typography>
                <Typography color="text.secondary">{t("yearlySchedule.subtitle")}</Typography>
              </Box>
              <AppButton variant="outlined" onClick={() => setUiState((prev) => ({ ...prev, showRightPanel: !prev.showRightPanel }))}>
                {uiState.showRightPanel ? t("yearlySchedule.actions.hidePanel") : t("yearlySchedule.actions.showPanel")}
              </AppButton>
            </Box>
          </CardContent>
        </Card>

        {uiState.showRightPanel ? (
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <ScheduleToolbar
                year={uiState.selectedYear}
                month={uiState.selectedMonth}
                status={uiState.activeStatus}
                fillDays={uiState.fillDays}
                eventDraftLabel={uiState.eventDraftLabel}
                onYearChange={(value) => setUiState((prev) => ({ ...prev, selectedYear: value }))}
                onMonthChange={(value) => setUiState((prev) => ({ ...prev, selectedMonth: value }))}
                onStatusChange={(value) => setUiState((prev) => ({ ...prev, activeStatus: value }))}
                onFillDaysChange={(value) => setUiState((prev) => ({ ...prev, fillDays: value }))}
                onEventDraftLabelChange={(value) => setUiState((prev) => ({ ...prev, eventDraftLabel: value }))}
                yearOptions={[uiState.selectedYear - 1, uiState.selectedYear, uiState.selectedYear + 1]}
              />
            </CardContent>
          </Card>
        ) : null}
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: uiState.showRightPanel ? "minmax(0, 1fr) 320px" : "1fr" }}>
        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <MonthJumpBar selectedMonth={uiState.selectedMonth} onMonthSelect={handleMonthJump} />
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Горизонтальное перемещение по календарю
              </Typography>
              <Slider
                min={0}
                max={scrollRange.max || 0}
                value={Math.min(scrollRange.value, scrollRange.max || 0)}
                onChange={(_, value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollLeft = next;
                  }
                  setScrollRange((prev) => ({ ...prev, value: next }));
                }}
              />
            </Box>
            <ScheduleGrid
              employees={scheduleQuery.data.employees}
              days={visibleDays}
              assignmentsByEmployee={localAssignments}
              eventsByEmployee={localEvents}
              selectedCell={uiState.selectedCell}
              selectedEmployeeId={uiState.selectedEmployeeId}
              showOnlyMonth={uiState.showOnlyMonth}
              onShowOnlyMonthChange={(value) => setUiState((prev) => ({ ...prev, showOnlyMonth: value }))}
              onEmployeeSelect={(employeeId) => setUiState((prev) => ({ ...prev, selectedEmployeeId: employeeId }))}
              onCellSelect={handleCellSelect}
              scrollContainerRef={scrollContainerRef}
              onScroll={handleScroll}
              canWrite={canWrite}
            />
          </CardContent>
        </Card>

        {uiState.showRightPanel ? (
          <RightSidebar
            employees={scheduleQuery.data.employees}
            selectedEmployeeId={uiState.selectedEmployeeId}
            selectedCell={uiState.selectedCell}
            cellStatus={selectedCellStatus}
            cellEvent={selectedCellEvent}
            employeeMonthSummary={employeeMonth}
            employeeYearSummary={employeeYear}
            globalSummary={global}
            selectionMode={uiState.selectionMode}
            canWrite={canWrite}
            onEmployeeSelect={(employeeId) => setUiState((prev) => ({ ...prev, selectedEmployeeId: employeeId }))}
            onSelectionModeChange={(value) => setUiState((prev) => ({ ...prev, selectionMode: value }))}
            onFillMonth={handleFillMonth}
            onToggleEvent={handleToggleEvent}
          />
        ) : null}
      </Box>

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
