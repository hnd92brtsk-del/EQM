import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box } from "@mui/material";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type OnMove,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import { EDGE_STYLES } from "../../constants/pidPalette";
import type { PidDiagram, PidEdge, PidNode, PidSourceRef } from "../../types/pid";
import { PidNodeRenderer } from "./nodes/PidNodeRenderer";
import { DND_MIME, type PidEditorMode, type PidNodeInsertPreset } from "./PidToolbox";

type Props = {
  diagram: PidDiagram;
  readOnly: boolean;
  showMiniMap: boolean;
  mode: PidEditorMode;
  edgeType: PidEdge["edgeType"];
  pendingPreset: PidNodeInsertPreset | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  onSelectionChange: (next: { nodeIds: string[]; edgeId: string | null }) => void;
  onPendingPresetConsumed: () => void;
  onRequestHistoryCheckpoint: () => void;
  onDiagramChange: (next: PidDiagram) => void;
};

export type PidCanvasHandle = {
  fitView: () => void;
  resetView: () => void;
  focusNode: (nodeId: string) => void;
  addPendingPresetAtViewportCenter: (preset?: PidNodeInsertPreset | null) => void;
};

const nodeTypes = {
  equipment: PidNodeRenderer,
  instrument: PidNodeRenderer,
  external: PidNodeRenderer,
};

const MAX_COORD = 20000;

const clampPosition = (position: { x: number; y: number }) => ({
  x: Math.max(0, Math.min(MAX_COORD, position.x)),
  y: Math.max(0, Math.min(MAX_COORD, position.y)),
});

function toRfNode(node: PidNode, selectedNodeIds: string[]): Node {
  const shapeKey =
    (node.properties.meta && typeof node.properties.meta.shapeKey === "string" && node.properties.meta.shapeKey) ||
    node.sourceRef?.meta?.shapeKey ||
    "generic";
  return {
    id: node.id,
    type: node.type,
    position: clampPosition(node.position),
    selected: selectedNodeIds.includes(node.id),
    data: {
      label: node.label,
      tag: node.tag,
      symbolKey: node.symbolKey,
      shapeKey,
      category: node.category,
    },
  };
}

