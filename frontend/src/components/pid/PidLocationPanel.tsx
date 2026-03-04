import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Collapse,
  IconButton,
  InputLabel,
  Popover,
  TextField,
  Typography,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useTranslation } from "react-i18next";

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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const treeIndex = useMemo(() => {
    const parentById = new Map<number, number | null>();
    const pathById = new Map<number, string>();
    const walk = (nodes: TreeNode[], parentId: number | null, prefix: string) => {
      nodes.forEach((node) => {
        const nextPath = prefix ? `${prefix} / ${node.name}` : node.name;
        parentById.set(node.id, parentId);
        pathById.set(node.id, nextPath);
        walk(node.children || [], node.id, nextPath);
      });
    };
    walk(locationTree, null, "");
    return { parentById, pathById };
  }, [locationTree]);

  const selectedLocationLabel = locationId ? treeIndex.pathById.get(locationId) || String(locationId) : "";
  const dropdownOpen = Boolean(anchorEl);

  useEffect(() => {
    if (!dropdownOpen || !locationId) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let parentId = treeIndex.parentById.get(locationId) ?? null;
      while (parentId) {
        next.add(parentId);
        parentId = treeIndex.parentById.get(parentId) ?? null;
      }
      return next;
    });
  }, [dropdownOpen, locationId, treeIndex.parentById]);

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

  const renderNode = (node: TreeNode, depth: number) => {
    const hasChildren = (node.children || []).length > 0;
    const expanded = expandedIds.has(node.id);
    const selected = locationId === node.id;

    return (
      <Box key={node.id}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, pl: depth * 1.5, pr: 0.5 }}>
          {hasChildren ? (
            <IconButton size="small" onClick={() => toggleExpanded(node.id)} sx={{ mt: 0.1 }}>
              {expanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
            </IconButton>
          ) : (
            <Box sx={{ width: 32 }} />
          )}
          <Box
            role="button"
            tabIndex={0}
            onClick={() => {
              onLocationChange(node.id);
              setAnchorEl(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onLocationChange(node.id);
                setAnchorEl(null);
              }
            }}
            sx={{
              flexGrow: 1,
              py: 0.6,
              px: 0.75,
              borderRadius: 1,
              cursor: "pointer",
              backgroundColor: selected ? "action.selected" : "transparent",
              "&:hover": { backgroundColor: "action.hover" },
              color: "text.primary",
              fontSize: 14,
              lineHeight: 1.35,
              whiteSpace: "normal",
              wordBreak: "break-word",
            }}
          >
            {node.name}
          </Box>
        </Box>
        {hasChildren ? (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ display: "grid", gap: 0.25 }}>{(node.children || []).map((child) => renderNode(child, depth + 1))}</Box>
          </Collapse>
        ) : null}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 1.25, p: 1.5, maxHeight: "100%", overflowY: "auto", overflowX: "hidden" }}>
      <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>
        {t("pid.page.location")}
      </Typography>
      <InputLabel sx={{ color: "text.primary" }}>{t("pid.page.location")}</InputLabel>
      <TextField
        size="small"
        value={selectedLocationLabel}
        placeholder={t("pid.page.selectLocation")}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        InputProps={{ readOnly: true }}
      />
      <Popover
        open={dropdownOpen}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            mt: 0.5,
            width: anchorEl ? anchorEl.clientWidth : 340,
            maxWidth: "min(480px, calc(100vw - 24px))",
            maxHeight: 360,
            overflow: "auto",
            p: 0.5,
          },
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          onClick={() => {
            onLocationChange("");
            setAnchorEl(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onLocationChange("");
              setAnchorEl(null);
            }
          }}
          sx={{
            p: 0.9,
            borderRadius: 1,
            cursor: "pointer",
            color: "text.secondary",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          {t("pid.page.selectLocation")}
        </Box>
        <Box sx={{ display: "grid", gap: 0.25, pb: 0.5 }}>{locationTree.map((node) => renderNode(node, 0))}</Box>
      </Popover>

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
