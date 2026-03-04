import { Box, InputLabel, MenuItem, Select, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { AppButton } from "../ui/AppButton";
import type { PidProcess } from "../../types/pid";

type Option = { id: number; label: string };

type Props = {
  canWrite: boolean;
  locationId: number | "";
  locationOptions: Option[];
  processName: string;
  activeProcesses: PidProcess[];
  selectedProcessId: number | null;
  onLocationChange: (next: number | "") => void;
  onProcessNameChange: (next: string) => void;
  onCreateProcess: () => void;
  onSelectProcess: (id: number) => void;
};

export function PidLocationPanel({
  canWrite,
  locationId,
  locationOptions,
  processName,
  activeProcesses,
  selectedProcessId,
  onLocationChange,
  onProcessNameChange,
  onCreateProcess,
  onSelectProcess,
}: Props) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "grid", gap: 1.25, p: 1.5, maxHeight: "100%", overflowY: "auto" }}>
      <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>
        {t("pid.page.location")}
      </Typography>
      <InputLabel sx={{ color: "text.primary" }}>{t("pid.page.location")}</InputLabel>
      <Select
        size="small"
        value={locationId}
        onChange={(e) => onLocationChange(e.target.value === "" ? "" : Number(e.target.value))}
        displayEmpty
      >
        <MenuItem value="">{t("pid.page.selectLocation")}</MenuItem>
        {locationOptions.map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.label}
          </MenuItem>
        ))}
      </Select>

      {canWrite ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          <TextField
            size="small"
            label={t("pid.page.processName")}
            value={processName}
            onChange={(e) => onProcessNameChange(e.target.value)}
          />
          <AppButton variant="contained" onClick={onCreateProcess} disabled={!locationId || !processName.trim()}>
            {t("pid.page.createProcess")}
          </AppButton>
        </Box>
      ) : null}

      <Box sx={{ display: "grid", gap: 0.5 }}>
        {activeProcesses.map((item) => (
          <AppButton
            key={item.id}
            size="small"
            variant={selectedProcessId === item.id ? "contained" : "outlined"}
            onClick={() => onSelectProcess(item.id)}
          >
            {item.name}
          </AppButton>
        ))}
      </Box>
    </Box>
  );
}
