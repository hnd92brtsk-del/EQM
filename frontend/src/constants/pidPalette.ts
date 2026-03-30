import type { PidEdgeType, PidInstrumentType, PidNodeCategory } from "../types/pid";
import { getEquipmentSymbolSpec } from "../features/pid/equipmentSymbolRegistry";

export type PidVisualSpec = {
  width: number;
  height: number;
  labelWidth: number;
};

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
  { key: "hopper_bin", labelKey: "pid.shapes.hopper_bin" },
  { key: "weigh_hopper", labelKey: "pid.shapes.weigh_hopper" },
  { key: "thickener", labelKey: "pid.shapes.thickener" },
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
  if (/бункерн.*вес|batch.*weigh|loss-in-weight|weigh/.test(normalized)) return "weigh_hopper";
  if (/бункер|hopper|bin|ore bin/.test(normalized)) return "hopper_bin";
  if (/сгустител|thickener|paste/.test(normalized)) return "thickener";
  if (/щек|jaw/.test(normalized)) return "crusher_jaw";
  if (/конус|cone/.test(normalized)) return "crusher_cone";
  if (/дробил|crusher/.test(normalized)) return "crusher_jaw";
  if (/грохот|screen|siev|vibrat/.test(normalized)) return "screen_vibratory";
  if (/конвей|belt|conveyor/.test(normalized)) return "conveyor_belt";
  if (/мельниц|mill|hpgr|sag/.test(normalized)) return "mill_tumbling";
  if (/насос|pump|vacuum/.test(normalized)) return "pump_centrifugal";
  if (/резервуар|емкост|сило|silo|tank/.test(normalized)) return "tank_vertical";
  if (/задвиж|клапан|valve|gate/.test(normalized)) return "valve_gate";
  if (/двигат|motor|drive/.test(normalized)) return "motor";
  if (/питател|feeder/.test(normalized)) return "feeder";
  if (/циклон|cyclone/.test(normalized)) return "cyclone";
  if (/смесител|mixer|agitator/.test(normalized)) return "mixer";
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

const INSTRUMENT_NODE_SPEC: PidVisualSpec = {
  width: 56,
  height: 56,
  labelWidth: 120,
};

export function getPidNodeVisualSpec(category: PidNodeCategory, shapeKey?: string): PidVisualSpec {
  if (category === "instrument") {
    return INSTRUMENT_NODE_SPEC;
  }
  return getEquipmentSymbolSpec(shapeKey).visual;
}
