import type {
  LegacySerialMapProjectDraft,
  LegacySerialMapScheme,
  SerialMapConflict,
  SerialMapDataPoolEntry,
  SerialMapDiagnostic,
  SerialMapDocumentData,
  SerialMapEligibleEquipment,
  SerialMapGatewayMapping,
  SerialMapNode,
  SerialMapNodeKind,
  SerialMapProtocol,
  SerialMapSnapshot,
} from "./types";

const defaultViewport = { x: 0, y: 0, zoom: 1 };

export const SERIAL_MAP_PROTOCOLS: { value: SerialMapProtocol; baudRates: number[]; registerTypes: string[]; dataTypes: string[] }[] = [
  { value: "Modbus RTU", baudRates: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200], registerTypes: ["Coil", "Discrete Input", "Input Register", "Holding Register"], dataTypes: ["bool", "int16", "uint16", "int32", "uint32", "float32", "string"] },
  { value: "Profibus DP", baudRates: [9600, 19200, 93750, 187500, 500000, 1500000, 3000000, 12000000], registerTypes: ["Input", "Output", "Diagnostic"], dataTypes: ["bool", "byte", "word", "dword", "float32"] },
  { value: "CAN Bus", baudRates: [10000, 20000, 50000, 125000, 250000, 500000, 1000000], registerTypes: ["PDO", "SDO", "Heartbeat"], dataTypes: ["bool", "byte", "word", "dword", "float32"] },
  { value: "RS-485", baudRates: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200], registerTypes: ["Frame"], dataTypes: ["bytes", "string"] },
  { value: "RS-232", baudRates: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200], registerTypes: ["Frame"], dataTypes: ["bytes", "string"] },
  { value: "Custom", baudRates: [9600, 19200, 38400, 57600, 115200], registerTypes: ["Custom"], dataTypes: ["string"] },
];

const defaultSizeByKind: Record<SerialMapNodeKind, { width: number; height: number }> = {
  equipment: { width: 160, height: 88 },
  master: { width: 160, height: 88 },
  slave: { width: 150, height: 88 },
  sensor: { width: 144, height: 88 },
  bus: { width: 320, height: 36 },
  repeater: { width: 146, height: 88 },
  gateway: { width: 152, height: 88 },
};

const kindTitles: Record<SerialMapNodeKind, string> = {
  equipment: "Оборудование",
  master: "Мастер / ПЛК",
  slave: "Slave",
  sensor: "Датчик / I/O",
  bus: "Сегмент шины",
  repeater: "Репитер / Хаб",
  gateway: "Шлюз",
};

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getProtocolMeta(protocol: SerialMapProtocol) {
  return SERIAL_MAP_PROTOCOLS.find((item) => item.value === protocol) || SERIAL_MAP_PROTOCOLS[0];
}

export function createEmptyDocument(): SerialMapDocumentData {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    viewport: { ...defaultViewport },
    nodes: [],
    edges: [],
    history: { past: [], future: [] },
  };
}

export function snapshotOfDocument(document: SerialMapDocumentData): SerialMapSnapshot {
  return {
    nodes: structuredClone(document.nodes),
    edges: structuredClone(document.edges),
    viewport: structuredClone(document.viewport),
  };
}

export function mutateDocument(
  document: SerialMapDocumentData,
  mutate: (current: SerialMapDocumentData) => SerialMapDocumentData,
  options?: { recordHistory?: boolean }
) {
  const before = snapshotOfDocument(document);
  const next = mutate(structuredClone(document));
  if (options?.recordHistory === false) {
    return { ...next, updatedAt: new Date().toISOString() };
  }
  return {
    ...next,
    updatedAt: new Date().toISOString(),
    history: {
      past: [...document.history.past, before].slice(-100),
      future: [],
    },
  };
}

export function createEmptyDataPoolEntry(protocol: SerialMapProtocol): SerialMapDataPoolEntry {
  const meta = getProtocolMeta(protocol);
  return {
    id: createId("dp"),
    direction: "rx",
    registerType: meta.registerTypes[0],
    address: "",
    name: "",
    dataType: meta.dataTypes[0],
    valueExample: "",
    access: "R",
    description: "",
    sortOrder: 0,
  };
}

