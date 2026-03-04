import { Box, Typography } from "@mui/material";
import { Handle, Position, type NodeProps } from "reactflow";
import { EquipmentGlyph } from "./EquipmentGlyph";

type NodeData = {
  label: string;
  tag: string;
  symbolKey: string;
  shapeKey?: string;
  category: "main" | "instrument" | "external";
};

export function PidNodeRenderer({ data, selected }: NodeProps<NodeData>) {
  const shapeKey = data.shapeKey || "generic";
  const isInstrument = data.category === "instrument";
  return (
    <Box
      sx={{
        minWidth: 100,
        px: 1,
        py: 0.75,
        border: "1px solid",
        borderColor: selected ? "primary.main" : "#42576c",
        borderRadius: isInstrument ? "999px" : 1.5,
        textAlign: "center",
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Handle type="target" position={Position.Left} />
      {isInstrument ? null : <EquipmentGlyph shapeKey={shapeKey} />}
      <Typography variant="caption" sx={{ fontWeight: 700, display: "block", color: "text.primary" }}>
        {data.tag || data.symbolKey}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.primary", opacity: 0.85 }}>
        {data.label}
      </Typography>
      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
