import { useEffect, useMemo, useRef, useState } from "react";
import { Box, FormControlLabel, Switch } from "@mui/material";
import { useTranslation } from "react-i18next";
import ReactFlow, {
  Background,
  Connection,
  Edge,
  EdgeMouseHandler,
  MarkerType,
  Node,
  NodeMouseHandler,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type OnMove,
} from "reactflow";
import "reactflow/dist/style.css";

import { EDGE_STYLES, MAIN_EQUIPMENT_SHAPE_BY_KEY } from "../../constants/pidPalette";
import type { PidDiagram, PidEdge, PidNode, PidSourceRef } from "../../types/pid";
import { PidNodeRenderer } from "./nodes/PidNodeRenderer";
import { PidPropertiesPanel } from "./PidPropertiesPanel";
import { DND_MIME, PidToolbox, type PidEditorMode, type PidNodeInsertPreset } from "./PidToolbox";
import { PidFloatingPanel, type FloatingRect } from "./PidFloatingPanel";

type Props = {
  diagram: PidDiagram;
  readOnly: boolean;
  focusNodeId: string | null;
  onDiagramChange: (next: PidDiagram) => void;
  locationPanel: React.ReactNode;
  inOperationOptions: { id: number; label: string; shapeKey?: string }[];
};

const nodeTypes = {
  equipment: PidNodeRenderer,
  instrument: PidNodeRenderer,
  external: PidNodeRenderer,
};

const MAX_COORD = 20000;
const LAYOUT_MODE_KEY = "pid.layout.mode.v1";
const FLOATING_RECTS_KEY = "pid.layout.floatingRects.v1";

const defaultRects: Record<"location" | "properties", FloatingRect> = {
  location: { x: 16, y: 54, width: 320, height: 460 },
  properties: { x: 1010, y: 54, width: 340, height: 460 },
};

const clampPosition = (position: { x: number; y: number }) => ({
  x: Math.max(0, Math.min(MAX_COORD, position.x)),
  y: Math.max(0, Math.min(MAX_COORD, position.y)),
});

function toRfNode(node: PidNode): Node {
  const shapeKey =
    (node.properties.meta && typeof node.properties.meta.shapeKey === "string" && node.properties.meta.shapeKey) ||
    node.sourceRef?.meta?.shapeKey ||
    MAIN_EQUIPMENT_SHAPE_BY_KEY[node.symbolKey] ||
    node.symbolKey;
  return {
    id: node.id,
    type: node.type,
    position: clampPosition(node.position),
    data: {
      label: node.label,
      tag: node.tag,
      symbolKey: node.symbolKey,
      shapeKey,
      category: node.category,
    },
  };
}

function toRfEdge(edge: PidEdge): Edge {
  const style = EDGE_STYLES[edge.edgeType];
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: { edgeType: edge.edgeType },
    style: { stroke: style.stroke, strokeDasharray: style.strokeDasharray },
    animated: style.animated,
    markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke },
  };
}

function toPidEdges(nextEdges: Edge[]): PidEdge[] {
  return nextEdges.map((item) => ({
    id: item.id,
    source: item.source,
    target: item.target,
    edgeType: (item.data?.edgeType || "process") as PidEdge["edgeType"],
    label: typeof item.label === "string" ? item.label : "",
    style: (item.style as Record<string, string | number> | undefined) || {},
  }));
}

