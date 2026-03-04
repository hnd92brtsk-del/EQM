import type { PidEdgeType, PidInstrumentType, PidNodeCategory } from "../types/pid";

export type PidPaletteItem = {
  key: string;
  category: PidNodeCategory;
  labelKey: string;
};

export type MainEquipmentShapeOption = {
  key: string;
  labelKey: string;
};

export const MAIN_EQUIPMENT_SHAPE_OPTIONS: MainEquipmentShapeOption[] = [
  { key: "crusher_jaw", labelKey: "pid.shapes.crusher_jaw" },
  { key: "crusher_cone", labelKey: "pid.shapes.crusher_cone" },
  { key: "screen_vibratory", labelKey: "pid.shapes.screen_vibratory" },
  { key: "conveyor_belt", labelKey: "pid.shapes.conveyor_belt" },
  { key: "mill_tumbling", labelKey: "pid.shapes.mill_tumbling" },
  { key: "pump_centrifugal", labelKey: "pid.shapes.pump_centrifugal" },
  { key: "tank_vertical", labelKey: "pid.shapes.tank_vertical" },
  { key: "valve_gate", labelKey: "pid.shapes.valve_gate" },
  { key: "motor", labelKey: "pid.shapes.motor" },
  { key: "feeder", labelKey: "pid.shapes.feeder" },
  { key: "cyclone", labelKey: "pid.shapes.cyclone" },
  { key: "mixer", labelKey: "pid.shapes.mixer" },
  { key: "generic", labelKey: "pid.shapes.generic" },
];

export function inferMainEquipmentShapeKey(name: string): string {
  const normalized = name.toLowerCase();
  if (/щек|jaw/.test(normalized)) return "crusher_jaw";
  if (/конус|cone/.test(normalized)) return "crusher_cone";
  if (/дробил|crusher/.test(normalized)) return "crusher_jaw";
  if (/грохот|scre|siev/.test(normalized)) return "screen_vibratory";
  if (/конвей|belt|conveyor/.test(normalized)) return "conveyor_belt";
  if (/мельниц|mill|hpgr/.test(normalized)) return "mill_tumbling";
  if (/насос|pump/.test(normalized)) return "pump_centrifugal";
  if (/резерв|tank|емкост|silo/.test(normalized)) return "tank_vertical";
  if (/задвиж|клапан|valve/.test(normalized)) return "valve_gate";
  if (/двигат|motor/.test(normalized)) return "motor";
  if (/питател|feeder/.test(normalized)) return "feeder";
  if (/циклон|cyclone/.test(normalized)) return "cyclone";
  if (/смесител|mixer/.test(normalized)) return "mixer";
  return "generic";
}

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
