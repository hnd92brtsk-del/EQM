import type {
  SerialMapConflict,
  SerialMapDataPoolEntry,
  SerialMapDiagnostic,
  SerialMapEligibleEquipment,
  SerialMapGatewayMapping,
  SerialMapNode,
  SerialMapNodeKind,
  SerialMapProjectDraft,
  SerialMapProtocol,
  SerialMapScheme,
  SerialMapSnapshot
} from "./types";

const defaultViewport = { x: 0, y: 0, zoom: 1 };

export const SERIAL_MAP_PROTOCOLS: { value: SerialMapProtocol; baudRates: number[]; registerTypes: string[]; dataTypes: string[] }[] = [
  {
    value: "Modbus RTU",
    baudRates: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200],
    registerTypes: ["Coil", "Discrete Input", "Input Register", "Holding Register"],
    dataTypes: ["bool", "int16", "uint16", "int32", "uint32", "float32", "string"]
  },
  {
    value: "Profibus DP",
    baudRates: [9600, 19200, 93750, 187500, 500000, 1500000, 3000000, 12000000],
    registerTypes: ["Input", "Output", "Diagnostic"],
    dataTypes: ["bool", "byte", "word", "dword", "float32"]
  },
  {
    value: "CAN Bus",
    baudRates: [10000, 20000, 50000, 125000, 250000, 500000, 1000000],
    registerTypes: ["PDO", "SDO", "Heartbeat"],
    dataTypes: ["bool", "byte", "word", "dword", "float32"]
  },
  {
    value: "RS-485",
    baudRates: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200],
    registerTypes: ["Frame"],
    dataTypes: ["bytes", "string"]
  },
  {
    value: "RS-232",
    baudRates: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200],
    registerTypes: ["Frame"],
    dataTypes: ["bytes", "string"]
  },
  {
    value: "Custom",
    baudRates: [9600, 19200, 38400, 57600, 115200],
    registerTypes: ["Custom"],
    dataTypes: ["string"]
  }
];

const defaultSizeByKind: Record<SerialMapNodeKind, { width: number; height: number }> = {
  equipment: { width: 160, height: 88 },
  master: { width: 160, height: 88 },
  slave: { width: 150, height: 88 },
  sensor: { width: 144, height: 88 },
  bus: { width: 320, height: 36 },
  repeater: { width: 146, height: 88 },
  gateway: { width: 152, height: 88 }
};

const kindTitles: Record<SerialMapNodeKind, string> = {
  equipment: "Оборудование",
  master: "Мастер / ПЛК",
  slave: "RTU Slave",
  sensor: "Датчик / I/O",
  bus: "Сегмент шины",
  repeater: "Репитер / Хаб",
  gateway: "Шлюз"
};

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getProtocolMeta(protocol: SerialMapProtocol) {
  return SERIAL_MAP_PROTOCOLS.find((item) => item.value === protocol) || SERIAL_MAP_PROTOCOLS[0];
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
    sortOrder: 0
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
    note: ""
  };
}

export function createScheme(name = "Контур 1"): SerialMapScheme {
  return {
    id: createId("scheme"),
    name,
    description: "",
    viewport: { ...defaultViewport },
    nodes: [],
    edges: [],
    history: {
      past: [],
      future: []
    }
  };
}

export function createDefaultProjectDraft(): SerialMapProjectDraft {
  const firstScheme = createScheme();
  return {
    projectId: createId("project"),
    version: 1,
    updatedAt: new Date().toISOString(),
    activeSchemeId: firstScheme.id,
    schemes: [firstScheme]
  };
}

export function snapshotOfScheme(scheme: SerialMapScheme): SerialMapSnapshot {
  return {
    nodes: structuredClone(scheme.nodes),
    edges: structuredClone(scheme.edges),
    viewport: structuredClone(scheme.viewport)
  };
}

export function applySnapshotToScheme(scheme: SerialMapScheme, snapshot: SerialMapSnapshot): SerialMapScheme {
  return {
    ...scheme,
    nodes: structuredClone(snapshot.nodes),
    edges: structuredClone(snapshot.edges),
    viewport: structuredClone(snapshot.viewport)
  };
}

