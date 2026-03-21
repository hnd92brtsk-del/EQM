import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "reactflow";

import type { NetworkEdge } from "./types";
import { getStatusPalette } from "./utils";

type Data = {
  edge: NetworkEdge;
  traced?: boolean;
};

function getStroke(edge: NetworkEdge, traced: boolean) {
  if (traced) return { color: "#2563eb", width: 3.2, dash: undefined };
  switch (edge.style) {
    case "fiber":
      return { color: getStatusPalette(edge.status).stroke, width: 3.5, dash: undefined };
    case "vpn":
      return { color: getStatusPalette(edge.status).stroke, width: 3, dash: "10 6" };
    case "wireless":
      return { color: getStatusPalette(edge.status).stroke, width: 3, dash: "5 5" };
    case "mpls":
      return { color: getStatusPalette(edge.status).stroke, width: 3.3, dash: "14 6 4 6" };
    case "trunk":
      return { color: getStatusPalette(edge.status).stroke, width: 5, dash: undefined };
    default:
      return { color: getStatusPalette(edge.status).stroke, width: 3, dash: undefined };
  }
}

export function NetworkMapEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }: EdgeProps<Data>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const traced = Boolean(data?.traced);
  const edge = data?.edge;
  if (!edge) return null;
  const stroke = getStroke(edge, traced);
  const labelTone = traced
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : edge.status === "critical"
      ? "border-red-200 bg-red-50 text-red-700"
      : edge.status === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-white text-slate-600";

  return (
    <>
      <BaseEdge id={`${id}-halo`} path={path} style={{ stroke: selected ? "rgba(15,23,42,0.22)" : "rgba(15,23,42,0.08)", strokeWidth: stroke.width + 5.5 }} />
      <BaseEdge id={id} path={path} style={{ stroke: selected ? "#0f172a" : stroke.color, strokeWidth: stroke.width, strokeDasharray: stroke.dash }} />
      <EdgeLabelRenderer>
        <div
          className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-[10px] font-semibold shadow-[0_6px_20px_rgba(15,23,42,0.08)] ${labelTone}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
        >
          <span className="relative block">
            <span className="absolute inset-x-2 -top-1 h-px bg-current opacity-10" />
            <span>{edge.label || edge.network || edge.style}</span>
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
