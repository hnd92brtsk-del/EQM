import type { ReactNode } from "react";
import {
  getMainEquipmentObjectSymbolByKey,
  type MainEquipmentObjectSymbolEntry,
  type MainEquipmentObjectSymbolKind,
} from "./mainEquipmentObjectSymbols";

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

const DEFAULT_VIEWBOX = "0 0 120 80";
const DEFAULT_VISUAL: EquipmentSymbolVisual = { width: 118, height: 76, labelWidth: 190 };
const objectSpecCache = new Map<string, EquipmentLibrarySymbolSpec>();

function kindBadge(kind: MainEquipmentObjectSymbolKind) {
  return kind
    .split("_")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 3);
}

function makeGeometry(
  bodyBox: EquipmentSymbolGeometry["bodyBox"],
  inlet: EquipmentSymbolAnchor,
  outlet: EquipmentSymbolAnchor,
  anchors?: Partial<Record<"top" | "right" | "bottom" | "left", EquipmentSymbolAnchor>>
): EquipmentSymbolGeometry {
  return {
    bodyBox,
    inlet,
    outlet,
    anchors: {
      top: anchors?.top || { x: bodyBox.x + bodyBox.width / 2, y: bodyBox.y },
      right: anchors?.right || { x: bodyBox.x + bodyBox.width, y: bodyBox.y + bodyBox.height / 2 },
      bottom: anchors?.bottom || { x: bodyBox.x + bodyBox.width / 2, y: bodyBox.y + bodyBox.height },
      left: anchors?.left || { x: bodyBox.x, y: bodyBox.y + bodyBox.height / 2 },
    },
  };
}

function makeSpec(args: {
  key: string;
  note: string;
  viewBox: string;
  visual: EquipmentSymbolVisual;
  geometry: EquipmentSymbolGeometry;
  render: EquipmentLibrarySymbolSpec["render"];
}): EquipmentLibrarySymbolSpec {
  return {
    key: args.key,
    standard: "ISO-14617",
    isoSourceNote: args.note,
    viewBox: args.viewBox,
    visual: args.visual,
    geometry: args.geometry,
    render: args.render,
  };
}

function renderObjectSvg(
  props: EquipmentSymbolRenderProps,
  viewBox: string,
  body: ReactNode,
  code: string,
  badge: string
) {
  return (
    <svg width={props.width} height={props.height} viewBox={viewBox} aria-hidden>
      {body}
      <text x="12" y="18" fill={props.stroke} fontSize="11" fontWeight="700">{badge}</text>
      <text x="106" y="74" textAnchor="end" fill={props.stroke} fontSize="9" fontWeight="700" opacity="0.82">
        {code}
      </text>
    </svg>
  );
}