export function createEmptyGatewayMapping(): SerialMapGatewayMapping {
  return {
    id: createId("map"),
    srcRegisterType: "",
    srcAddress: "",
    srcDataType: "",
    dstRegisterType: "",
    dstAddress: "",
    dstDataType: "",
    note: "",
  };
}

export function resolveNodeName(node: SerialMapNode, equipmentMap: Map<string, SerialMapEligibleEquipment>) {
  if (!node.sourceRef) return node.name;
  const key = `${node.sourceRef.source}:${node.sourceRef.equipmentInOperationId}`;
  return equipmentMap.get(key)?.displayName || node.name;
}

export function inferProtocolFromPorts(portTypes: string[]): SerialMapProtocol {
  const joined = portTypes.join(" ").toLowerCase();
  if (joined.includes("profibus")) return "Profibus DP";
  if (joined.includes("can")) return "CAN Bus";
  if (joined.includes("rs-232") || joined.includes("com")) return "RS-232";
  if (joined.includes("rs-485")) return "Modbus RTU";
  return "Custom";
}

export function inferBaudRateFromProtocol(protocol: SerialMapProtocol) {
  return getProtocolMeta(protocol).baudRates[0];
}

export function createNodeFromEquipment(item: SerialMapEligibleEquipment, position: { x: number; y: number }): SerialMapNode {
  const inferredKind = /plc|контроллер|controller|плк/i.test(item.displayName) ? "master" : "slave";
  const inferredProtocol = inferProtocolFromPorts(item.serialPorts.map((port) => port.type));
  const size = defaultSizeByKind.equipment;
  return {
    id: createId("node"),
    kind: inferredKind,
    name: item.displayName,
    protocol: inferredProtocol,
    baudRate: inferBaudRateFromProtocol(inferredProtocol),
    address: inferredKind === "master" ? 0 : null,
    parity: "None",
    dataBits: 8,
    stopBits: 1,
    segment: 1,
    note: "",
    width: size.width,
    height: size.height,
    position,
    dataPool: [],
    serialPorts: structuredClone(item.serialPorts),
    bridgeProtocol: null,
    converterMappings: [],
    sourceRef: {
      source: item.source,
      equipmentInOperationId: item.id,
      equipmentTypeId: item.equipmentTypeId,
      containerId: item.containerId,
      containerName: item.containerName,
    },
  };
}

export function createNodeFromPreset(kind: Exclude<SerialMapNodeKind, "equipment">, position: { x: number; y: number }, index: number): SerialMapNode {
  const size = defaultSizeByKind[kind];
  const protocol = kind === "gateway" ? "Profibus DP" : kind === "bus" || kind === "repeater" ? "RS-485" : "Modbus RTU";
  return {
    id: createId("node"),
    kind,
    name: `${kindTitles[kind]} ${index}`,
    protocol,
    baudRate: inferBaudRateFromProtocol(protocol),
    address: kind === "bus" || kind === "repeater" ? null : kind === "master" ? 0 : index,
    parity: "None",
    dataBits: 8,
    stopBits: 1,
    segment: 1,
    note: "",
    width: size.width,
    height: size.height,
    position,
    dataPool: [],
    serialPorts: [],
    bridgeProtocol: kind === "gateway" ? "Profibus DP" : null,
    converterMappings: [],
    sourceRef: null,
  };
}

export function computeConflicts(document: SerialMapDocumentData): SerialMapConflict[] {
  const grouped = new Map<string, SerialMapNode[]>();
  document.nodes.forEach((node) => {
    if (node.address === null) return;
    if (node.kind === "bus" || node.kind === "repeater") return;
    if (node.kind === "master" && node.address === 0) return;
    const key = `${node.protocol}:${node.address}`;
    const list = grouped.get(key) || [];
    list.push(node);
    grouped.set(key, list);
  });
  return Array.from(grouped.entries())
    .filter(([, nodes]) => nodes.length > 1)
    .map(([key, nodes]) => {
      const [protocol, address] = key.split(":");
      return {
        protocol: protocol as SerialMapProtocol,
        address: Number(address),
        nodeIds: nodes.map((node) => node.id),
        nodes: nodes.map((node) => ({ id: node.id, kind: node.kind, name: node.name, sourceRef: node.sourceRef })),
      };
    });
}

