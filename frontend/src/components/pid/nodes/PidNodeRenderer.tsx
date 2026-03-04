import { Box, Typography } from "@mui/material";
import { Handle, Position, type NodeProps } from "reactflow";

type NodeData = {
  label: string;
  tag: string;
  symbolKey: string;
  shapeKey?: string;
  category: "main" | "instrument" | "external";
};

function EquipmentGlyph({ shapeKey }: { shapeKey: string }) {
  const stroke = "#32475b";
  const common = { fill: "none", stroke, strokeWidth: 2 };
  switch (shapeKey) {
    case "bunker":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <path d="M8 8h48l-8 28H16z" {...common} />
        </svg>
      );
    case "feeder":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <rect x="6" y="12" width="52" height="20" rx="2" {...common} />
          <line x1="12" y1="22" x2="52" y2="22" {...common} />
        </svg>
      );
    case "crusher":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <path d="M12 34h40L46 8H18z" {...common} />
          <line x1="20" y1="16" x2="44" y2="22" {...common} />
        </svg>
      );
    case "conveyor":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <rect x="6" y="14" width="52" height="16" rx="3" {...common} />
          <circle cx="14" cy="22" r="5" {...common} />
          <circle cx="50" cy="22" r="5" {...common} />
        </svg>
      );
    case "mill":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <ellipse cx="32" cy="22" rx="24" ry="14" {...common} />
          <line x1="12" y1="22" x2="52" y2="22" {...common} />
          <line x1="32" y1="8" x2="32" y2="36" {...common} />
        </svg>
      );
    case "pump":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <circle cx="24" cy="22" r="12" {...common} />
          <polygon points="20,16 32,22 20,28" {...common} />
        </svg>
      );
    case "tank":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <ellipse cx="32" cy="10" rx="16" ry="6" {...common} />
          <path d="M16 10v20c0 3 7 6 16 6s16-3 16-6V10" {...common} />
        </svg>
      );
    case "valve":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <polygon points="16,22 30,12 30,32" {...common} />
          <polygon points="48,22 34,12 34,32" {...common} />
        </svg>
      );
    case "vfd":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <rect x="18" y="4" width="28" height="36" rx="3" {...common} />
          <rect x="22" y="10" width="20" height="8" rx="1" {...common} />
          <line x1="22" y1="24" x2="42" y2="24" {...common} />
        </svg>
      );
    case "motor":
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <circle cx="32" cy="22" r="14" {...common} />
          <text x="32" y="26" textAnchor="middle" fill={stroke} fontSize="13" fontWeight="700">
            M
          </text>
        </svg>
      );
    default:
      return (
        <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden>
          <rect x="8" y="10" width="48" height="24" rx="3" {...common} />
        </svg>
      );
  }
}

export function PidNodeRenderer({ data, selected }: NodeProps<NodeData>) {
  const shapeKey = data.shapeKey || data.symbolKey || "default";
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
