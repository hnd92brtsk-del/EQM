import type { PidDiagram } from "../../types/pid";

export type PidSidebarState = "no-location" | "loading" | "error" | "empty" | "ready";
export type PidCanvasState =
  | "no-location"
  | "loading-processes"
  | "processes-error"
  | "empty"
  | "idle"
  | "loading-diagram"
  | "diagram-error"
  | "ready";

export function getDiagramContentFingerprint(value: PidDiagram): string {
  return JSON.stringify({
    processId: value.processId,
    nodes: value.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      category: node.category,
      symbolKey: node.symbolKey,
      label: node.label,
      tag: node.tag,
      position: {
        x: Math.round(node.position.x * 1000) / 1000,
        y: Math.round(node.position.y * 1000) / 1000,
      },
      sourceRef: node.sourceRef || null,
      properties: node.properties || {},
    })),
    edges: value.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      edgeType: edge.edgeType,
      label: edge.label,
      style: edge.style || {},
    })),
  });
}

export function resolveSidebarState(params: {
  locationId: number | "";
  isLoading: boolean;
  hasError: boolean;
  processCount: number;
}): PidSidebarState {
  if (!params.locationId) return "no-location";
  if (params.isLoading) return "loading";
  if (params.hasError) return "error";
  if (params.processCount === 0) return "empty";
  return "ready";
}

export function resolveCanvasState(params: {
  locationId: number | "";
  processesLoading: boolean;
  processesError: boolean;
  processCount: number;
  activeProcessId: number | null;
  hasMatchingDiagram: boolean;
  diagramLoading: boolean;
  diagramError: boolean;
}): PidCanvasState {
  if (!params.locationId) return "no-location";
  if (params.processesLoading && params.processCount === 0) return "loading-processes";
  if (params.processesError && params.processCount === 0) return "processes-error";
  if (params.processCount === 0) return "empty";
  if (params.activeProcessId === null) return "idle";
  if (params.diagramError) return "diagram-error";
  if (params.diagramLoading || !params.hasMatchingDiagram) return "loading-diagram";
  return "ready";
}

export function shouldConfirmContextSwitch(params: {
  hasUnsavedChanges: boolean;
  activeProcessId: number | null;
  nextProcessId?: number | null;
  locationChanged?: boolean;
}): boolean {
  if (!params.hasUnsavedChanges || params.activeProcessId === null) return false;
  if (params.locationChanged) return true;
  return params.nextProcessId !== undefined && params.nextProcessId !== params.activeProcessId;
}
