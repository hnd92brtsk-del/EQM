import { Box, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";

import type { ScheduleStatus } from "../types/schedule.types";

const MONTH_OPTIONS = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

type Props = {
  year: number;
  month: number;
  status: ScheduleStatus;
  fillDays: number;
  eventDraftLabel: string;
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  onStatusChange: (value: ScheduleStatus) => void;
  onFillDaysChange: (value: number) => void;
  onEventDraftLabelChange: (value: string) => void;
  yearOptions: number[];
};

export function ScheduleToolbar({
  year,
  month,
  status,
  fillDays,
  eventDraftLabel,
  onYearChange,
  onMonthChange,
  onStatusChange,
  onFillDaysChange,
  onEventDraftLabelChange,
  yearOptions,
}: Props) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      }}
    >
      <FormControl fullWidth>
        <InputLabel>{t("yearlySchedule.fields.year")}</InputLabel>
        <Select
          label={t("yearlySchedule.fields.year")}
          value={year}
          onChange={(event) => onYearChange(Number(event.target.value))}
        >
          {yearOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel>{t("yearlySchedule.fields.month")}</InputLabel>
        <Select
          label={t("yearlySchedule.fields.month")}
          value={month}
          onChange={(event) => onMonthChange(Number(event.target.value))}
        >
          {MONTH_OPTIONS.map((option, index) => (
            <MenuItem key={option} value={index}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel>{t("yearlySchedule.fields.status")}</InputLabel>
        <Select
          label={t("yearlySchedule.fields.status")}
          value={status}
          onChange={(event) => onStatusChange(event.target.value as ScheduleStatus)}
        >
          {["МО", "ДЗ", "ДВ", "Я", "ЯН"].map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label={t("yearlySchedule.fields.fillDays")}
        type="number"
        value={fillDays}
        inputProps={{ min: 1, max: 60 }}
        onChange={(event) => onFillDaysChange(Math.max(1, Number(event.target.value || 1)))}
      />
      <TextField
        label={t("yearlySchedule.fields.eventLabel")}
        value={eventDraftLabel}
        onChange={(event) => onEventDraftLabelChange(event.target.value)}
      />
    </Box>
  );
}
