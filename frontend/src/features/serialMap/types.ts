export type SerialMapSaveStatus = "saved" | "saving" | "error" | "idle";

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

export type SerialMapGatewayMapping = {
  id: string;
  srcRegisterType: string;
  srcAddress: string;
  srcDataType: string;
  dstRegisterType: string;
  dstAddress: string;
  dstDataType: string;
  note: string;
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
  bridgeProtocol?: SerialMapProtocol | null;
  converterMappings?: SerialMapGatewayMapping[];
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

export type SerialMapViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type SerialMapSnapshot = {
  nodes: SerialMapNode[];
  edges: SerialMapEdge[];
  viewport: SerialMapViewport;
};

export type SerialMapHistory = {
  past: SerialMapSnapshot[];
  future: SerialMapSnapshot[];
};

export type SerialMapDocumentData = {
  version: 2;
  updatedAt: string;
  viewport: SerialMapViewport;
  nodes: SerialMapNode[];
  edges: SerialMapEdge[];
  history: SerialMapHistory;
};

export type LegacySerialMapScheme = {
  id: string;
  name: string;
  description?: string | null;
  viewport: SerialMapViewport;
  nodes: SerialMapNode[];
  edges: SerialMapEdge[];
  history: SerialMapHistory;
};

export type LegacySerialMapProjectDraft = {
  projectId: string;
  version: 1;
  updatedAt: string;
  activeSchemeId: string;
  schemes: LegacySerialMapScheme[];
};

export type SerialMapConflict = {
  protocol: SerialMapProtocol;
  address: number;
  nodeIds: string[];
  nodes: Pick<SerialMapNode, "id" | "kind" | "name" | "sourceRef">[];
};

export type SerialMapDiagnostic = {
  level: "warning" | "error" | "info";
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

export type SerialMapDocumentRecord = {
  id: number;
  name: string;
  description: string | null;
  scope: string | null;
  location_id: number | null;
  source_context: Record<string, unknown> | null;
  document: SerialMapDocumentData;
  created_by_id: number | null;
  updated_by_id: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
};
