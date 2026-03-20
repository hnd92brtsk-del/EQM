export type SerialMapSaveStatus = "saved" | "saving" | "error";

export type SerialMapNodeKind = "equipment" | "master" | "slave" | "sensor" | "bus" | "repeater" | "gateway";

export type SerialMapParity = "None" | "Even" | "Odd" | "Mark" | "Space";

export type SerialMapProtocol = "Modbus RTU" | "Profibus DP" | "CAN Bus" | "RS-485" | "RS-232" | "Custom";

export type SerialMapDataDirection = "rx" | "tx";

export type SerialMapDataPoolEntry = {
  id: string;
  direction: SerialMapDataDirection;
  registerType: string;
  address: string;
  name: string;
  dataType: string;
  valueExample: string;
  access: "R" | "RW" | "W";
  description: string;
  sortOrder: number;
};

export type SerialMapEquipmentSource = {
  source: "cabinet" | "assembly";
  equipmentInOperationId: number;
  equipmentTypeId: number;
  containerId: number;
  containerName: string;
};

export type SerialPortDescriptor = {
  type: string;
  count: number;
};

export type SerialMapNode = {
  id: string;
  kind: SerialMapNodeKind;
  name: string;
  protocol: SerialMapProtocol;
  baudRate: number;
  address: number | null;
  parity: SerialMapParity;
  dataBits: number;
  stopBits: number;
  segment: number;
  note: string;
  width: number;
  height: number;
  position: { x: number; y: number };
  dataPool: SerialMapDataPoolEntry[];
  serialPorts: SerialPortDescriptor[];
  sourceRef?: SerialMapEquipmentSource | null;
};

export type SerialMapEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  protocol: SerialMapProtocol;
  baudRate: number;
  label: string;
  meta: Record<string, string | number | boolean | null>;
};

export type SerialMapSnapshot = {
  nodes: SerialMapNode[];
  edges: SerialMapEdge[];
  viewport: { x: number; y: number; zoom: number };
};

export type SerialMapHistory = {
  past: SerialMapSnapshot[];
  future: SerialMapSnapshot[];
};

export type SerialMapScheme = {
  id: string;
  name: string;
  description?: string | null;
  viewport: { x: number; y: number; zoom: number };
  nodes: SerialMapNode[];
  edges: SerialMapEdge[];
  history: SerialMapHistory;
};

export type SerialMapProjectDraft = {
  projectId: string;
  version: 1;
  updatedAt: string;
  activeSchemeId: string;
  schemes: SerialMapScheme[];
};

export type SerialMapConflict = {
  schemeId: string;
  schemeName: string;
  protocol: SerialMapProtocol;
  address: number;
  nodeIds: string[];
  nodes: Pick<SerialMapNode, "id" | "kind" | "name" | "sourceRef">[];
};

export type SerialMapDiagnostic = {
  level: "warning" | "error";
  message: string;
};

export type SerialMapEligibleEquipment = {
  key: string;
  id: number;
  source: "cabinet" | "assembly";
  containerId: number;
  containerName: string;
  equipmentTypeId: number;
  equipmentTypeName: string;
  manufacturerName: string | null;
  displayName: string;
  serialPorts: SerialPortDescriptor[];
  locationFullPath: string | null;
};
