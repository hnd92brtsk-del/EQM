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

  return (
    <div className="relative min-w-[138px] cursor-pointer">
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-slate-700 opacity-0" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-slate-700 opacity-0" />
      <div className="flex flex-col items-center gap-2.5">
        <div
          className="relative flex h-[74px] w-[74px] items-center justify-center rounded-full bg-white"
          style={{
            boxShadow: selected
              ? "0 0 0 4px rgba(15,23,42,0.08), 0 14px 28px rgba(15,23,42,0.10)"
              : "0 14px 28px rgba(15,23,42,0.08)",
          }}
        >
          <div
            className="absolute inset-0 rounded-full border bg-white"
            style={{ borderColor: traced ? "#2563eb" : palette.stroke }}
          />
          <div className="absolute inset-[4px] rounded-full border border-slate-200 bg-white" />
          <div
            className="absolute inset-[8px] rounded-full border bg-white"
            style={{ borderColor: traced ? "#60a5fa" : palette.stroke }}
          />
          <div
            className="absolute inset-[15px] rounded-[18px] border"
            style={{
              borderColor: traced ? "#2563eb" : palette.stroke,
              background: traced
                ? "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)"
                : `linear-gradient(180deg, #ffffff 0%, ${palette.soft} 100%)`,
            }}
          />
          <div className="absolute inset-[19px] rounded-[16px] bg-[radial-gradient(circle_at_top,#ffffff_0%,rgba(255,255,255,0.78)_45%,transparent_100%)]" />
          <NetworkDeviceIcon type={data.node.type} className="relative z-10 h-7 w-7 text-slate-700" />
          <span className="absolute right-[9px] top-[9px] h-2.5 w-2.5 rounded-full border border-white bg-black shadow-sm" />
          <div className="absolute -bottom-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {data.node.layer}
          </div>
        </div>
        <div className="text-center">
          <div className="max-w-[156px] truncate text-[11px] font-semibold tracking-tight text-slate-900">{data.node.name}</div>
          <div className="text-[10px] text-slate-500">{data.node.ip || "\u00a0"}</div>
          <div className="max-w-[156px] truncate text-[10px] text-slate-400">{data.node.model || "\u00a0"}</div>
        </div>
      </div>
    </div>
  );
}