export function computeDiagnostics(document: SerialMapDocumentData): SerialMapDiagnostic[] {
  const diagnostics: SerialMapDiagnostic[] = [];
  document.edges.forEach((edge) => {
    const fromNode = document.nodes.find((item) => item.id === edge.fromNodeId);
    const toNode = document.nodes.find((item) => item.id === edge.toNodeId);
    if (!fromNode || !toNode) {
      diagnostics.push({ level: "error", message: `Связь ${edge.label || edge.id} ссылается на отсутствующий узел.` });
      return;
    }
    if (fromNode.protocol !== edge.protocol || toNode.protocol !== edge.protocol) {
      diagnostics.push({ level: "warning", message: `Связь ${edge.label || edge.id} имеет протокол ${edge.protocol}, отличный от узлов.` });
    }
    if (fromNode.baudRate !== edge.baudRate || toNode.baudRate !== edge.baudRate) {
      diagnostics.push({ level: "warning", message: `Связь ${edge.label || edge.id} имеет скорость ${edge.baudRate}, отличную от узлов.` });
    }
  });
  document.nodes.forEach((node) => {
    if (node.protocol === "Profibus DP" && node.address === 126) diagnostics.push({ level: "warning", message: `Узел ${node.name}: адрес 126 для Profibus DP считается ненастроенным.` });
    if (node.kind === "gateway" && (!node.converterMappings || node.converterMappings.length === 0)) diagnostics.push({ level: "info", message: `Шлюз ${node.name}: маппинги конвертера пока не заданы.` });
    const meta = getProtocolMeta(node.protocol);
    node.dataPool.forEach((entry) => {
      if (!meta.registerTypes.includes(entry.registerType)) diagnostics.push({ level: "warning", message: `Узел ${node.name}: тип регистра "${entry.registerType}" не подходит для ${node.protocol}.` });
      if (!meta.dataTypes.includes(entry.dataType)) diagnostics.push({ level: "warning", message: `Узел ${node.name}: тип данных "${entry.dataType}" не подходит для ${node.protocol}.` });
    });
  });
  return diagnostics;
}

export function autoLayoutDocument(document: SerialMapDocumentData): SerialMapDocumentData {
  const groups: Record<string, SerialMapNode[]> = { master: [], bus: [], gateway: [], repeater: [], equipment: [], slave: [], sensor: [] };
  document.nodes.forEach((node) => groups[node.kind].push(node));
  const nextNodes = document.nodes.map((node) => ({ ...node }));
  const layoutRows: SerialMapNodeKind[] = ["master", "bus", "gateway", "repeater", "equipment", "slave", "sensor"];
  const rowGap = 130;
  const colGap = 220;
  layoutRows.forEach((kind, rowIndex) => {
    groups[kind].forEach((node, index) => {
      const target = nextNodes.find((item) => item.id === node.id);
      if (!target) return;
      target.position = { x: 80 + index * colGap + (kind === "bus" ? 60 : 0), y: 80 + rowIndex * rowGap };
    });
  });
  return { ...document, nodes: nextNodes };
}

