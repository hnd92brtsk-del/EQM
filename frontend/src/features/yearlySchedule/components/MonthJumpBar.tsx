import { Box } from "@mui/material";

import { AppButton } from "../../../components/ui/AppButton";

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

type Props = {
  selectedMonth: number;
  onMonthSelect: (month: number) => void;
};

export function MonthJumpBar({ selectedMonth, onMonthSelect }: Props) {
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      {MONTHS.map((label, index) => (
        <AppButton
          key={label}
          size="small"
          variant={selectedMonth === index ? "contained" : "outlined"}
          onClick={() => onMonthSelect(index)}
        >
          {label}
        </AppButton>
      ))}
    </Box>
  );
}
