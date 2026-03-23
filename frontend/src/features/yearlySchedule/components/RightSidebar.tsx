import { Box, Divider, FormControl, InputLabel, MenuItem, Select, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { AppButton } from "../../../components/ui/AppButton";
import type { ScheduleStatus, SelectedCell, YearlyScheduleEmployee } from "../types/schedule.types";

type Props = {
  employees: YearlyScheduleEmployee[];
  selectedEmployeeId: number | null;
  selectedCell: SelectedCell;
  cellStatus: ScheduleStatus | null;
  cellEvent: string | null;
  employeeMonthSummary: Record<ScheduleStatus, number>;
  employeeYearSummary: Record<ScheduleStatus, number>;
  globalSummary: Record<ScheduleStatus, number>;
  selectionMode: "month" | "year";
  canWrite: boolean;
  onEmployeeSelect: (employeeId: number) => void;
  onSelectionModeChange: (value: "month" | "year") => void;
  onFillMonth: () => void;
  onToggleEvent: () => void;
};

export function RightSidebar({
  employees,
  selectedEmployeeId,
  selectedCell,
  cellStatus,
  cellEvent,
  employeeMonthSummary,
  employeeYearSummary,
  globalSummary,
  selectionMode,
  canWrite,
  onEmployeeSelect,
  onSelectionModeChange,
  onFillMonth,
  onToggleEvent,
}: Props) {
  const { t } = useTranslation();
  const employee = employees.find((item) => item.id === selectedEmployeeId);

  return (
    <Box
      sx={{
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 4,
        p: 2.5,
        display: "grid",
        gap: 2,
        alignSelf: "start",
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="h6">{t("yearlySchedule.sidebar.title")}</Typography>

      <FormControl fullWidth>
        <InputLabel>{t("yearlySchedule.fields.employee")}</InputLabel>
        <Select
          label={t("yearlySchedule.fields.employee")}
          value={selectedEmployeeId ?? ""}
          onChange={(event) => onEmployeeSelect(Number(event.target.value))}
        >
          {employees.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.full_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(15,23,42,0.05)" }}>
        <Typography variant="caption" color="text.secondary">
          График
        </Typography>
        <Typography sx={{ fontWeight: 700 }}>{employee?.schedule_label || "—"}</Typography>
      </Box>

      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>{t("yearlySchedule.sidebar.selectionMode")}</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={selectionMode}
          onChange={(_, value) => value && onSelectionModeChange(value)}
          fullWidth
        >
          <ToggleButton value="month">{t("yearlySchedule.sidebar.monthMode")}</ToggleButton>
          <ToggleButton value="year">{t("yearlySchedule.sidebar.yearMode")}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <SummaryBlock title={t("yearlySchedule.sidebar.employeeSelectionStats")} data={employeeMonthSummary} />
      <SummaryBlock title={t("yearlySchedule.sidebar.employeeYearStats")} data={employeeYearSummary} />

      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>{t("yearlySchedule.sidebar.quickActions")}</Typography>
        <AppButton variant="contained" onClick={onFillMonth} disabled={!canWrite || !selectedEmployeeId}>
          {t("yearlySchedule.actions.fillSelectedMonth")}
        </AppButton>
        <AppButton variant="outlined" onClick={onToggleEvent} disabled={!canWrite || !selectedCell.isoDate || !selectedEmployeeId}>
          {cellEvent ? t("yearlySchedule.actions.removeEvent") : t("yearlySchedule.actions.toggleEvent")}
        </AppButton>
      </Box>

      <Divider />

      <SummaryBlock title={t("yearlySchedule.sidebar.globalSummary")} data={globalSummary} />

      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>{t("yearlySchedule.sidebar.selectedCell")}</Typography>
        <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(15,23,42,0.05)" }}>
          <Typography variant="body2">Сотрудник: {employee?.full_name || "—"}</Typography>
          <Typography variant="body2">Дата: {selectedCell.isoDate || "—"}</Typography>
          <Typography variant="body2">Статус: {cellStatus || "—"}</Typography>
          <Typography variant="body2">Событие: {cellEvent || "—"}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function SummaryBlock({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {Object.entries(data).map(([key, value]) => (
          <Box
            key={key}
            sx={{
              px: 1.25,
              py: 0.75,
              borderRadius: 999,
              bgcolor: "rgba(15,23,42,0.05)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {key}: {value}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
