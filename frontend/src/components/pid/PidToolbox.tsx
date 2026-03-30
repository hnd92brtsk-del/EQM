import { useMemo, useState } from "react";
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useTranslation } from "react-i18next";

import { ISA_INSTRUMENTS, inferMainEquipmentShapeKey } from "../../constants/pidPalette";
import { buildPidSymbolMeta, normalizePidSymbol } from "../../features/pid/symbols";
import type { PidSourceRef } from "../../types/pid";
import type { MainEquipmentTreeNode } from "../../utils/mainEquipment";
import { annotateLiveTree, type LiveTreeAnnotation } from "../../utils/liveFilter";

export type PidEditorMode = "select" | "pan" | "delete" | "add-node" | "add-edge";

export type PidNodeInsertPreset = {
  symbolKey: string;
  label: string;
  category: "main" | "instrument" | "external";
  type: "equipment" | "instrument" | "external";
  sourceRef?: PidSourceRef;
};

type Props = {
  mode: PidEditorMode;
  onModeChange: (mode: PidEditorMode) => void;
  edgeType: "process" | "signal" | "control" | "electric";
  onEdgeTypeChange: (value: "process" | "signal" | "control" | "electric") => void;
  onPresetPick: (preset: PidNodeInsertPreset) => void;
  mainEquipmentTree: MainEquipmentTreeNode[];
  showModeControls?: boolean;
  showEdgeTypeControls?: boolean;
};

type ToolboxTreeNode = {
  id: number;
  name: string;
  level: number;
  code: string;
  meta_data?: Record<string, unknown> | null;
  children: ToolboxTreeNode[];
};

const DND_MIME = "application/x-pid-preset";

function asToolboxNode(tree: MainEquipmentTreeNode[]): ToolboxTreeNode[] {
  return tree.map((node) => ({
    ...node,
    children: asToolboxNode(node.children || []),
  }));
}

export function PidToolbox({
  mode,
  onModeChange,
  edgeType,
  onEdgeTypeChange,
  onPresetPick,
  mainEquipmentTree,
  showModeControls = true,
  showEdgeTypeControls = true,
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const tree = useMemo(() => asToolboxNode(mainEquipmentTree), [mainEquipmentTree]);
  const treeAnnotations = useMemo(
    () =>
      annotateLiveTree(
        tree,
        {
          getLabel: (node) => node.name,
          getChildren: (node) => node.children
        },
        search
      ),
    [tree, search]
  );
  const forceExpand = search.trim().length > 0;

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderEquipmentNode = (entry: LiveTreeAnnotation<ToolboxTreeNode>, depth: number) => {
    const node = entry.item;
    const hasChildren = entry.children.length > 0;
    const isExpanded = forceExpand ? entry.shouldForceExpand : expandedIds.has(node.id);
    const pidSymbol = normalizePidSymbol(node.meta_data, inferMainEquipmentShapeKey(node.name));

    if (hasChildren) {
      return (
        <Box key={node.id}>
          <Box sx={{ display: "flex", alignItems: "center", pl: depth * 1.5 }}>
            <IconButton size="small" onClick={() => toggleExpanded(node.id)}>
              {isExpanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
            </IconButton>
            <Typography
              variant="body2"
              sx={{
                color: "text.primary",
                fontWeight: 600,
                pl: 0.25
              }}
            >
              {node.name}
            </Typography>
          </Box>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ display: "grid", gap: 0.25 }}>{entry.children.map((child) => renderEquipmentNode(child, depth + 1))}</Box>
          </Collapse>
        </Box>
      );
    }

    const preset: PidNodeInsertPreset = {
      symbolKey: node.code || `main-equipment-${node.id}`,
      label: node.name,
      category: "main",
      type: "equipment",
      sourceRef: { source: "main-equipment", id: node.id, name: node.name, meta: buildPidSymbolMeta(pidSymbol) },
    };

    return (
      <ListItemButton
        key={node.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(DND_MIME, JSON.stringify(preset));
          event.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onPresetPick(preset)}
        sx={{
          pl: depth * 1.5 + 4,
          "&:hover": { opacity: 1 },
          "&.Mui-focusVisible": { opacity: 1 }
        }}
      >
        <ListItemText
          primary={node.name}
          primaryTypographyProps={{ color: "text.primary", sx: { fontWeight: 500 } }}
          secondary={node.code}
          secondaryTypographyProps={{ color: "text.secondary", sx: { fontSize: 12 } }}
        />
      </ListItemButton>
    );
  };

  return (
    <Box sx={{ width: "100%", height: "100%", overflowY: "auto", overflowX: "hidden", color: "text.primary" }}>
      {showModeControls || showEdgeTypeControls ? (
        <>
          <Box sx={{ p: 1.5, display: "grid", gap: 1 }}>
            {showModeControls ? (
              <>
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
              </>
            ) : null}

            {showEdgeTypeControls ? (
              <>
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
              </>
            ) : null}
          </Box>
          <Divider />
        </>
      ) : null}
      <Box sx={{ p: 1.5, display: "grid", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {t("pid.toolbox.mainEquipment")}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("pid.toolbox.dragHint")}
        </Typography>
        <TextField
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("common.liveFilter.searchPlaceholder")}
        />
        <Box sx={{ display: "grid", gap: 0.25 }}>
          {treeAnnotations.map((node) => renderEquipmentNode(node, 0))}
        </Box>
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
                <ListItemText
                  primary={`${item.code} - ${t(item.labelKey)}`}
                  primaryTypographyProps={{ color: "text.primary" }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </Box>
  );
}

export { DND_MIME };
