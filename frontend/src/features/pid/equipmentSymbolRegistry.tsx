import type { ReactNode } from "react";

export type EquipmentSymbolAnchor = {
  x: number;
  y: number;
};

export type EquipmentSymbolGeometry = {
  bodyBox: { x: number; y: number; width: number; height: number };
  inlet: EquipmentSymbolAnchor;
  outlet: EquipmentSymbolAnchor;
  anchors: Record<"top" | "right" | "bottom" | "left", EquipmentSymbolAnchor>;
};

export type EquipmentSymbolVisual = {
  width: number;
  height: number;
  labelWidth: number;
};

export type EquipmentSymbolRenderProps = {
  width: number;
  height: number;
  stroke: string;
  selected: boolean;
};

export type EquipmentLibrarySymbolSpec = {
  key: string;
  standard: "ISO-14617";
  isoSourceNote: string;
  viewBox: string;
  visual: EquipmentSymbolVisual;
  geometry: EquipmentSymbolGeometry;
  render: (props: EquipmentSymbolRenderProps) => ReactNode;
};

const createStroke = (stroke: string, selected: boolean) => ({
  fill: "none",
  stroke,
  strokeWidth: selected ? 2.6 : 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const registry: Record<string, EquipmentLibrarySymbolSpec> = {
  hopper_bin: {
    key: "hopper_bin",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned hopper/bin symbol adapted for bulk material bins.",
    viewBox: "0 0 92 72",
    visual: { width: 96, height: 76, labelWidth: 160 },
    geometry: {
      bodyBox: { x: 18, y: 10, width: 56, height: 50 },
      inlet: { x: 18, y: 20 },
      outlet: { x: 74, y: 44 },
      anchors: {
        top: { x: 46, y: 10 },
        right: { x: 74, y: 34 },
        bottom: { x: 46, y: 60 },
        left: { x: 18, y: 34 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 92 72" aria-hidden>
          <path d="M16 10h60L66 60H26z" {...common} />
        </svg>
      );
    },
  },
  weigh_hopper: {
    key: "weigh_hopper",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned weighing hopper / batch feeder symbol.",
    viewBox: "0 0 120 64",
    visual: { width: 116, height: 58, labelWidth: 178 },
    geometry: {
      bodyBox: { x: 18, y: 16, width: 84, height: 28 },
      inlet: { x: 18, y: 30 },
      outlet: { x: 102, y: 30 },
      anchors: {
        top: { x: 60, y: 16 },
        right: { x: 102, y: 30 },
        bottom: { x: 60, y: 44 },
        left: { x: 18, y: 30 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 120 64" aria-hidden>
          <rect x="18" y="16" width="84" height="28" rx="2" {...common} />
          <path d="M34 30h52" {...common} />
          <path d="M60 24v12" {...common} />
        </svg>
      );
    },
  },
  thickener: {
    key: "thickener",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned thickener / settling tank symbol.",
    viewBox: "0 0 112 72",
    visual: { width: 110, height: 68, labelWidth: 176 },
    geometry: {
      bodyBox: { x: 16, y: 18, width: 80, height: 32 },
      inlet: { x: 16, y: 34 },
      outlet: { x: 96, y: 34 },
      anchors: {
        top: { x: 56, y: 18 },
        right: { x: 96, y: 34 },
        bottom: { x: 56, y: 50 },
        left: { x: 16, y: 34 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 112 72" aria-hidden>
          <rect x="16" y="18" width="80" height="32" rx="2" {...common} />
          <path d="M56 10v40" {...common} />
          <path d="M40 28h32" {...common} />
        </svg>
      );
    },
  },
  crusher_jaw: {
    key: "crusher_jaw",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned solids reduction vessel, adapted for jaw crusher silhouette.",
    viewBox: "0 0 92 68",
    visual: { width: 104, height: 78, labelWidth: 166 },
    geometry: {
      bodyBox: { x: 18, y: 10, width: 56, height: 48 },
      inlet: { x: 18, y: 22 },
      outlet: { x: 74, y: 42 },
      anchors: {
        top: { x: 46, y: 10 },
        right: { x: 74, y: 34 },
        bottom: { x: 46, y: 58 },
        left: { x: 18, y: 34 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 92 68" aria-hidden>
          <path d="M18 10h56l10 48H8z" {...common} />
          <path d="M28 22l28 8" {...common} />
          <path d="M24 30l34 10" {...common} />
          <path d="M20 40l38 11" {...common} />
        </svg>
      );
    },
  },
  crusher_cone: {
    key: "crusher_cone",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned conical reduction unit, adapted for cone crusher.",
    viewBox: "0 0 92 68",
    visual: { width: 100, height: 76, labelWidth: 164 },
    geometry: {
      bodyBox: { x: 24, y: 8, width: 44, height: 52 },
      inlet: { x: 28, y: 18 },
      outlet: { x: 64, y: 50 },
      anchors: {
        top: { x: 46, y: 8 },
        right: { x: 68, y: 34 },
        bottom: { x: 46, y: 60 },
        left: { x: 24, y: 34 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 92 68" aria-hidden>
          <path d="M28 8h36l8 52H20z" {...common} />
          <path d="M31 23l28 8" {...common} />
          <path d="M28 34l31 9" {...common} />
        </svg>
      );
    },
  },
  screen_vibratory: {
    key: "screen_vibratory",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned screening unit with vibrating deck interior marks.",
    viewBox: "0 0 112 64",
    visual: { width: 118, height: 68, labelWidth: 174 },
    geometry: {
      bodyBox: { x: 14, y: 18, width: 84, height: 28 },
      inlet: { x: 14, y: 30 },
      outlet: { x: 98, y: 34 },
      anchors: {
        top: { x: 56, y: 18 },
        right: { x: 98, y: 32 },
        bottom: { x: 56, y: 46 },
        left: { x: 14, y: 32 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 112 64" aria-hidden>
          <rect x="14" y="18" width="84" height="28" rx="2" {...common} />
          <path d="M24 24l22 8" {...common} />
          <path d="M40 24l22 8" {...common} />
          <path d="M56 24l22 8" {...common} />
          <path d="M28 32l22 8" {...common} />
          <path d="M44 32l22 8" {...common} />
          <path d="M60 32l22 8" {...common} />
        </svg>
      );
    },
  },
  conveyor_belt: {
    key: "conveyor_belt",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned conveyor/transport element with roller endpoints.",
    viewBox: "0 0 160 56",
    visual: { width: 154, height: 50, labelWidth: 182 },
    geometry: {
      bodyBox: { x: 20, y: 18, width: 120, height: 20 },
      inlet: { x: 20, y: 28 },
      outlet: { x: 140, y: 28 },
      anchors: {
        top: { x: 80, y: 18 },
        right: { x: 140, y: 28 },
        bottom: { x: 80, y: 38 },
        left: { x: 20, y: 28 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 160 56" aria-hidden>
          <rect x="20" y="18" width="120" height="20" rx="2" {...common} />
          <circle cx="32" cy="28" r="8" {...common} />
          <circle cx="128" cy="28" r="8" {...common} />
        </svg>
      );
    },
  },
  mill_tumbling: {
    key: "mill_tumbling",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned rotating grinding unit with mill cross members.",
    viewBox: "0 0 92 68",
    visual: { width: 100, height: 74, labelWidth: 166 },
    geometry: {
      bodyBox: { x: 16, y: 14, width: 60, height: 40 },
      inlet: { x: 16, y: 34 },
      outlet: { x: 76, y: 34 },
      anchors: {
        top: { x: 46, y: 14 },
        right: { x: 76, y: 34 },
        bottom: { x: 46, y: 54 },
        left: { x: 16, y: 34 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 92 68" aria-hidden>
          <ellipse cx="46" cy="34" rx="30" ry="20" {...common} />
          <path d="M16 34h60" {...common} />
          <path d="M46 14v40" {...common} />
        </svg>
      );
    },
  },
  pump_centrifugal: {
    key: "pump_centrifugal",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned pump symbol, adapted to centrifugal pump notation.",
    viewBox: "0 0 84 68",
    visual: { width: 76, height: 72, labelWidth: 136 },
    geometry: {
      bodyBox: { x: 12, y: 12, width: 46, height: 44 },
      inlet: { x: 12, y: 34 },
      outlet: { x: 72, y: 34 },
      anchors: {
        top: { x: 35, y: 12 },
        right: { x: 72, y: 34 },
        bottom: { x: 35, y: 56 },
        left: { x: 12, y: 34 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 84 68" aria-hidden>
          <circle cx="34" cy="34" r="22" {...common} />
          <path d="M28 22l18 12-18 12z" {...common} />
          <path d="M56 34h16" {...common} />
        </svg>
      );
    },
  },
  tank_vertical: {
    key: "tank_vertical",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned storage vessel symbol with vertical cylindrical body.",
    viewBox: "0 0 88 92",
    visual: { width: 82, height: 92, labelWidth: 150 },
    geometry: {
      bodyBox: { x: 22, y: 10, width: 44, height: 68 },
      inlet: { x: 22, y: 24 },
      outlet: { x: 66, y: 62 },
      anchors: {
        top: { x: 44, y: 10 },
        right: { x: 66, y: 44 },
        bottom: { x: 44, y: 78 },
        left: { x: 22, y: 44 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 88 92" aria-hidden>
          <ellipse cx="44" cy="14" rx="22" ry="8" {...common} />
          <path d="M22 14v56c0 6 10 10 22 10s22-4 22-10V14" {...common} />
          <path d="M22 70c0 6 10 10 22 10s22-4 22-10" {...common} />
        </svg>
      );
    },
  },
  valve_gate: {
    key: "valve_gate",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned isolation valve symbol.",
    viewBox: "0 0 72 52",
    visual: { width: 58, height: 46, labelWidth: 122 },
    geometry: {
      bodyBox: { x: 16, y: 12, width: 40, height: 28 },
      inlet: { x: 16, y: 26 },
      outlet: { x: 56, y: 26 },
      anchors: {
        top: { x: 36, y: 12 },
        right: { x: 56, y: 26 },
        bottom: { x: 36, y: 40 },
        left: { x: 16, y: 26 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 72 52" aria-hidden>
          <path d="M16 26l14-14v28z" {...common} />
          <path d="M56 26L42 12v28z" {...common} />
          <path d="M36 12v-8" {...common} />
          <path d="M30 4h12" {...common} />
        </svg>
      );
    },
  },
  motor: {
    key: "motor",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned motor/drive symbol.",
    viewBox: "0 0 76 68",
    visual: { width: 74, height: 70, labelWidth: 136 },
    geometry: {
      bodyBox: { x: 12, y: 12, width: 40, height: 40 },
      inlet: { x: 12, y: 32 },
      outlet: { x: 64, y: 32 },
      anchors: {
        top: { x: 32, y: 12 },
        right: { x: 64, y: 32 },
        bottom: { x: 32, y: 52 },
        left: { x: 12, y: 32 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 76 68" aria-hidden>
          <circle cx="32" cy="32" r="20" {...common} />
          <path d="M52 32h12" {...common} />
          <text x="32" y="37" textAnchor="middle" fill={stroke} fontSize="18" fontWeight="700">
            M
          </text>
        </svg>
      );
    },
  },
  feeder: {
    key: "feeder",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned feeder/controlled solids feed element.",
    viewBox: "0 0 120 64",
    visual: { width: 116, height: 54, labelWidth: 174 },
    geometry: {
      bodyBox: { x: 14, y: 18, width: 92, height: 26 },
      inlet: { x: 14, y: 31 },
      outlet: { x: 106, y: 31 },
      anchors: {
        top: { x: 60, y: 18 },
        right: { x: 106, y: 31 },
        bottom: { x: 60, y: 44 },
        left: { x: 14, y: 31 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 120 64" aria-hidden>
          <rect x="14" y="18" width="92" height="26" rx="2" {...common} />
          <path d="M32 18v26" {...common} />
          <path d="M60 18v26" {...common} />
          <path d="M88 18v26" {...common} />
        </svg>
      );
    },
  },
  cyclone: {
    key: "cyclone",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned cyclone separator symbol.",
    viewBox: "0 0 88 96",
    visual: { width: 84, height: 94, labelWidth: 152 },
    geometry: {
      bodyBox: { x: 18, y: 10, width: 42, height: 70 },
      inlet: { x: 18, y: 18 },
      outlet: { x: 60, y: 80 },
      anchors: {
        top: { x: 39, y: 10 },
        right: { x: 60, y: 44 },
        bottom: { x: 39, y: 80 },
        left: { x: 18, y: 44 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 88 96" aria-hidden>
          <path d="M18 10h42l-10 28v24L36 80V38z" {...common} />
          <path d="M60 10h12" {...common} />
          <path d="M36 80v8" {...common} />
        </svg>
      );
    },
  },
  mixer: {
    key: "mixer",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned agitated vessel / mixing unit symbol.",
    viewBox: "0 0 92 76",
    visual: { width: 88, height: 76, labelWidth: 156 },
    geometry: {
      bodyBox: { x: 22, y: 16, width: 48, height: 42 },
      inlet: { x: 22, y: 30 },
      outlet: { x: 70, y: 44 },
      anchors: {
        top: { x: 46, y: 16 },
        right: { x: 70, y: 37 },
        bottom: { x: 46, y: 58 },
        left: { x: 22, y: 37 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 92 76" aria-hidden>
          <rect x="22" y="16" width="48" height="42" rx="3" {...common} />
          <path d="M46 8v50" {...common} />
          <path d="M34 32l12 8-12 8" {...common} />
          <path d="M58 28l-12 8 12 8" {...common} />
        </svg>
      );
    },
  },
  generic: {
    key: "generic",
    standard: "ISO-14617",
    isoSourceNote: "ISO 14617 aligned generic equipment enclosure used as a safe fallback.",
    viewBox: "0 0 92 64",
    visual: { width: 96, height: 60, labelWidth: 150 },
    geometry: {
      bodyBox: { x: 16, y: 16, width: 60, height: 32 },
      inlet: { x: 16, y: 32 },
      outlet: { x: 76, y: 32 },
      anchors: {
        top: { x: 46, y: 16 },
        right: { x: 76, y: 32 },
        bottom: { x: 46, y: 48 },
        left: { x: 16, y: 32 },
      },
    },
    render: ({ width, height, stroke, selected }) => {
      const common = createStroke(stroke, selected);
      return (
        <svg width={width} height={height} viewBox="0 0 92 64" aria-hidden>
          <rect x="16" y="16" width="60" height="32" rx="3" {...common} />
          <path d="M26 32h40" {...common} />
        </svg>
      );
    },
  },
};

export const EQUIPMENT_SYMBOL_REGISTRY = registry;

export function getEquipmentSymbolSpec(shapeKey?: string): EquipmentLibrarySymbolSpec {
  return registry[shapeKey || "generic"] || registry.generic;
}