export function withSchemeMutation(
  project: SerialMapProjectDraft,
  schemeId: string,
  mutate: (scheme: SerialMapScheme) => SerialMapScheme,
  options?: { recordHistory?: boolean }
): SerialMapProjectDraft {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    schemes: project.schemes.map((scheme) => {
      if (scheme.id !== schemeId) {
        return scheme;
      }
      const before = snapshotOfScheme(scheme);
      const nextScheme = mutate(structuredClone(scheme));
      if (options?.recordHistory === false) {
        return nextScheme;
      }
      const historyPast = [...scheme.history.past, before].slice(-100);
      return {
        ...nextScheme,
        history: {
          past: historyPast,
          future: []
        }
      };
    })
  };
}

export function resolveNodeName(node: SerialMapNode, equipmentMap: Map<string, SerialMapEligibleEquipment>) {
  if (!node.sourceRef) {
    return node.name;
  }
  const key = `${node.sourceRef.source}:${node.sourceRef.equipmentInOperationId}`;
  return equipmentMap.get(key)?.displayName || node.name;
}

export function createNodeFromEquipment(item: SerialMapEligibleEquipment, position: { x: number; y: number }): SerialMapNode {
  const inferredKind = /plc|контроллер|controller|плк/i.test(item.displayName) ? "master" : "slave";
  const size = defaultSizeByKind.equipment;
  return {
    id: createId("node"),
    kind: inferredKind,
    name: item.displayName,
    protocol: inferProtocolFromPorts(item.serialPorts.map((port) => port.type)),
    baudRate: inferBaudRateFromProtocol(inferProtocolFromPorts(item.serialPorts.map((port) => port.type))),
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
      containerName: item.containerName
    }
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
    sourceRef: null
  };
}

export function inferProtocolFromPorts(portTypes: string[]): SerialMapProtocol {
  const joined = portTypes.join(" ").toLowerCase();
  if (joined.includes("profibus")) {
    return "Profibus DP";
  }
  if (joined.includes("can")) {
    return "CAN Bus";
  }
  if (joined.includes("rs-232") || joined.includes("com")) {
    return "RS-232";
  }
  if (joined.includes("rs-485")) {
    return "Modbus RTU";
  }
  return "Custom";
}

export function inferBaudRateFromProtocol(protocol: SerialMapProtocol) {
  return getProtocolMeta(protocol).baudRates[0];
}

export function computeConflicts(project: SerialMapProjectDraft): SerialMapConflict[] {
  return project.schemes.flatMap((scheme) => {
    const grouped = new Map<string, SerialMapNode[]>();
    scheme.nodes.forEach((node) => {
      if (node.address === null) {
        return;
      }
      if (node.kind === "bus" || node.kind === "repeater") {
        return;
      }
      if (node.kind === "master" && node.address === 0) {
        return;
      }
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
          schemeId: scheme.id,
          schemeName: scheme.name,
          protocol: protocol as SerialMapProtocol,
          address: Number(address),
          nodeIds: nodes.map((node) => node.id),
          nodes: nodes.map((node) => ({
            id: node.id,
            kind: node.kind,
            name: node.name,
            sourceRef: node.sourceRef
          }))
        };
      });
  });
}

