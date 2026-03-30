import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { Handle, Position, type NodeProps } from "reactflow";

import { getEquipmentSymbolSpec } from "../../../features/pid/equipmentSymbolRegistry";
import type { PidSymbol } from "../../../types/pid";
import { EquipmentGlyph } from "./EquipmentGlyph";
import { InstrumentGlyph } from "./InstrumentGlyph";

type NodeData = {
  label: string;
  tag: string;
  symbolKey: string;
  shapeKey?: string;
  pidSymbol?: PidSymbol | null;
  category: "main" | "instrument" | "external";
  visual: { width: number; height: number; labelWidth: number };
};

const hiddenHandleStyle = {
  width: 10,
  height: 10,
  borderRadius: 999,
  border: "none",
  background: "transparent",
  opacity: 0,
  pointerEvents: "none" as const,
};

function parseViewBoxSize(viewBox: string) {
  const parts = viewBox.split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return { width: 1, height: 1 };
  }
  return { width: parts[2] || 1, height: parts[3] || 1 };
}

export function PidNodeRenderer({ data, selected }: NodeProps<NodeData>) {
  const [hovered, setHovered] = useState(false);
  const isInstrument = data.category === "instrument";
  const glyphStroke = selected ? "#2563eb" : hovered ? "#1f3b57" : "#32475b";
  const equipmentSpec = !isInstrument ? getEquipmentSymbolSpec(data.shapeKey) : null;
  const viewBoxSize = equipmentSpec ? parseViewBoxSize(equipmentSpec.viewBox) : null;
  const anchorStyles =
    equipmentSpec && viewBoxSize
      ? {
          top: {
            left: (equipmentSpec.geometry.anchors.top.x / viewBoxSize.width) * data.visual.width - hiddenHandleStyle.width / 2,
            top: (equipmentSpec.geometry.anchors.top.y / viewBoxSize.height) * data.visual.height - hiddenHandleStyle.height / 2,
          },
          right: {
            left: (equipmentSpec.geometry.anchors.right.x / viewBoxSize.width) * data.visual.width - hiddenHandleStyle.width / 2,
            top: (equipmentSpec.geometry.anchors.right.y / viewBoxSize.height) * data.visual.height - hiddenHandleStyle.height / 2,
          },
          bottom: {
            left: (equipmentSpec.geometry.anchors.bottom.x / viewBoxSize.width) * data.visual.width - hiddenHandleStyle.width / 2,
            top: (equipmentSpec.geometry.anchors.bottom.y / viewBoxSize.height) * data.visual.height - hiddenHandleStyle.height / 2,
          },
          left: {
            left: (equipmentSpec.geometry.anchors.left.x / viewBoxSize.width) * data.visual.width - hiddenHandleStyle.width / 2,
            top: (equipmentSpec.geometry.anchors.left.y / viewBoxSize.height) * data.visual.height - hiddenHandleStyle.height / 2,
          },
        }
      : null;

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        width: data.visual.labelWidth,
        minHeight: data.visual.height + 34,
        display: "grid",
        justifyItems: "center",
        alignContent: "start",
        gap: 0.5,
        bgcolor: "transparent",
        textAlign: "center",
        color: "text.primary",
        userSelect: "none",
      }}
    >
      <Box
        sx={{
          width: data.visual.width,
          height: data.visual.height,
          position: "relative",
          display: "grid",
          placeItems: "center",
          transition: "transform 140ms ease, filter 140ms ease",
          transform: selected ? "translateY(-1px)" : "none",
          filter: selected ? "drop-shadow(0 8px 14px rgba(37,99,235,0.18))" : hovered ? "drop-shadow(0 6px 12px rgba(15,23,42,0.12))" : "none",
        }}
      >
        <Handle id="top" type="source" position={Position.Top} style={{ ...hiddenHandleStyle, ...(anchorStyles?.top || { top: 0, left: data.visual.width / 2 }) }} />
        <Handle id="top" type="target" position={Position.Top} style={{ ...hiddenHandleStyle, ...(anchorStyles?.top || { top: 0, left: data.visual.width / 2 }) }} />
        <Handle id="right" type="source" position={Position.Right} style={{ ...hiddenHandleStyle, ...(anchorStyles?.right || { left: data.visual.width - hiddenHandleStyle.width / 2, top: data.visual.height / 2 }) }} />
        <Handle id="right" type="target" position={Position.Right} style={{ ...hiddenHandleStyle, ...(anchorStyles?.right || { left: data.visual.width - hiddenHandleStyle.width / 2, top: data.visual.height / 2 }) }} />
        <Handle id="bottom" type="source" position={Position.Bottom} style={{ ...hiddenHandleStyle, ...(anchorStyles?.bottom || { top: data.visual.height - hiddenHandleStyle.height / 2, left: data.visual.width / 2 }) }} />
        <Handle id="bottom" type="target" position={Position.Bottom} style={{ ...hiddenHandleStyle, ...(anchorStyles?.bottom || { top: data.visual.height - hiddenHandleStyle.height / 2, left: data.visual.width / 2 }) }} />
        <Handle id="left" type="source" position={Position.Left} style={{ ...hiddenHandleStyle, ...(anchorStyles?.left || { left: -hiddenHandleStyle.width / 2, top: data.visual.height / 2 }) }} />
        <Handle id="left" type="target" position={Position.Left} style={{ ...hiddenHandleStyle, ...(anchorStyles?.left || { left: -hiddenHandleStyle.width / 2, top: data.visual.height / 2 }) }} />
        {isInstrument ? (
          <InstrumentGlyph
            code={data.tag || data.symbolKey}
            width={data.visual.width}
            height={data.visual.height}
            stroke={glyphStroke}
            selected={selected}
          />
        ) : (
          <EquipmentGlyph
            shapeKey={data.shapeKey}
            symbol={data.pidSymbol || null}
            width={data.visual.width}
            height={data.visual.height}
            stroke={glyphStroke}
            selected={selected}
          />
        )}
      </Box>
      <Typography
        variant="caption"
        sx={{
          maxWidth: data.visual.labelWidth,
          fontWeight: 700,
          display: "block",
          color: "text.primary",
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {data.tag || data.symbolKey}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          maxWidth: data.visual.labelWidth,
          color: "text.secondary",
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {data.label}
      </Typography>
    </Box>
  );
}
