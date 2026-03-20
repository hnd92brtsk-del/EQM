import { Box, Chip, Typography } from "@mui/material";
import { Handle, Position, type NodeProps } from "reactflow";

import type { SerialMapNodeKind, SerialMapProtocol } from "./types";

type SerialMapNodeData = {
  kind: SerialMapNodeKind;
  title: string;
  subtitle: string;
  protocol: SerialMapProtocol;
  address: number | null;
  serialPorts: string;
  hasConflict: boolean;
};

const palette: Record<SerialMapNodeKind, { border: string; header: string }> = {
  equipment: { border: "#1976d2", header: "#1976d2" },
  master: { border: "#1565c0", header: "#1565c0" },
  slave: { border: "#2e7d32", header: "#2e7d32" },
  sensor: { border: "#ef6c00", header: "#ef6c00" },
  bus: { border: "#546e7a", header: "#546e7a" },
  repeater: { border: "#7b1fa2", header: "#7b1fa2" },
  gateway: { border: "#d32f2f", header: "#d32f2f" }
};

const labels: Record<SerialMapNodeKind, string> = {
  equipment: "ОБОРУДОВАНИЕ",
  master: "МАСТЕР / ПЛК",
  slave: "RTU SLAVE",
  sensor: "ДАТЧИК / I/O",
  bus: "СЕГМЕНТ ШИНЫ",
  repeater: "РЕПИТЕР / ХАБ",
  gateway: "ШЛЮЗ"
};

export function SerialMapNodeRenderer({ data, selected }: NodeProps<SerialMapNodeData>) {
  const colors = palette[data.kind];
  const isBus = data.kind === "bus";
  return (
    <Box
      sx={{
        minWidth: isBus ? 260 : 146,
        border: "2px solid",
        borderColor: data.hasConflict ? "error.main" : selected ? "primary.main" : colors.border,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
        boxShadow: selected ? 3 : 1
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Box
        sx={{
          px: 1.25,
          py: isBus ? 0.5 : 0.625,
          bgcolor: data.hasConflict ? "error.main" : colors.header,
          color: "#fff"
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.4 }}>
          {labels[data.kind]}
        </Typography>
      </Box>
      <Box sx={{ p: 1.25, display: "grid", gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {data.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {data.subtitle}
        </Typography>
        {!isBus ? (
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
            <Chip size="small" label={data.protocol} variant="outlined" />
            {data.address !== null ? <Chip size="small" label={`#${data.address}`} color="default" /> : null}
          </Box>
        ) : null}
        {data.serialPorts ? (
          <Typography variant="caption" color="text.secondary">
            {data.serialPorts}
          </Typography>
        ) : null}
      </Box>
      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
