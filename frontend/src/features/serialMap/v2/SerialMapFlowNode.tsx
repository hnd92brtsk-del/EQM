import { Handle, Position, type NodeProps } from "reactflow";

import type { SerialMapFlowNodeData } from "./utils";

const palette = {
  equipment: { border: "#2563eb", accent: "#dbeafe", badge: "#eff6ff" },
  master: { border: "#1d4ed8", accent: "#dbeafe", badge: "#eff6ff" },
  slave: { border: "#15803d", accent: "#dcfce7", badge: "#f0fdf4" },
  sensor: { border: "#c2410c", accent: "#ffedd5", badge: "#fff7ed" },
  bus: { border: "#475569", accent: "#e2e8f0", badge: "#f8fafc" },
  repeater: { border: "#7c3aed", accent: "#ede9fe", badge: "#f5f3ff" },
  gateway: { border: "#dc2626", accent: "#fee2e2", badge: "#fef2f2" },
} as const;

const labels = {
  equipment: "EQUIPMENT",
  master: "MASTER / PLC",
  slave: "SLAVE",
  sensor: "SENSOR / I/O",
  bus: "BUS SEGMENT",
  repeater: "REPEATER",
  gateway: "GATEWAY",
} as const;

export function SerialMapFlowNode({ data, selected }: NodeProps<SerialMapFlowNodeData>) {
  const node = data.node;
  const colors = palette[node.kind];
  const highlightedBorder = data.hasConflict ? "#dc2626" : selected ? "#0f172a" : colors.border;
  const badgeTone = data.hasConflict ? "#fee2e2" : colors.badge;

  return (
    <div className="relative min-w-[170px]">
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !rounded-none !border-2 !border-white !bg-slate-700" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !rounded-none !border-2 !border-white !bg-slate-700" />
      <div
        className="overflow-hidden rounded-none border bg-white shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
        style={{
          borderColor: highlightedBorder,
          boxShadow: selected
            ? "0 0 0 3px rgba(37,99,235,0.12), 0 18px 34px rgba(15,23,42,0.18)"
            : "0 12px 28px rgba(15,23,42,0.12)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: colors.accent, borderColor: `${highlightedBorder}33`, color: highlightedBorder }}
        >
          <span>{labels[node.kind]}</span>
          <span className="rounded-none border px-1.5 py-0.5 text-[9px]" style={{ borderColor: `${highlightedBorder}33`, background: badgeTone }}>
            {node.protocol}
          </span>
        </div>
        <div className="grid gap-2 px-3 py-3">
          <div className="truncate text-[13px] font-semibold text-slate-900" title={data.title}>
            {data.title}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
            <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5">
              Addr: {node.address ?? "n/a"}
            </span>
            <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5">
              {node.baudRate}
            </span>
            <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5">
              Seg {node.segment}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
            <span>
              {node.dataBits} data / {node.stopBits} stop
            </span>
            <span>{node.parity}</span>
          </div>
          {node.note ? (
            <div className="line-clamp-2 border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
              {node.note}
            </div>
          ) : null}
          {data.hasConflict ? (
            <div className="border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700">
              Address conflict detected
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