export function createDemoDocument(): SerialMapDocumentData {
  const document = createEmptyDocument();
  const rsMaster = createNodeFromPreset("master", { x: 80, y: 40 }, 1);
  rsMaster.name = "Siemens S7-300";
  const rsBus = createNodeFromPreset("bus", { x: 50, y: 155 }, 1);
  rsBus.name = "Шина RS-485";
  const rsSlave1 = createNodeFromPreset("slave", { x: 80, y: 245 }, 1);
  rsSlave1.name = "VFD Привод 1";
  rsSlave1.address = 1;
  const rsSlave2 = createNodeFromPreset("slave", { x: 260, y: 245 }, 2);
  rsSlave2.name = "VFD Привод 2";
  rsSlave2.address = 2;
  const rsSensor = createNodeFromPreset("sensor", { x: 440, y: 245 }, 3);
  rsSensor.name = "Датчик T-01";
  rsSensor.address = 3;
  const rsGateway = createNodeFromPreset("gateway", { x: 620, y: 245 }, 4);
  rsGateway.name = "Шлюз Profibus";
  rsGateway.address = 4;
  rsGateway.converterMappings = [createEmptyGatewayMapping(), createEmptyGatewayMapping()];
  document.nodes = [rsMaster, rsBus, rsSlave1, rsSlave2, rsSensor, rsGateway];
  document.edges = [
    { id: createId("edge"), fromNodeId: rsMaster.id, toNodeId: rsBus.id, protocol: "RS-485", baudRate: 9600, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: rsBus.id, toNodeId: rsSlave1.id, protocol: "Modbus RTU", baudRate: 9600, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: rsBus.id, toNodeId: rsSlave2.id, protocol: "Modbus RTU", baudRate: 9600, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: rsBus.id, toNodeId: rsSensor.id, protocol: "Modbus RTU", baudRate: 9600, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: rsBus.id, toNodeId: rsGateway.id, protocol: "Modbus RTU", baudRate: 9600, label: "", meta: {} },
  ];
  return document;
}

function isLegacyProject(input: unknown): input is LegacySerialMapProjectDraft {
  return Boolean(input && typeof input === "object" && Array.isArray((input as LegacySerialMapProjectDraft).schemes));
}

function normalizeLegacyScheme(scheme: LegacySerialMapScheme | undefined): SerialMapDocumentData {
  if (!scheme) return createEmptyDocument();
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    viewport: structuredClone(scheme.viewport || defaultViewport),
    nodes: structuredClone(scheme.nodes || []),
    edges: structuredClone(scheme.edges || []),
    history: structuredClone(scheme.history || { past: [], future: [] }),
  };
}

export function convertLegacyProjectToDocuments(input: LegacySerialMapProjectDraft) {
  return (input.schemes || []).map((scheme, index) => ({
    name: scheme.name || `Схема ${index + 1}`,
    description: scheme.description || null,
    document: normalizeLegacyScheme(scheme),
  }));
}

export function normalizeSerialMapDocument(input: unknown): SerialMapDocumentData {
  if (input && typeof input === "object" && (input as SerialMapDocumentData).version === 2 && Array.isArray((input as SerialMapDocumentData).nodes)) {
    const current = input as SerialMapDocumentData;
    return {
      version: 2,
      updatedAt: current.updatedAt || new Date().toISOString(),
      viewport: current.viewport || { ...defaultViewport },
      nodes: current.nodes || [],
      edges: current.edges || [],
      history: current.history || { past: [], future: [] },
    };
  }
  if (isLegacyProject(input)) {
    const activeScheme = input.schemes.find((scheme) => scheme.id === input.activeSchemeId) || input.schemes[0];
    return normalizeLegacyScheme(activeScheme);
  }
  return createEmptyDocument();
}

export function validateImportedProject(input: unknown): { documents: Array<{ name: string; description: string | null; document: SerialMapDocumentData }>; diagnostics: SerialMapDiagnostic[] } {
  if (!input || typeof input !== "object") {
    return { documents: [], diagnostics: [{ level: "error", message: "Импортируемый файл не содержит корректный JSON-объект." }] };
  }
  if (isLegacyProject(input)) {
    const diagnostics: SerialMapDiagnostic[] = [];
    if (input.version !== 1) diagnostics.push({ level: "error", message: "Поддерживается только версия legacy-проекта 1." });
    if (!Array.isArray(input.schemes) || input.schemes.length === 0) diagnostics.push({ level: "error", message: "В проекте нет ни одной схемы." });
    const documents = convertLegacyProjectToDocuments(input);
    documents.forEach((item) => diagnostics.push(...computeDiagnostics(item.document)));
    return { documents: diagnostics.some((item) => item.level === "error") ? [] : documents, diagnostics };
  }
  const document = normalizeSerialMapDocument(input);
  const diagnostics = computeDiagnostics(document);
  return { documents: [{ name: "Импортированная схема", description: null, document }], diagnostics };
}