function toRfEdge(edge: PidEdge, selectedEdgeId: string | null): Edge {
  const style = EDGE_STYLES[edge.edgeType];
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    selected: selectedEdgeId === edge.id,
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

export const PidCanvas = forwardRef<PidCanvasHandle, Props>(function PidCanvas(
  {
    diagram,
    readOnly,
    showMiniMap,
    mode,
    edgeType,
    pendingPreset,
    selectedNodeIds,
    selectedEdgeId,
    onSelectionChange,
    onPendingPresetConsumed,
    onRequestHistoryCheckpoint,
    onDiagramChange,
  },
  ref
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const pendingDragCheckpointRef = useRef(false);

  const [nodes, setNodes] = useState<Node[]>(() => diagram.nodes.map((node) => toRfNode(node, selectedNodeIds)));
  const [edges, setEdges] = useState<Edge[]>(() => diagram.edges.map((edge) => toRfEdge(edge, selectedEdgeId)));

  useEffect(() => {
    setNodes(diagram.nodes.map((node) => toRfNode(node, selectedNodeIds)));
    setEdges(diagram.edges.map((edge) => toRfEdge(edge, selectedEdgeId)));
  }, [diagram, selectedNodeIds, selectedEdgeId]);

  useEffect(() => {
    if (!flowInstanceRef.current) return;
    flowInstanceRef.current.setViewport(diagram.viewport);
  }, [diagram.viewport]);

  const emitDiagram = (
    nextNodes: Node[],
    nextEdges: Edge[],
    nextViewport = diagram.viewport,
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
    if (readOnly) return;
    onRequestHistoryCheckpoint();
    const clamped = clampPosition(position);
    const id = `node_${Date.now()}`;
    const shapeKey = preset.sourceRef?.meta?.shapeKey || "generic";
    const newNode: Node = {
      id,
      type: preset.type,
      position: clamped,
      selected: true,
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
    onSelectionChange({ nodeIds: [id], edgeId: null });
    emitDiagram(nextNodes, edges, diagram.viewport, {
      [id]: { sourceRef: preset.sourceRef || null, properties: {} },
    });
    onPendingPresetConsumed();
  };

  const addPendingPresetAtViewportCenter = (presetOverride?: PidNodeInsertPreset | null) => {
    const effectivePreset = presetOverride || pendingPreset;
    if (!effectivePreset || !wrapperRef.current || !flowInstanceRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const position = flowInstanceRef.current.screenToFlowPosition(center);
    addNodeAtPosition(effectivePreset, position);
  };

  useImperativeHandle(
    ref,
    () => ({
      fitView() {
        flowInstanceRef.current?.fitView({ padding: 0.18, duration: 220 });
      },
      resetView() {
        flowInstanceRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
      },
      focusNode(nodeId: string) {
        const target = diagram.nodes.find((item) => item.id === nodeId);
        if (!target || !flowInstanceRef.current) return;
        flowInstanceRef.current.setCenter(target.position.x, target.position.y, { zoom: 1.25, duration: 220 });
      },
      addPendingPresetAtViewportCenter,
    }),
    [diagram.nodes, pendingPreset]
  );

  const onConnect = (connection: Connection) => {
    if (readOnly || mode !== "add-edge") return;
    onRequestHistoryCheckpoint();
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

  const onNodeClick: NodeMouseHandler = (event, node) => {
    if (mode === "delete" && !readOnly) {
      onRequestHistoryCheckpoint();
      const nextNodes = nodes.filter((item) => item.id !== node.id);
      const nextEdges = edges.filter((item) => item.source !== node.id && item.target !== node.id);
      setNodes(nextNodes);
      setEdges(nextEdges);
      onSelectionChange({ nodeIds: [], edgeId: null });
      emitDiagram(nextNodes, nextEdges);
      return;
    }
    if (event.shiftKey) {
      const nextNodeIds = selectedNodeIds.includes(node.id)
        ? selectedNodeIds.filter((item) => item !== node.id)
        : [...selectedNodeIds, node.id];
      onSelectionChange({ nodeIds: nextNodeIds, edgeId: null });
      return;
    }
    onSelectionChange({ nodeIds: [node.id], edgeId: null });
  };

  const onEdgeClick: EdgeMouseHandler = (_event, edge) => {
    if (mode === "delete" && !readOnly) {
      onRequestHistoryCheckpoint();
      const nextEdges = edges.filter((item) => item.id !== edge.id);
      setEdges(nextEdges);
      onSelectionChange({ nodeIds: [], edgeId: null });
      emitDiagram(nodes, nextEdges);
      return;
    }
    onSelectionChange({ nodeIds: [], edgeId: edge.id });
  };

  const onMoveEnd: OnMove = (_event, viewport) => {
    emitDiagram(nodes, edges, { ...viewport, x: Math.max(0, viewport.x), y: Math.max(0, viewport.y) });
  };

  const selectedElements = useMemo(
    () => ({
      nodes: diagram.nodes.filter((item) => selectedNodeIds.includes(item.id)),
      edge: selectedEdgeId ? diagram.edges.find((item) => item.id === selectedEdgeId) || null : null,
    }),
    [diagram.edges, diagram.nodes, selectedEdgeId, selectedNodeIds]
  );

  return (
    <Box
      ref={wrapperRef}
      sx={{
        height: "100%",
        minHeight: 620,
        minWidth: 0,
        position: "relative",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <ReactFlow
        key={`pid-rf-${diagram.processId}`}
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          const next = applyNodeChanges(changes, nodes).map((item) => ({
            ...item,
            position: clampPosition(item.position),
          }));
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
        onNodeDragStart={() => {
          if (!pendingDragCheckpointRef.current) {
            onRequestHistoryCheckpoint();
            pendingDragCheckpointRef.current = true;
          }
        }}
        onNodeDragStop={() => {
          pendingDragCheckpointRef.current = false;
        }}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => onSelectionChange({ nodeIds: [], edgeId: null })}
        onSelectionChange={(params: OnSelectionChangeParams) => {
          const nextNodeIds = (params.nodes || []).map((item) => item.id);
          const nextEdges = params.edges || [];
          onSelectionChange({
            nodeIds: nextNodeIds,
            edgeId: nextEdges.length === 1 && nextNodeIds.length === 0 ? nextEdges[0].id : null,
          });
        }}
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
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        selectionOnDrag={mode === "select"}
        panOnDrag={mode === "pan"}
        nodesFocusable
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
        defaultViewport={diagram.viewport}
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
        {showMiniMap ? (
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => (selectedNodeIds.includes(node.id) ? "#2563eb" : "#cbd5e1")}
            nodeStrokeColor={() => "#475569"}
            style={{ backgroundColor: "rgba(255,255,255,0.96)", border: "1px solid #e2e8f0" }}
          />
        ) : null}
        <Controls showInteractive={false} />
        <Background />
      </ReactFlow>
      {mode === "add-edge" && selectedElements.nodes.length === 1 && !selectedElements.edge ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
          Выберите второй узел, чтобы создать связь типа "{EDGE_STYLES[edgeType] ? edgeType : "process"}".
        </div>
      ) : null}
    </Box>
  );
});