export function computeDiagnostics(scheme: SerialMapScheme): SerialMapDiagnostic[] {
  const diagnostics: SerialMapDiagnostic[] = [];
  scheme.edges.forEach((edge) => {
    const fromNode = scheme.nodes.find((item) => item.id === edge.fromNodeId);
    const toNode = scheme.nodes.find((item) => item.id === edge.toNodeId);
    if (!fromNode || !toNode) {
      diagnostics.push({ level: "error", message: `Связь ${edge.label || edge.id} ссылается на отсутствующий узел.` });
      return;
    }
    if (fromNode.protocol !== edge.protocol || toNode.protocol !== edge.protocol) {
      diagnostics.push({
        level: "warning",
        message: `Связь ${edge.label || edge.id} имеет протокол ${edge.protocol}, отличный от узлов.`
      });
    }
    if (fromNode.baudRate !== edge.baudRate || toNode.baudRate !== edge.baudRate) {
      diagnostics.push({
        level: "warning",
        message: `Связь ${edge.label || edge.id} имеет скорость ${edge.baudRate}, отличную от узлов.`
      });
    }
  });
  scheme.nodes.forEach((node) => {
    if (node.protocol === "Profibus DP" && node.address === 126) {
      diagnostics.push({
        level: "warning",
        message: `Узел ${node.name}: адрес 126 для Profibus DP считается ненастроенным.`
      });
    }
    if (node.kind === "gateway" && (!node.converterMappings || node.converterMappings.length === 0)) {
      diagnostics.push({
        level: "info",
        message: `Шлюз ${node.name}: маппинги конвертера пока не заданы.`
      });
    }
    const meta = getProtocolMeta(node.protocol);
    node.dataPool.forEach((entry) => {
      if (!meta.registerTypes.includes(entry.registerType)) {
        diagnostics.push({
          level: "warning",
          message: `Узел ${node.name}: тип регистра "${entry.registerType}" не подходит для ${node.protocol}.`
        });
      }
      if (!meta.dataTypes.includes(entry.dataType)) {
        diagnostics.push({
          level: "warning",
          message: `Узел ${node.name}: тип данных "${entry.dataType}" не подходит для ${node.protocol}.`
        });
      }
    });
  });
  return diagnostics;
}

export function createDemoProjectDraft(): SerialMapProjectDraft {
  const project = createDefaultProjectDraft();

  const rs = createScheme("Контур 1: Основная RS-485");
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
  rsSensor.note = "Температура";
  const rsGateway = createNodeFromPreset("gateway", { x: 620, y: 245 }, 4);
  rsGateway.name = "Шлюз Profibus";
  rsGateway.address = 4;
  rsGateway.converterMappings = [createEmptyGatewayMapping(), createEmptyGatewayMapping()];
  rs.nodes = [rsMaster, rsBus, rsSlave1, rsSlave2, rsSensor, rsGateway];
  rs.edges = [
    { id: createId("edge"), fromNodeId: rsMaster.id, toNodeId: rsBus.id, protocol: "RS-485", baudRate: 9600, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: rsBus.id, toNodeId: rsSlave1.id, protocol: "Modbus RTU", baudRate: 9600, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: rsBus.id, toNodeId: rsSlave2.id, protocol: "Modbus RTU", baudRate: 9600, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: rsBus.id, toNodeId: rsSensor.id, protocol: "Modbus RTU", baudRate: 9600, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: rsBus.id, toNodeId: rsGateway.id, protocol: "Modbus RTU", baudRate: 9600, label: "", meta: {} }
  ];

  const pb = createScheme("Контур 2: Profibus DP");
  const pbMaster = createNodeFromPreset("master", { x: 90, y: 40 }, 1);
  pbMaster.name = "Beckhoff CX5120";
  pbMaster.protocol = "Profibus DP";
  pbMaster.baudRate = 1500000;
  const pbBus = createNodeFromPreset("bus", { x: 60, y: 155 }, 1);
  pbBus.name = "Шина Profibus DP";
  pbBus.protocol = "Profibus DP";
  const pbSlave1 = createNodeFromPreset("slave", { x: 90, y: 245 }, 1);
  pbSlave1.name = "ET200S Модуль 1";
  pbSlave1.protocol = "Profibus DP";
  pbSlave1.baudRate = 1500000;
  pbSlave1.address = 3;
  const pbSlave2 = createNodeFromPreset("slave", { x: 280, y: 245 }, 2);
  pbSlave2.name = "ET200S Модуль 2";
  pbSlave2.protocol = "Profibus DP";
  pbSlave2.baudRate = 1500000;
  pbSlave2.address = 4;
  pb.nodes = [pbMaster, pbBus, pbSlave1, pbSlave2];
  pb.edges = [
    { id: createId("edge"), fromNodeId: pbMaster.id, toNodeId: pbBus.id, protocol: "Profibus DP", baudRate: 1500000, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: pbBus.id, toNodeId: pbSlave1.id, protocol: "Profibus DP", baudRate: 1500000, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: pbBus.id, toNodeId: pbSlave2.id, protocol: "Profibus DP", baudRate: 1500000, label: "", meta: {} }
  ];

  const can = createScheme("Контур 3: CAN Bus");
  const canMaster = createNodeFromPreset("master", { x: 90, y: 40 }, 1);
  canMaster.name = "ECU Главный";
  canMaster.protocol = "CAN Bus";
  canMaster.baudRate = 500000;
  const canBus = createNodeFromPreset("bus", { x: 60, y: 155 }, 1);
  canBus.name = "CAN High-Speed Bus";
  canBus.protocol = "CAN Bus";
  const canSlave = createNodeFromPreset("slave", { x: 90, y: 245 }, 1);
  canSlave.name = "Узел CAN 1";
  canSlave.protocol = "CAN Bus";
  canSlave.baudRate = 500000;
  canSlave.address = 1;
  can.nodes = [canMaster, canBus, canSlave];
  can.edges = [
    { id: createId("edge"), fromNodeId: canMaster.id, toNodeId: canBus.id, protocol: "CAN Bus", baudRate: 500000, label: "", meta: {} },
    { id: createId("edge"), fromNodeId: canBus.id, toNodeId: canSlave.id, protocol: "CAN Bus", baudRate: 500000, label: "", meta: {} }
  ];

  project.schemes = [rs, pb, can];
  project.activeSchemeId = rs.id;
  return project;
}

