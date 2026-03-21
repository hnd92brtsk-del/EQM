import { Handle, Position, type NodeProps } from "reactflow";

import { NetworkDeviceIcon } from "./NetworkDeviceIcon";
import type { NetworkNode } from "./types";
import { getStatusPalette } from "./utils";

type Data = {
  node: NetworkNode;
  traced?: boolean;
};

export function NetworkMapNode({ data, selected }: NodeProps<Data>) {
  const palette = getStatusPalette(data.node.status);
  const traced = Boolean(data.traced);
  const shellStroke = traced ? "#2563eb" : palette.stroke;

  return (
    <div className="relative z-10 min-w-[168px] cursor-pointer">
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-slate-700 opacity-0" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-slate-700 opacity-0" />
      <div className="flex flex-col items-center gap-2.5">
        <div
          className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full bg-white"
          style={{
            boxShadow: selected
              ? "0 0 0 4px rgba(15,23,42,0.08), 0 18px 34px rgba(15,23,42,0.12)"
              : "0 14px 30px rgba(15,23,42,0.10)",
          }}
        >
          <div
            className="absolute inset-0 rounded-full border bg-white"
            style={{ borderColor: shellStroke }}
          />
          <div className="absolute inset-[3px] rounded-full border border-slate-100 bg-white" />
          <div
            className="absolute inset-[7px] rounded-full border bg-white"
            style={{ borderColor: traced ? "#60a5fa" : shellStroke }}
          />
          <div
            className="absolute inset-[14px] rounded-[20px] border"
            style={{
              borderColor: shellStroke,
              background: traced
                ? "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)"
                : `linear-gradient(180deg, #ffffff 0%, ${palette.soft} 100%)`,
            }}
          />
          <div className="absolute inset-[18px] rounded-[18px] bg-[radial-gradient(circle_at_top,#ffffff_0%,rgba(255,255,255,0.78)_45%,transparent_100%)]" />
          <div className="absolute inset-[23px] rounded-[14px] border border-white/80 bg-white/65" />
          <NetworkDeviceIcon type={data.node.type} className="relative z-10 h-7 w-7 text-slate-700" />
          <span className="absolute right-[10px] top-[10px] h-2.5 w-2.5 rounded-full border border-white bg-black shadow-sm" />
          <div className="absolute -bottom-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500 shadow-sm">
            {data.node.layer}
          </div>
        </div>
        <div className="rounded-[18px] bg-white/92 px-3 py-2 text-center shadow-[0_10px_28px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 backdrop-blur-sm">
          <div className="max-w-[164px] truncate text-[11px] font-semibold tracking-tight text-slate-900">{data.node.name}</div>
          <div className="mt-1 text-[10px] text-slate-500">{data.node.ip || "\u00a0"}</div>
          <div className="mt-0.5 max-w-[164px] truncate text-[10px] text-slate-400">{data.node.model || "\u00a0"}</div>
        </div>
      </div>
    </div>
  );
}
