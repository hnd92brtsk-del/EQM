import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { Handle, Position, type NodeProps } from "reactflow";

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

export function PidNodeRenderer({ data, selected }: NodeProps<NodeData>) {
  const [hovered, setHovered] = useState(false);
  const isInstrument = data.category === "instrument";
  const glyphStroke = selected ? "#2563eb" : hovered ? "#1f3b57" : "#32475b";

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
        <Handle id="top" type="source" position={Position.Top} style={{ ...hiddenHandleStyle, top: 0 }} />
        <Handle id="top" type="target" position={Position.Top} style={{ ...hiddenHandleStyle, top: 0 }} />
        <Handle id="right" type="source" position={Position.Right} style={{ ...hiddenHandleStyle, right: 0, top: data.visual.height / 2 }} />
        <Handle id="right" type="target" position={Position.Right} style={{ ...hiddenHandleStyle, right: 0, top: data.visual.height / 2 }} />
        <Handle id="bottom" type="source" position={Position.Bottom} style={{ ...hiddenHandleStyle, bottom: 0 }} />
        <Handle id="bottom" type="target" position={Position.Bottom} style={{ ...hiddenHandleStyle, bottom: 0 }} />
        <Handle id="left" type="source" position={Position.Left} style={{ ...hiddenHandleStyle, left: 0, top: data.visual.height / 2 }} />
        <Handle id="left" type="target" position={Position.Left} style={{ ...hiddenHandleStyle, left: 0, top: data.visual.height / 2 }} />
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