export function PidEditor({
  diagram,
  readOnly,
  focusNodeId,
  onDiagramChange,
  locationPanel,
  inOperationOptions,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<PidEditorMode>("select");
  const [edgeType, setEdgeType] = useState<"process" | "signal" | "control" | "electric">("process");
  const [pendingPreset, setPendingPreset] = useState<PidNodeInsertPreset | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({
    ...diagram.viewport,
    x: Math.max(0, diagram.viewport.x),
    y: Math.max(0, diagram.viewport.y),
  });
  const [layoutMode, setLayoutMode] = useState<"docked" | "floating">(() => {
    const raw = localStorage.getItem(LAYOUT_MODE_KEY);
    return raw === "docked" ? "docked" : "floating";
  });
  const [floatingRects, setFloatingRects] = useState<Record<"location" | "properties", FloatingRect>>(() => {
    const raw = localStorage.getItem(FLOATING_RECTS_KEY);
    if (!raw) return defaultRects;
    try {
      const parsed = JSON.parse(raw) as Record<"location" | "properties", FloatingRect>;
      return {
        location: parsed.location || defaultRects.location,
        properties: parsed.properties || defaultRects.properties,
      };
    } catch {
      return defaultRects;
    }
  });
  const [panelStack, setPanelStack] = useState<Record<"location" | "properties", number>>({
    location: 10,
    properties: 11,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowInstanceRef = useRef<any>(null);
  const [nodes, setNodes] = useState<Node[]>(diagram.nodes.map(toRfNode));
  const [edges, setEdges] = useState<Edge[]>(diagram.edges.map(toRfEdge));

  useEffect(() => {
    localStorage.setItem(LAYOUT_MODE_KEY, layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    localStorage.setItem(FLOATING_RECTS_KEY, JSON.stringify(floatingRects));
  }, [floatingRects]);

  useEffect(() => {
    setNodes(diagram.nodes.map(toRfNode));
    setEdges(diagram.edges.map(toRfEdge));
    setViewport({
      ...diagram.viewport,
      x: Math.max(0, diagram.viewport.x),
      y: Math.max(0, diagram.viewport.y),
    });
  }, [diagram]);

  useEffect(() => {
    if (!focusNodeId || !flowInstanceRef.current) return;
    const target = nodes.find((item) => item.id === focusNodeId);
    if (!target) return;
    setSelectedNodeId(target.id);
    setSelectedEdgeId(null);
    flowInstanceRef.current.setCenter(target.position.x, target.position.y, { zoom: 1.2, duration: 220 });
  }, [focusNodeId, nodes]);

  const emitDiagram = (
    nextNodes: Node[],
    nextEdges: Edge[],
    nextViewport = viewport,
    sourceOverrides?: Record<string, { sourceRef?: PidSourceRef | null; properties?: PidNode["properties"] }>
  ) => {
    const sourceLookup = new Map(
      diagram.nodes.map((item) => [item.id, { sourceRef: item.sourceRef || null, properties: item.properties || {} }])
    );
    const pidNodes: PidNode[] = nextNodes.map((item) => {
      const source = sourceOverrides?.[item.id] || sourceLookup.get(item.id) || { sourceRef: null, properties: {} };
      return {
        id: item.id,
        type: (item.type || "equipment") as PidNode["type"],
        category: item.data.category as PidNode["category"],
        symbolKey: String(item.data.symbolKey || ""),
        label: String(item.data.label || ""),
        tag: String(item.data.tag || ""),
        position: clampPosition(item.position),
        sourceRef: source.sourceRef || null,
        properties: source.properties || {},
      };
    });
    onDiagramChange({
      ...diagram,
      nodes: pidNodes,
      edges: toPidEdges(nextEdges),
      viewport: { ...nextViewport, x: Math.max(0, nextViewport.x), y: Math.max(0, nextViewport.y) },
      updatedAt: new Date().toISOString(),
    });
  };

  const addNodeAtPosition = (preset: PidNodeInsertPreset, position: { x: number; y: number }) => {
    const clamped = clampPosition(position);
    const id = `node_${Date.now()}`;
    const shapeKey = preset.sourceRef?.meta?.shapeKey || MAIN_EQUIPMENT_SHAPE_BY_KEY[preset.symbolKey] || preset.symbolKey;
    const newNode: Node = {
      id,
      type: preset.type,
      position: clamped,
      data: {
        label: preset.label,
        tag: "",
        symbolKey: preset.symbolKey,
        shapeKey,
        category: preset.category,
      },
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    emitDiagram(nextNodes, edges, viewport, {
      [id]: { sourceRef: preset.sourceRef || null, properties: {} },
    });
  };

  const addPendingPresetAtViewportCenter = () => {
    if (readOnly || mode !== "add-node" || !pendingPreset || !wrapperRef.current || !flowInstanceRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const pos = flowInstanceRef.current.screenToFlowPosition(center);
    addNodeAtPosition(pendingPreset, pos);
  };

  const onConnect = (connection: Connection) => {
    if (readOnly || mode !== "add-edge") return;
    const edgeData = EDGE_STYLES[edgeType];
    const nextEdges = addEdge(
      {
        ...connection,
        id: `edge_${Date.now()}`,
        data: { edgeType },
        label: "",
        style: { stroke: edgeData.stroke, strokeDasharray: edgeData.strokeDasharray },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeData.stroke },
        animated: edgeData.animated,
      },
      edges
    );
    setEdges(nextEdges);
    emitDiagram(nodes, nextEdges);
  };

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    if (mode === "delete" && !readOnly) {
      const nextNodes = nodes.filter((item) => item.id !== node.id);
      const nextEdges = edges.filter((item) => item.source !== node.id && item.target !== node.id);
      setNodes(nextNodes);
      setEdges(nextEdges);
      emitDiagram(nextNodes, nextEdges);
      return;
    }
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  };

  const onEdgeClick: EdgeMouseHandler = (_event, edge) => {
    if (mode === "delete" && !readOnly) {
      const nextEdges = edges.filter((item) => item.id !== edge.id);
      setEdges(nextEdges);
      emitDiagram(nodes, nextEdges);
      return;
    }
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  };

  const onMoveEnd: OnMove = (_event, vp) => {
    const clamped = { ...vp, x: Math.max(0, vp.x), y: Math.max(0, vp.y) };
    setViewport(clamped);
    emitDiagram(nodes, edges, clamped);
  };

  const selectedNode = useMemo(
    () => diagram.nodes.find((item) => item.id === selectedNodeId) || null,
    [diagram.nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => diagram.edges.find((item) => item.id === selectedEdgeId) || null,
    [diagram.edges, selectedEdgeId]
  );

  return (
    <Box sx={{ display: "grid", gap: 1, minHeight: 620 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <FormControlLabel
          control={
            <Switch
              checked={layoutMode === "floating"}
              onChange={(_, checked) => setLayoutMode(checked ? "floating" : "docked")}
            />
          }
          label={t("pid.layout.floatingPanels")}
          sx={{ color: "text.primary", mr: 0 }}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns:
            layoutMode === "docked"
              ? {
                  xs: "1fr",
                  md: "minmax(280px, 320px) minmax(240px, 300px)",
                  lg: "minmax(280px, 320px) minmax(240px, 300px) minmax(0, 1fr)",
                  xl: "minmax(280px, 320px) minmax(240px, 300px) minmax(0, 1fr) minmax(280px, 340px)",
                }
              : { xs: "1fr", md: "minmax(240px, 300px) minmax(0, 1fr)" },
          minHeight: 620,
          position: "relative",
          gap: 1,
          minWidth: 0,
        }}
      >
        {layoutMode === "docked" ? (
          <Box sx={{ minHeight: 0, minWidth: 0, border: "1px solid", borderColor: "divider" }}>{locationPanel}</Box>
        ) : null}

        <Box sx={{ minHeight: 0, minWidth: 0, border: "1px solid", borderColor: "divider" }}>
          <PidToolbox
            mode={mode}
            onModeChange={setMode}
            edgeType={edgeType}
            onEdgeTypeChange={setEdgeType}
            onPresetPick={(preset) => {
              setPendingPreset(preset);
              setMode("add-node");
            }}
            inOperationOptions={inOperationOptions}
          />
        </Box>

        <Box
          ref={wrapperRef}
          sx={{ minHeight: 620, minWidth: 0, position: "relative", border: "1px solid", borderColor: "divider" }}
        >
          <ReactFlow
            key={`pid-rf-${diagram.processId}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => {
              const next = applyNodeChanges(changes, nodes).map((item) => ({ ...item, position: clampPosition(item.position) }));
              setNodes(next);
              emitDiagram(next, edges);
            }}
            onEdgesChange={(changes) => {
              const next = applyEdgeChanges(changes, edges);
              setEdges(next);
              emitDiagram(nodes, next);
            }}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onDoubleClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest(".react-flow__pane")) {
                addPendingPresetAtViewportCenter();
              }
            }}
            onConnect={onConnect}
            onMoveEnd={onMoveEnd}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable
            deleteKeyCode={null}
            onDragOver={(event) => {
              if (readOnly) return;
              if (event.dataTransfer.types.includes(DND_MIME)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(event) => {
              if (readOnly || !flowInstanceRef.current) return;
              const raw = event.dataTransfer.getData(DND_MIME);
              if (!raw) return;
              event.preventDefault();
              let preset: PidNodeInsertPreset;
              try {
                preset = JSON.parse(raw) as PidNodeInsertPreset;
              } catch {
                return;
              }
              const position = flowInstanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
              addNodeAtPosition(preset, position);
            }}
            defaultViewport={viewport}
            minZoom={0.35}
            maxZoom={2}
            translateExtent={[
              [0, 0],
              [MAX_COORD, MAX_COORD],
            ]}
            nodeExtent={[
              [0, 0],
              [MAX_COORD, MAX_COORD],
            ]}
            onInit={(instance) => {
              flowInstanceRef.current = instance;
            }}
          >
            <Background />
          </ReactFlow>

          {layoutMode === "floating" ? (
            <>
              <PidFloatingPanel
                id="pid-location-panel"
                title={t("pid.page.location")}
                rect={floatingRects.location}
                boundsRef={wrapperRef}
                zIndex={panelStack.location}
                onFocus={() => setPanelStack({ location: 30, properties: 29 })}
                onRectChange={(next) => setFloatingRects((prev) => ({ ...prev, location: next }))}
              >
                {locationPanel}
              </PidFloatingPanel>
              <PidFloatingPanel
                id="pid-properties-panel"
                title={t("pid.properties.title")}
                rect={floatingRects.properties}
                boundsRef={wrapperRef}
                zIndex={panelStack.properties}
                onFocus={() => setPanelStack({ location: 29, properties: 30 })}
                onRectChange={(next) => setFloatingRects((prev) => ({ ...prev, properties: next }))}
              >
                <PidPropertiesPanel
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  readOnly={readOnly}
                  title={t("pid.properties.title")}
                  bordered={false}
                  onNodeChange={(nextNode) => {
                    const nextDiagramNodes = diagram.nodes.map((item) => (item.id === nextNode.id ? nextNode : item));
                    const nextRfNodes = nodes.map((item) =>
                      item.id === nextNode.id ? { ...item, data: { ...item.data, label: nextNode.label, tag: nextNode.tag } } : item
                    );
                    setNodes(nextRfNodes);
                    onDiagramChange({ ...diagram, nodes: nextDiagramNodes, updatedAt: new Date().toISOString() });
                  }}
                  onEdgeChange={(nextEdge) => {
                    const nextDiagramEdges = diagram.edges.map((item) => (item.id === nextEdge.id ? nextEdge : item));
                    const nextRfEdges = edges.map((item) => (item.id === nextEdge.id ? { ...item, label: nextEdge.label } : item));
                    setEdges(nextRfEdges);
                    onDiagramChange({ ...diagram, edges: nextDiagramEdges, updatedAt: new Date().toISOString() });
                  }}
                />
              </PidFloatingPanel>
            </>
          ) : null}
        </Box>

        {layoutMode === "docked" ? (
          <Box sx={{ minWidth: 0 }}>
            <PidPropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              readOnly={readOnly}
              onNodeChange={(nextNode) => {
                const nextDiagramNodes = diagram.nodes.map((item) => (item.id === nextNode.id ? nextNode : item));
                const nextRfNodes = nodes.map((item) =>
                  item.id === nextNode.id ? { ...item, data: { ...item.data, label: nextNode.label, tag: nextNode.tag } } : item
                );
                setNodes(nextRfNodes);
                onDiagramChange({ ...diagram, nodes: nextDiagramNodes, updatedAt: new Date().toISOString() });
              }}
              onEdgeChange={(nextEdge) => {
                const nextDiagramEdges = diagram.edges.map((item) => (item.id === nextEdge.id ? nextEdge : item));
                const nextRfEdges = edges.map((item) => (item.id === nextEdge.id ? { ...item, label: nextEdge.label } : item));
                setEdges(nextRfEdges);
                onDiagramChange({ ...diagram, edges: nextDiagramEdges, updatedAt: new Date().toISOString() });
              }}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