export function validateImportedProject(input: unknown): { project: SerialMapProjectDraft | null; diagnostics: SerialMapDiagnostic[] } {
  if (!input || typeof input !== "object") {
    return {
      project: null,
      diagnostics: [{ level: "error", message: "Импортируемый файл не содержит корректный JSON-объект." }]
    };
  }

  const project = input as SerialMapProjectDraft;
  const diagnostics: SerialMapDiagnostic[] = [];

  if (project.version !== 1) {
    diagnostics.push({ level: "error", message: "Поддерживается только версия проекта 1." });
  }
  if (!Array.isArray(project.schemes) || project.schemes.length === 0) {
    diagnostics.push({ level: "error", message: "В проекте нет ни одного контура." });
  }

  project.schemes?.forEach((scheme) => {
    if (!scheme.id || !scheme.name) {
      diagnostics.push({ level: "error", message: "У контура отсутствует id или имя." });
    }
    diagnostics.push(...computeDiagnostics(scheme));
  });

  return {
    project: diagnostics.some((item) => item.level === "error") ? null : project,
    diagnostics
  };
}

export function autoLayoutScheme(scheme: SerialMapScheme): SerialMapScheme {
  const groups: Record<string, SerialMapNode[]> = {
    master: [],
    bus: [],
    gateway: [],
    repeater: [],
    equipment: [],
    slave: [],
    sensor: []
  };

  scheme.nodes.forEach((node) => {
    groups[node.kind].push(node);
  });

  const layoutRows: SerialMapNodeKind[] = ["master", "bus", "gateway", "repeater", "equipment", "slave", "sensor"];
  const nextNodes = scheme.nodes.map((node) => ({ ...node }));
  const rowGap = 130;
  const colGap = 220;

  layoutRows.forEach((kind, rowIndex) => {
    const rowNodes = groups[kind];
    rowNodes.forEach((node, index) => {
      const target = nextNodes.find((item) => item.id === node.id);
      if (!target) {
        return;
      }
      target.position = {
        x: 80 + index * colGap + (kind === "bus" ? 60 : 0),
        y: 80 + rowIndex * rowGap
      };
    });
  });

  return {
    ...scheme,
    nodes: nextNodes
  };
}
