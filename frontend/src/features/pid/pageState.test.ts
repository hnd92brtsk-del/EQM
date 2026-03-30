import { describe, expect, it } from "vitest";

import {
  getDiagramContentFingerprint,
  resolveCanvasState,
  resolveSidebarState,
  shouldConfirmContextSwitch,
} from "./pageState";
import type { PidDiagram } from "../../types/pid";

function makeDiagram(overrides: Partial<PidDiagram> = {}): PidDiagram {
  return {
    processId: 10,
    version: 1,
    updatedAt: "2026-03-30T10:00:00.000Z",
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: "n1",
        type: "equipment",
        category: "main",
        symbolKey: "pump_centrifugal",
        label: "Pump",
        tag: "P-1",
        position: { x: 10, y: 20 },
        properties: {},
      },
    ],
    edges: [],
    ...overrides,
  };
}

describe("pageState helpers", () => {
  it("returns no-location sidebar state before a location is selected", () => {
    expect(resolveSidebarState({ locationId: "", isLoading: false, hasError: false, processCount: 0 })).toBe("no-location");
  });

  it("returns processes-error canvas state when process loading failed", () => {
    expect(
      resolveCanvasState({
        locationId: 1,
        processesLoading: false,
        processesError: true,
        processCount: 0,
        activeProcessId: null,
        hasMatchingDiagram: false,
        diagramLoading: false,
        diagramError: false,
      })
    ).toBe("processes-error");
  });

  it("returns diagram-error canvas state when opening a process failed", () => {
    expect(
      resolveCanvasState({
        locationId: 1,
        processesLoading: false,
        processesError: false,
        processCount: 2,
        activeProcessId: 10,
        hasMatchingDiagram: false,
        diagramLoading: false,
        diagramError: true,
      })
    ).toBe("diagram-error");
  });

  it("asks for confirmation when switching context with unsaved changes", () => {
    expect(
      shouldConfirmContextSwitch({
        hasUnsavedChanges: true,
        activeProcessId: 10,
        nextProcessId: 11,
      })
    ).toBe(true);
    expect(
      shouldConfirmContextSwitch({
        hasUnsavedChanges: true,
        activeProcessId: 10,
        nextProcessId: 10,
      })
    ).toBe(false);
  });

  it("ignores viewport-only changes in the autosave fingerprint", () => {
    const base = makeDiagram();
    const viewportChanged = makeDiagram({ viewport: { x: 100, y: 200, zoom: 1.5 } });

    expect(getDiagramContentFingerprint(base)).toBe(getDiagramContentFingerprint(viewportChanged));
  });

  it("detects structural changes in the autosave fingerprint", () => {
    const base = makeDiagram();
    const changed = makeDiagram({
      nodes: [
        {
          ...base.nodes[0],
          label: "Pump updated",
        },
      ],
    });

    expect(getDiagramContentFingerprint(base)).not.toBe(getDiagramContentFingerprint(changed));
  });
});
