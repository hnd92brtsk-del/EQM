import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "reactflow";

import type { SerialMapFlowEdgeData } from "./utils";

function edgeStroke(protocol: string) {
  switch (protocol) {
    case "Profibus DP":
      return { color: "#7c3aed", dash: "10 6" };
    case "CAN Bus":
      return { color: "#0f766e", dash: "6 5" };
    case "RS-232":
      return { color: "#c2410c", dash: "4 4" };
    case "RS-485":
      return { color: "#475569", dash: "8 4" };
    case "Custom":
      return { color: "#0f172a", dash: "12 6 3 6" };
    default:
      return { color: "#2563eb", dash: undefined as string | undefined };
  }
}

export function SerialMapFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<SerialMapFlowEdgeData>) {
  const edge = data?.edge;
  if (!edge) return null;

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const stroke = edgeStroke(edge.protocol);

  return (
    <>
      <BaseEdge
        id={`${id}-halo`}
        path={path}
        style={{
          stroke: selected ? "rgba(15,23,42,0.22)" : "rgba(15,23,42,0.08)",
          strokeWidth: selected ? 7 : 5,
        }}
      />
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: selected ? "#0f172a" : stroke.color,
          strokeWidth: 2.6,
          strokeDasharray: stroke.dash,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel)] px-2 py-1 text-[10px] font-semibold text-[var(--eqm-ui-muted)] shadow-sm"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
        >
          {edge.label || edge.cableMark || edge.protocol}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
