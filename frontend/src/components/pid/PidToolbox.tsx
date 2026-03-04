import { Box, Divider, List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { ISA_INSTRUMENTS, MAIN_EQUIPMENT_SYMBOLS } from "../../constants/pidPalette";

export type PidEditorMode = "select" | "delete" | "add-node" | "add-edge";

export type PidNodeInsertPreset = {
  symbolKey: string;
  label: string;
  category: "main" | "instrument" | "external";
  type: "equipment" | "instrument" | "external";
  sourceRef?: {
    source: "main-equipment" | "field-equipment" | "equipment-in-operation" | "palette";
    id?: number;
    meta?: { shapeKey?: string };
  };
};

type SourceOption = { id: number; label: string; shapeKey?: string };

type Props = {
  mode: PidEditorMode;
  onModeChange: (mode: PidEditorMode) => void;
  edgeType: "process" | "signal" | "control" | "electric";
  onEdgeTypeChange: (value: "process" | "signal" | "control" | "electric") => void;
  onPresetPick: (preset: PidNodeInsertPreset) => void;
  fieldEquipmentOptions: SourceOption[];
  inOperationOptions: SourceOption[];
};

const DND_MIME = "application/x-pid-preset";

export function PidToolbox({
  mode,
  onModeChange,
  edgeType,
  onEdgeTypeChange,
  onPresetPick,
  fieldEquipmentOptions,
  inOperationOptions,
}: Props) {
  const { t } = useTranslation();

  return (
    <Box sx={{ width: "100%", height: "100%", overflowY: "auto", color: "text.primary" }}>
      <Box sx={{ p: 1.5, display: "grid", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {t("pid.toolbox.mode")}
        </Typography>
        <List dense disablePadding>
          <ListItemButton selected={mode === "select"} onClick={() => onModeChange("select")}>
            <ListItemText primary={t("pid.toolbox.select")} primaryTypographyProps={{ color: "text.primary" }} />
          </ListItemButton>
          <ListItemButton selected={mode === "add-edge"} onClick={() => onModeChange("add-edge")}>
            <ListItemText primary={t("pid.toolbox.addEdge")} primaryTypographyProps={{ color: "text.primary" }} />
          </ListItemButton>
          <ListItemButton selected={mode === "delete"} onClick={() => onModeChange("delete")}>
            <ListItemText primary={t("pid.toolbox.delete")} primaryTypographyProps={{ color: "text.primary" }} />
          </ListItemButton>
        </List>

        <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {t("pid.toolbox.edgeType")}
        </Typography>
        <List dense disablePadding>
          {(["process", "signal", "control", "electric"] as const).map((item) => (
            <ListItemButton key={item} selected={edgeType === item} onClick={() => onEdgeTypeChange(item)}>
              <ListItemText primary={t(`pid.edges.${item}`)} primaryTypographyProps={{ color: "text.primary" }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {t("pid.toolbox.mainEquipment")}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("pid.toolbox.dragHint")}
        </Typography>
        <List dense disablePadding>
          {MAIN_EQUIPMENT_SYMBOLS.map((item) => {
            const preset: PidNodeInsertPreset = {
              symbolKey: item.key,
              label: t(item.labelKey),
              category: "main",
              type: "equipment",
              sourceRef: { source: "palette" },
            };
            return (
              <ListItemButton
                key={item.key}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(DND_MIME, JSON.stringify(preset));
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onPresetPick(preset)}
              >
                <ListItemText primary={t(item.labelKey)} primaryTypographyProps={{ color: "text.primary" }} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {t("pid.toolbox.instruments")}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("pid.toolbox.dragHint")}
        </Typography>
        <List dense disablePadding>
          {ISA_INSTRUMENTS.map((item) => {
            const preset: PidNodeInsertPreset = {
              symbolKey: item.code,
              label: t(item.labelKey),
              category: "instrument",
              type: "instrument",
              sourceRef: { source: "palette" },
            };
            return (
              <ListItemButton
                key={item.code}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(DND_MIME, JSON.stringify(preset));
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onPresetPick(preset)}
              >
                <ListItemText primary={`${item.code} - ${t(item.labelKey)}`} primaryTypographyProps={{ color: "text.primary" }} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {t("pid.toolbox.fromFieldEquipment")}
        </Typography>
        <List dense disablePadding>
          {fieldEquipmentOptions.map((item) => (
            <ListItemButton
              key={`field-${item.id}`}
              onClick={() =>
                onPresetPick({
                  symbolKey: "field-db-item",
                  label: item.label,
                  category: "external",
                  type: "external",
                  sourceRef: { source: "field-equipment", id: item.id },
                })
              }
            >
              <ListItemText primary={item.label} primaryTypographyProps={{ color: "text.primary" }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {t("pid.toolbox.fromOperation")}
        </Typography>
        <List dense disablePadding>
          {inOperationOptions.map((item) => (
            <ListItemButton
              key={`op-${item.id}`}
              onClick={() =>
                onPresetPick({
                  symbolKey: "operation-item",
                  label: item.label,
                  category: "main",
                  type: "equipment",
                  sourceRef: { source: "equipment-in-operation", id: item.id, meta: { shapeKey: item.shapeKey } },
                })
              }
            >
              <ListItemText primary={item.label} primaryTypographyProps={{ color: "text.primary" }} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Box>
  );
}

export { DND_MIME };
