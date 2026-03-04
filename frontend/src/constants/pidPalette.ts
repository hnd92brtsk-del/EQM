import type { PidEdgeType, PidInstrumentType, PidNodeCategory } from "../types/pid";

export type PidPaletteItem = {
  key: string;
  category: PidNodeCategory;
  labelKey: string;
};

export const MAIN_EQUIPMENT_SYMBOLS: PidPaletteItem[] = [
  { key: "bunker", category: "main", labelKey: "pid.palette.main.bunker" },
  { key: "feeder", category: "main", labelKey: "pid.palette.main.feeder" },
  { key: "crusher", category: "main", labelKey: "pid.palette.main.crusher" },
  { key: "conveyor", category: "main", labelKey: "pid.palette.main.conveyor" },
  { key: "mill", category: "main", labelKey: "pid.palette.main.mill" },
  { key: "pump", category: "main", labelKey: "pid.palette.main.pump" },
  { key: "tank", category: "main", labelKey: "pid.palette.main.tank" },
  { key: "valve", category: "main", labelKey: "pid.palette.main.valve" },
  { key: "vfd", category: "main", labelKey: "pid.palette.main.vfd" },
  { key: "motor", category: "main", labelKey: "pid.palette.main.motor" },
];

export const MAIN_EQUIPMENT_SHAPE_BY_KEY: Record<string, string> = {
  bunker: "bunker",
  feeder: "feeder",
  crusher: "crusher",
  conveyor: "conveyor",
  mill: "mill",
  pump: "pump",
  tank: "tank",
  valve: "valve",
  vfd: "vfd",
  motor: "motor",
};

export const ISA_INSTRUMENTS: { code: PidInstrumentType; labelKey: string }[] = [
  { code: "TT", labelKey: "pid.palette.instrument.tt" },
  { code: "PT", labelKey: "pid.palette.instrument.pt" },
  { code: "FT", labelKey: "pid.palette.instrument.ft" },
  { code: "LT", labelKey: "pid.palette.instrument.lt" },
  { code: "ST", labelKey: "pid.palette.instrument.st" },
  { code: "VT", labelKey: "pid.palette.instrument.vt" },
  { code: "WT", labelKey: "pid.palette.instrument.wt" },
  { code: "IT", labelKey: "pid.palette.instrument.it" },
  { code: "ET", labelKey: "pid.palette.instrument.et" },
  { code: "ZT", labelKey: "pid.palette.instrument.zt" },
  { code: "PIC", labelKey: "pid.palette.instrument.pic" },
  { code: "TIC", labelKey: "pid.palette.instrument.tic" },
  { code: "FIC", labelKey: "pid.palette.instrument.fic" },
  { code: "LIC", labelKey: "pid.palette.instrument.lic" },
];

export const EDGE_STYLES: Record<
  PidEdgeType,
  { stroke: string; strokeDasharray?: string; labelKey: string; animated?: boolean }
> = {
  process: { stroke: "#1f3b57", labelKey: "pid.edges.process" },
  signal: { stroke: "#4e7ea8", strokeDasharray: "6 4", labelKey: "pid.edges.signal" },
  control: { stroke: "#0a9a6a", strokeDasharray: "8 3", labelKey: "pid.edges.control" },
  electric: { stroke: "#f28f00", strokeDasharray: "3 3", labelKey: "pid.edges.electric", animated: true },
};