function buildObjectSpec(entry: MainEquipmentObjectSymbolEntry): EquipmentLibrarySymbolSpec {
  const kind = entry.kind;
  const badge = kindBadge(kind);
  const note = `Object-level flowsheet symbol for ${entry.kind} (${entry.code}).`;
  const finalize = (
    geometry: EquipmentSymbolGeometry,
    bodyFactory: (props: EquipmentSymbolRenderProps) => ReactNode,
    visual: EquipmentSymbolVisual = DEFAULT_VISUAL,
    viewBox = DEFAULT_VIEWBOX
  ) =>
    makeSpec({
      key: entry.libraryKey,
      note,
      viewBox,
      visual,
      geometry,
      render: (props) => renderObjectSvg(props, viewBox, bodyFactory(props), entry.code, badge),
    });

  if (kind.startsWith("crusher_") || kind === "hpgr") {
    return finalize(
      makeGeometry({ x: 18, y: 12, width: 72, height: 44 }, { x: 18, y: 26 }, { x: 90, y: 46 }),
      ({ stroke, selected }) => {
        const s = createStroke(stroke, selected);
        if (kind === "hpgr" || kind === "crusher_roll") {
          return (
            <>
              <rect x="22" y="20" width="64" height="24" rx="2" {...s} />
              <circle cx="42" cy="32" r="9" {...s} />
              <circle cx="66" cy="32" r="9" {...s} />
              {kind === "hpgr" ? <path d="M54 20v24" {...s} /> : null}
            </>
          );
        }
        if (kind === "crusher_hammer") {
          return (
            <>
              <rect x="18" y="20" width="72" height="24" rx="2" {...s} />
              <circle cx="38" cy="32" r="8" {...s} />
              <path d="M46 26l14-6M46 38l14 6M60 24l12 16" {...s} />
            </>
          );
        }
        return (
          <>
            <path d="M24 12h48l10 44H14z" {...s} />
            <path d="M30 26l24 8M26 36l28 9M22 46l32 10" {...s} />
          </>
        );
      }
    );
  }

  if (kind.startsWith("screen_")) {
    return finalize(
      makeGeometry({ x: 16, y: 18, width: 88, height: 26 }, { x: 16, y: 30 }, { x: 104, y: 34 }),
      ({ stroke, selected }) => {
        const s = createStroke(stroke, selected);
        if (kind === "screen_trommel") {
          return (
            <>
              <ellipse cx="38" cy="32" rx="16" ry="10" {...s} />
              <path d="M38 22h36v20H38M74 24v16" {...s} />
            </>
          );
        }
        if (kind === "screen_arc") {
          return <path d="M18 48c10-18 28-28 56-28h20M28 44c8-10 20-16 36-16M30 38l10 8M44 30l10 8M58 24l10 8" {...s} />;
        }
        return (
          <>
            <path d="M18 22h72l12 18-12 10H18z" {...s} />
            <path d="M26 28l20 8M42 28l20 8M58 28l20 8" {...s} />
            {kind === "screen_resonance" ? <path d="M20 52l8-8 8 8M92 52l8-8 8 8" {...s} /> : null}
            {kind === "screen_fine" ? <path d="M26 36h54M26 40h54" {...s} /> : null}
          </>
        );
      }
    );
  }

  if (kind.startsWith("mill_")) {
    return finalize(
      makeGeometry({ x: 18, y: 18, width: 72, height: 36 }, { x: 18, y: 36 }, { x: 90, y: 36 }),
      ({ stroke, selected }) => {
        const s = createStroke(stroke, selected);
        if (kind === "mill_vertical") {
          return (
            <>
              <rect x="42" y="10" width="28" height="50" rx="6" {...s} />
              <path d="M56 6v54M48 24l8 8-8 8M64 38l-8 8 8 8" {...s} />
            </>
          );
        }
        return (
          <>
            <ellipse cx="54" cy="36" rx="36" ry="18" {...s} />
            <path d="M18 36h72M54 18v36" {...s} />
            {kind === "mill_rod" ? <path d="M32 28l42 18M32 36l42 10" {...s} /> : null}
            {kind === "mill_ball" ? <path d="M40 30h1M52 42h1M64 30h1" {...s} /> : null}
            {kind === "mill_ag" ? <path d="M40 28l10 8-12 6zM62 32l8 7-10 6z" {...s} /> : null}
            {kind === "mill_sag" ? <path d="M42 30h1M60 34h1M48 42l8-8 8 8" {...s} /> : null}
            {kind === "mill_vibratory" ? <path d="M20 60l10-8M92 60l10-8" {...s} /> : null}
          </>
        );
      },
      kind === "mill_vertical" ? { width: 94, height: 90, labelWidth: 184 } : DEFAULT_VISUAL,
      kind === "mill_vertical" ? "0 0 120 90" : DEFAULT_VIEWBOX
    );
  }

  if (kind.startsWith("classifier_") || kind === "cyclone_thickening") {
    return finalize(
      makeGeometry({ x: 18, y: 18, width: 84, height: 34 }, { x: 18, y: 34 }, { x: 102, y: 34 }),
      ({ stroke, selected }) => {
        const s = createStroke(stroke, selected);
        if (kind === "classifier_spiral") {
          return (
            <>
              <rect x="18" y="24" width="72" height="20" rx="2" {...s} />
              <path d="M24 40c8-10 16-14 24-14s16 4 24 14 12 12 18 12" {...s} />
              <path d="M90 20v28" {...s} />
            </>
          );
        }
        if (kind === "classifier_hydrocyclone_cluster") {
          return <path d="M28 18h16l-6 16v12l-6 10V34zM52 18h16l-6 16v12l-6 10V34zM76 18h16l-6 16v12l-6 10V34z" {...s} />;
        }
        if (kind === "classifier_air") {
          return (
            <>
              <rect x="18" y="18" width="54" height="32" rx="2" {...s} />
              <circle cx="90" cy="34" r="12" {...s} />
              <path d="M84 26l10 8-10 8zM72 34h6" {...s} />
            </>
          );
        }
        return <path d="M38 14h34l-8 20v14l-9 12V34zM72 20h16M55 60v8" {...s} />;
      }
    );
  }

  if (
    kind.startsWith("flotation_") ||
    kind.startsWith("tank_") ||
    kind.startsWith("thickener_") ||
    kind === "clarifier_lamella" ||
    kind === "station_ph_regulator" ||
    kind === "station_flocculant"
  ) {
    return finalize(
      makeGeometry({ x: 20, y: 16, width: 80, height: 38 }, { x: 20, y: 32 }, { x: 100, y: 40 }),
      ({ stroke, selected }) => {
        const s = createStroke(stroke, selected);
        if (kind.startsWith("thickener_")) {
          return (
            <>
              <ellipse cx="58" cy="36" rx="34" ry="17" {...s} />
              <path d="M24 36h68M58 19v34" {...s} />
              {kind === "thickener_paste" ? <path d="M34 46h48" {...s} /> : null}
            </>
          );
        }
        if (kind === "clarifier_lamella") {
          return (
            <>
              <rect x="18" y="20" width="84" height="28" rx="2" {...s} />
              <path d="M28 44l14-16M44 44l14-16M60 44l14-16M76 44l14-16" {...s} />
            </>
          );
        }
        if (kind === "station_ph_regulator" || kind === "station_flocculant") {
          return (
            <>
              <rect x="18" y="20" width="84" height="28" rx="4" {...s} />
              <path d="M34 34h10M39 29v10M56 34h10" {...s} />
              {kind === "station_flocculant" ? <path d="M76 28c4 4 6 7 6 10a6 6 0 1 1-12 0c0-3 2-6 6-10z" {...s} /> : <path d="M74 28c4 0 6 2 6 5s-3 6-7 7" {...s} />}
            </>
          );
        }
        if (kind === "flotation_pneumatic_column" || kind === "flotation_column") {
          return (
            <>
              <rect x="44" y="10" width="28" height="52" rx="12" {...s} />
              <path d="M58 14v44M50 48h16M50 40h16" {...s} />
            </>
          );
        }
        return (
          <>
            <rect x="26" y="20" width="56" height="30" rx="4" {...s} />
            <path d="M54 12v38" {...s} />
            {kind.startsWith("flotation_") || kind === "tank_conditioner" ? <path d="M42 32l12 8-12 8M66 28l-12 8 12 8" {...s} /> : <path d="M34 36h40" {...s} />}
            {kind === "tank_bioleach" ? <path d="M40 28h1M52 40h1M62 30h1" {...s} /> : null}
          </>
        );
      }
    );
  }

  if (
    kind.startsWith("filter_") ||
    kind.startsWith("dryer_") ||
    kind.startsWith("pump_") ||
    kind.startsWith("reactor_") ||
    kind.startsWith("column_") ||
    kind.startsWith("station_") ||
    kind === "centrifuge_sedimentation" ||
    kind === "kiln_rotary" ||
    kind === "furnace_fluidized_bed" ||
    kind === "washer_ccd" ||
    kind === "mixer_settler" ||
    kind === "extractor_centrifugal" ||
    kind === "cell_electrowinning" ||
    kind === "rectifier" ||
    kind === "system_cathode_wash" ||
    kind === "airlift" ||
    kind === "fan_exhauster" ||
    kind === "motor_electric"
  ) {
    return finalize(
      makeGeometry({ x: 18, y: 18, width: 86, height: 34 }, { x: 18, y: 34 }, { x: 104, y: 34 }),
      ({ stroke, selected }) => {
        const s = createStroke(stroke, selected);
        if (kind === "motor_electric") {
          return (
            <>
              <circle cx="54" cy="34" r="18" {...s} />
              <path d="M72 34h16" {...s} />
              <text x="54" y="39" textAnchor="middle" fill={stroke} fontSize="16" fontWeight="700">M</text>
            </>
          );
        }
        if (kind === "fan_exhauster") {
          return (
            <>
              <circle cx="46" cy="34" r="18" {...s} />
              <path d="M46 18c6 4 10 9 10 14s-4 10-10 14M28 32h18M64 34h18" {...s} />
            </>
          );
        }
        if (kind === "airlift") {
          return <path d="M56 14v40M56 54l12-8M56 54l-12-8M48 24h1M56 32h1M50 40h1" {...s} />;
        }
        if (kind.startsWith("pump_")) {
          return (
            <>
              <circle cx="44" cy="34" r="16" {...s} />
              <path d="M38 26l12 8-12 8zM60 34h22" {...s} />
              {kind === "pump_vertical_sump" ? <path d="M44 50v14M36 64h16" {...s} /> : null}
              {kind === "pump_diaphragm" ? <path d="M24 34h40M44 18v32" {...s} /> : null}
              {kind === "pump_multistage" ? <path d="M24 28h40M24 40h40" {...s} /> : null}
              {kind === "pump_vacuum" ? <text x="44" y="39" textAnchor="middle" fill={stroke} fontSize="12" fontWeight="700">V</text> : null}
            </>
          );
        }
        if (kind.startsWith("filter_") || kind === "centrifuge_sedimentation") {
          return (
            <>
              {kind === "filter_drum_vacuum" ? <circle cx="44" cy="34" r="16" {...s} /> : null}
              {kind === "filter_disc_vacuum" ? <path d="M18 34h84M40 34a12 12 0 1 0 0.1 0M66 34a12 12 0 1 0 0.1 0" {...s} /> : null}
              {kind === "filter_belt_vacuum" ? <rect x="18" y="26" width="84" height="16" rx="2" {...s} /> : null}
              {kind === "filter_press_chamber" ? <path d="M22 22h76v24H22zM32 22v24M46 22v24M60 22v24M74 22v24M88 22v24" {...s} /> : null}
              {kind === "filter_press_tower" ? <path d="M46 12h28v50H46zM50 22h20M50 32h20M50 42h20M50 52h20" {...s} /> : null}
              {kind === "centrifuge_sedimentation" ? <path d="M54 34m-18 0a18 18 0 1 0 36 0a18 18 0 1 0 -36 0M48 24c8 2 12 6 12 10s-4 8-12 10" {...s} /> : null}
            </>
          );
        }
        if (kind.startsWith("dryer_") || kind === "kiln_rotary" || kind === "furnace_fluidized_bed") {
          return (
            <>
              {kind === "dryer_flash" ? <path d="M40 14h22v14l16 10-16 10v14H40V48L24 38l16-10z" {...s} /> : null}
              {kind === "dryer_spray" ? <path d="M44 12h26l8 18-12 28H48L36 30zM57 14v12M50 28h1M57 34h1M64 40h1" {...s} /> : null}
              {kind === "furnace_fluidized_bed" ? <path d="M38 16h36v38H38zM44 42h24M42 48h28" {...s} /> : null}
              {(kind === "dryer_rotary" || kind === "kiln_rotary") ? <path d="M22 44l16-20h44l16 20-16 12H38z" {...s} /> : null}
            </>
          );
        }
        if (kind === "autoclave_pox" || kind === "column_pulsation" || kind === "column_ion_exchange") {
          return (
            <>
              {kind === "autoclave_pox" ? <rect x="20" y="24" width="80" height="20" rx="10" {...s} /> : <rect x="46" y="12" width="28" height="48" rx="10" {...s} />}
              {kind === "column_pulsation" ? <path d="M80 26l8-6M80 42l8 6" {...s} /> : null}
              {kind === "column_ion_exchange" ? <path d="M54 24h12M54 34h12M54 44h12" {...s} /> : null}
            </>
          );
        }
        if (kind === "reactor_leach_tank" || kind === "reactor_biox" || kind === "mixer_settler") {
          return (
            <>
              {kind === "mixer_settler" ? <path d="M20 24h34v20H20zM66 24h34v20H66zM54 34h12" {...s} /> : <rect x="28" y="20" width="50" height="30" rx="4" {...s} />}
              <path d="M54 12v38" {...s} />
            </>
          );
        }
        if (kind === "cell_electrowinning" || kind === "rectifier" || kind === "system_cathode_wash") {
          return (
            <>
              {kind === "cell_electrowinning" ? <path d="M24 24h64v22H24zM36 22v26M48 22v26M60 22v26M72 22v26" {...s} /> : null}
              {kind === "rectifier" ? <path d="M28 20h56v28H28zM38 34h10M58 28l10 6-10 6" {...s} /> : null}
              {kind === "system_cathode_wash" ? <path d="M20 28h82v12H20zM34 20v8M48 20v8M62 20v8M76 20v8" {...s} /> : null}
            </>
          );
        }
        return (
          <>
            <rect x="20" y="20" width="82" height="28" rx="4" {...s} />
            <path d="M36 34h50" {...s} />
          </>
        );
      }
    );
  }

  if (
    kind.startsWith("valve_") ||
    kind.startsWith("actuator_") ||
    kind.startsWith("feeder_") ||
    kind.startsWith("conveyor_") ||
    kind === "elevator_bucket" ||
    kind === "conveying_pneumatic" ||
    kind === "pipeline_recirculation" ||
    kind === "mixer_static" ||
    kind === "heap_leach_pad" ||
    kind === "pond_settling" ||
    kind === "scale_truck_rail" ||
    kind === "sampler_auto"
  ) {
    return finalize(
      makeGeometry({ x: 16, y: 20, width: 88, height: 24 }, { x: 16, y: 32 }, { x: 104, y: 32 }),
      ({ stroke, selected }) => {
        const s = createStroke(stroke, selected);
        if (kind.startsWith("valve_")) {
          return (
            <>
              <path d="M16 32h18M86 32h18" {...s} />
              <path d="M34 32l18-14v28zM86 32L68 18v28z" {...s} />
              {kind === "valve_ball" ? <circle cx="60" cy="32" r="8" {...s} /> : null}
              {kind === "valve_butterfly" ? <path d="M60 20v24" {...s} /> : null}
              {kind === "valve_check" ? <path d="M72 20v24" {...s} /> : null}
              {kind === "valve_relief" || kind === "valve_control" ? <path d="M60 18v-10M52 8h16" {...s} /> : null}
            </>
          );
        }
        if (kind.startsWith("actuator_")) {
          return (
            <>
              <rect x="38" y="20" width="44" height="24" rx="2" {...s} />
              {kind === "actuator_manual" ? <path d="M60 20V8M50 8h20" {...s} /> : null}
              {kind === "actuator_electric" ? <text x="60" y="37" textAnchor="middle" fill={stroke} fontSize="14" fontWeight="700">E</text> : null}
              {kind === "actuator_pneumatic" ? <path d="M48 32h24M60 24l8 8-8 8" {...s} /> : null}
              {kind === "actuator_hydraulic" ? <path d="M46 28h28M52 36h16" {...s} /> : null}
              {kind === "actuator_solenoid" ? <path d="M46 28c4-4 8-4 12 0s8 4 12 0" {...s} /> : null}
            </>
          );
        }
        if (kind === "heap_leach_pad" || kind === "pond_settling") {
          return <path d="M16 48h88L76 22H44zM30 40c10-4 18-4 28 0s18 4 28 0" {...s} />;
        }
        if (kind === "scale_truck_rail") {
          return <path d="M18 28h84v10H18zM28 42h64M32 44v6M46 44v6M60 44v6M74 44v6" {...s} />;
        }
        if (kind === "sampler_auto") {
          return <path d="M38 20h34v24H38zM38 32H24M72 32h14M55 20v24" {...s} />;
        }
        if (kind === "mixer_static") {
          return <path d="M18 24h84v16H18zM30 26l10 12M44 26l10 12M58 26l10 12M72 26l10 12" {...s} />;
        }
        if (kind === "pipeline_recirculation" || kind === "conveying_pneumatic") {
          return <path d="M18 32h82M82 32c10 0 16 6 16 12s-6 12-16 12H58" {...s} />;
        }
        if (kind === "elevator_bucket") {
          return <path d="M46 14v48h22V14M46 24h22M46 38h22M46 52h22" {...s} />;
        }
        if (kind.startsWith("conveyor_") || kind.startsWith("feeder_")) {
          return (
            <>
              <rect x="16" y="24" width="88" height="16" rx="2" {...s} />
              {kind.includes("belt") ? <path d="M28 24a8 8 0 1 0 0.1 0M92 24a8 8 0 1 0 0.1 0" {...s} /> : null}
              {kind.includes("apron") ? <path d="M28 24v16M42 24v16M56 24v16M70 24v16M84 24v16" {...s} /> : null}
              {kind.includes("screw") ? <path d="M24 32c6-8 12-8 18 0s12 8 18 0 12-8 18 0 12 8 18 0" {...s} /> : null}
              {kind.includes("vibratory") ? <path d="M20 50l10-6M92 50l10-6" {...s} /> : null}
              {kind.includes("weigh_hopper") ? <path d="M40 18h20M50 18v28" {...s} /> : null}
            </>
          );
        }
        return <rect x="20" y="22" width="80" height="20" rx="2" {...s} />;
      }
    );
  }

  return registry.generic;
}

export const EQUIPMENT_SYMBOL_REGISTRY = registry;

export function getEquipmentSymbolSpec(shapeKey?: string): EquipmentLibrarySymbolSpec {
  const resolvedKey = shapeKey || "generic";
  const direct = registry[resolvedKey];
  if (direct) {
    return direct;
  }
  const cached = objectSpecCache.get(resolvedKey);
  if (cached) {
    return cached;
  }
  const objectEntry = getMainEquipmentObjectSymbolByKey(resolvedKey);
  if (!objectEntry) {
    return registry.generic;
  }
  const spec = buildObjectSpec(objectEntry);
  objectSpecCache.set(resolvedKey, spec);
  return spec;
}
