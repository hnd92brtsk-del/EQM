export type PidNodeCategory = "main" | "instrument" | "external";
export type PidEdgeType = "process" | "signal" | "control" | "electric";
export type PidSymbolSource = "library" | "upload";
export type PidSymbolStandard = "ISA-5.1" | "ISO-14617";

export type PidSymbol = {
  source: PidSymbolSource;
  libraryKey?: string;
  assetUrl?: string;
  standard: PidSymbolStandard;
};

export type PidNodeType = "equipment" | "instrument" | "external";

export type PidInstrumentType =
  | "TT"
  | "PT"
  | "FT"
  | "LT"
  | "ST"
  | "VT"
  | "WT"
  | "IT"
  | "ET"
  | "ZT"
  | "PIC"
  | "TIC"
  | "FIC"
  | "LIC";

export type PidSourceRef = {
  source: "main-equipment" | "field-equipment" | "equipment-in-operation" | "palette";
  id?: number;
  name?: string;
  meta?: { shapeKey?: string; pidSymbol?: PidSymbol | null };
};

export type PidProperties = {
  plc?: string;
  ranges?: string;
  signalType?: string;
  params?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

export type PidNode = {
  id: string;
  type: PidNodeType;
  category: PidNodeCategory;
  symbolKey: string;
  label: string;
  tag: string;
  position: { x: number; y: number };
  sourceRef?: PidSourceRef | null;
  properties: PidProperties;
};

export type PidEdge = {
  id: string;
  source: string;
  target: string;
  edgeType: PidEdgeType;
  label: string;
  style?: Record<string, string | number>;
};

export type PidDiagram = {
  processId: number;
  version: 1;
  updatedAt: string;
  viewport: { x: number; y: number; zoom: number };
  nodes: PidNode[];
  edges: PidEdge[];
};

export type PidProcess = {
  id: number;
  location_id: number;
  name: string;
  description?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};
