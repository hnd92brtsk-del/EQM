import type { PidDiagram, PidEdge, PidNode } from "../../types/pid";

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNode(value: unknown): value is PidNode {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.category === "string" &&
    typeof value.symbolKey === "string" &&
    typeof value.label === "string" &&
    typeof value.tag === "string" &&
    isObject(value.position) &&
    typeof value.position.x === "number" &&
    typeof value.position.y === "number" &&
    isObject(value.properties)
  );
}

function isEdge(value: unknown): value is PidEdge {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string" &&
    typeof value.edgeType === "string" &&
    typeof value.label === "string" &&
    (value.style === undefined || isObject(value.style))
  );
}

export function validatePidDiagramImport(value: unknown): PidDiagram {
  if (!isObject(value)) {
    throw new Error("JSON должен содержать объект диаграммы.");
  }
  if (typeof value.version !== "number") {
    throw new Error("В JSON отсутствует поле version.");
  }
  if (!isObject(value.viewport)) {
    throw new Error("В JSON отсутствует корректный viewport.");
  }
  if (
    typeof value.viewport.x !== "number" ||
    typeof value.viewport.y !== "number" ||
    typeof value.viewport.zoom !== "number"
  ) {
    throw new Error("Viewport диаграммы имеет неверный формат.");
  }
  if (!Array.isArray(value.nodes) || value.nodes.some((item) => !isNode(item))) {
    throw new Error("Список nodes в JSON имеет неверный формат.");
  }
  if (!Array.isArray(value.edges) || value.edges.some((item) => !isEdge(item))) {
    throw new Error("Список edges в JSON имеет неверный формат.");
  }

  return {
    processId: typeof value.processId === "number" ? value.processId : 0,
    version: 1,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    viewport: {
      x: value.viewport.x,
      y: value.viewport.y,
      zoom: value.viewport.zoom,
    },
    nodes: value.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      category: node.category,
      symbolKey: node.symbolKey,
      label: node.label,
      tag: node.tag,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      sourceRef: node.sourceRef ?? null,
      properties: node.properties,
    })),
    edges: value.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      edgeType: edge.edgeType,
      label: edge.label,
      style: edge.style || {},
    })),
  };
}

export function exportPidDiagramJson(diagram: PidDiagram) {
  return JSON.stringify(diagram, null, 2);
}

