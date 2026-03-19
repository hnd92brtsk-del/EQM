import { Box, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import {
  SearchableTreeSelectField,
  type SearchableTreeSelectOption
} from "../SearchableTreeSelectField";
import { AppButton } from "../ui/AppButton";
import type { PidProcess } from "../../types/pid";

type TreeNode = { id: number; name: string; children?: TreeNode[] };

type Props = {
  canWrite: boolean;
  locationId: number | "";
  locationTree: TreeNode[];
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
  locationTree,
  processName,
  activeProcesses,
  selectedProcessId,
  onLocationChange,
  onProcessNameChange,
  onCreateProcess,
  onSelectProcess,
}: Props) {
  const { t } = useTranslation();
  const treeOptions = (nodes: TreeNode[]): SearchableTreeSelectOption[] =>
    nodes.map((node) => ({
      value: node.id,
      label: node.name,
      children: node.children ? treeOptions(node.children) : undefined
    }));

  return (
    <Box sx={{ display: "grid", gap: 1.25, p: 1.5, maxHeight: "100%", overflowY: "auto", overflowX: "hidden" }}>
      <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>
        {t("pid.page.location")}
      </Typography>
      <SearchableTreeSelectField
        label={t("pid.page.location")}
        value={locationId}
        options={treeOptions(locationTree)}
        onChange={(nextValue) => onLocationChange(nextValue === "" ? "" : Number(nextValue))}
        placeholder={t("pid.page.selectLocation")}
        emptyOptionLabel={t("pid.page.selectLocation")}
        fullWidth
        size="small"
      />

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
