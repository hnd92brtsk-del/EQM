import {
  forwardRef,
  useCallback,
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
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type OnMove,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import { EDGE_STYLES, getPidNodeVisualSpec, inferMainEquipmentShapeKey } from "../../constants/pidPalette";
import { normalizePidSymbol } from "../../features/pid/symbols";
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
  onViewportChange?: (viewport: PidDiagram["viewport"]) => void;
  onInteractionMessage?: (message: { tone: "info" | "warning"; text: string } | null) => void;
};

export type PidCanvasHandle = {
  fitView: () => void;
  resetView: () => void;
  focusNode: (nodeId: string) => void;
  addPendingPresetAtViewportCenter: (preset?: PidNodeInsertPreset | null) => void;
  cancelPendingConnection: () => void;
};

type HandleId = "top" | "right" | "bottom" | "left";

type NodeData = {
  label: string;
  tag: string;
  symbolKey: string;
  shapeKey?: string;
  pidSymbol?: ReturnType<typeof normalizePidSymbol> | null;
  category: "main" | "instrument" | "external";
  visual: { width: number; height: number; labelWidth: number };
};

type CanvasNode = Node<NodeData>;
type CanvasEdge = Edge<{ edgeType: PidEdge["edgeType"] }>;

const nodeTypes = {
  equipment: PidNodeRenderer,
  instrument: PidNodeRenderer,
  external: PidNodeRenderer,
};

const MAX_COORD = 20000;
const MIN_COORD = -MAX_COORD;

const clampPosition = (position: { x: number; y: number }) => ({
  x: Math.max(MIN_COORD, Math.min(MAX_COORD, position.x)),
  y: Math.max(MIN_COORD, Math.min(MAX_COORD, position.y)),
});

function buildSourceLookup(
  diagram: PidDiagram,
  sourceOverrides?: Record<string, { sourceRef?: PidSourceRef | null; properties?: PidNode["properties"] }>
) {
  const sourceLookup = new Map(
    diagram.nodes.map((item) => [item.id, { sourceRef: item.sourceRef || null, properties: item.properties || {} }])
  );
  if (!sourceOverrides) return sourceLookup;
  Object.entries(sourceOverrides).forEach(([id, value]) => {
    sourceLookup.set(id, {
      sourceRef: value.sourceRef || null,
      properties: value.properties || {},
    });
  });
  return sourceLookup;
}

function getShapeKey(node: Pick<PidNode, "sourceRef" | "properties">) {
  const ownShapeKey = node.properties.meta?.shapeKey;
  if (typeof ownShapeKey === "string" && ownShapeKey.trim()) {
    return ownShapeKey === "generic" && typeof node.sourceRef?.name === "string"
      ? inferMainEquipmentShapeKey(node.sourceRef.name)
      : ownShapeKey;
  }
  const sourceShapeKey = node.sourceRef?.meta?.shapeKey;
  if (typeof sourceShapeKey === "string" && sourceShapeKey.trim()) {
    return sourceShapeKey === "generic" && typeof node.sourceRef?.name === "string"
      ? inferMainEquipmentShapeKey(node.sourceRef.name)
      : sourceShapeKey;
  }
  if (typeof node.sourceRef?.name === "string" && node.sourceRef.name.trim()) {
    return inferMainEquipmentShapeKey(node.sourceRef.name);
  }
  return "generic";
}

function toRfNode(node: PidNode, selectedNodeIds: string[]): CanvasNode {
  const pidSymbol = normalizePidSymbol(node.properties.meta || node.sourceRef?.meta || null, getShapeKey(node));
  const visual = getPidNodeVisualSpec(node.category, pidSymbol.libraryKey || getShapeKey(node));

  return {
    id: node.id,
    type: node.type,
    position: clampPosition(node.position),
    selected: selectedNodeIds.includes(node.id),
    data: {
      label: node.label,
      tag: node.tag,
      symbolKey: node.symbolKey,
      shapeKey: pidSymbol.libraryKey || "generic",
      pidSymbol,
      category: node.category,
      visual,
    },
  };
}

function getNodeCenter(node: CanvasNode) {
  return {
    x: node.position.x + node.data.visual.width / 2,
    y: node.position.y + node.data.visual.height / 2,
  };
}

function inferHandlePair(sourceNode: CanvasNode, targetNode: CanvasNode): { sourceHandle: HandleId; targetHandle: HandleId } {
  const sourceCenter = getNodeCenter(sourceNode);
  const targetCenter = getNodeCenter(targetNode);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "right", targetHandle: "left" }
      : { sourceHandle: "left", targetHandle: "right" };
  }

  return dy >= 0
    ? { sourceHandle: "bottom", targetHandle: "top" }
    : { sourceHandle: "top", targetHandle: "bottom" };
}

function toRfEdge(edge: PidEdge, selectedEdgeId: string | null, nodeMap: Map<string, CanvasNode>): CanvasEdge {
  const style = EDGE_STYLES[edge.edgeType];
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);
  const handles =
    sourceNode && targetNode
      ? inferHandlePair(sourceNode, targetNode)
      : { sourceHandle: "right" as HandleId, targetHandle: "left" as HandleId };
  const showArrow = edge.edgeType === "process" || edge.edgeType === "control";

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: handles.sourceHandle,
    targetHandle: handles.targetHandle,
    label: edge.label,
    selected: selectedEdgeId === edge.id,
    data: { edgeType: edge.edgeType },
    style: { stroke: style.stroke, strokeDasharray: style.strokeDasharray, strokeWidth: edge.edgeType === "process" ? 2.6 : 1.8 },
    animated: style.animated,
    markerEnd: showArrow ? { type: MarkerType.ArrowClosed, color: style.stroke } : undefined,
  };
}

function syncEdgeHandles(nextNodes: CanvasNode[], nextEdges: CanvasEdge[], selectedEdgeId: string | null): CanvasEdge[] {
  const nodeMap = new Map(nextNodes.map((node) => [node.id, node]));
  return nextEdges.map((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return edge;
    const handles = inferHandlePair(sourceNode, targetNode);
    const edgeType = (edge.data?.edgeType || "process") as PidEdge["edgeType"];
    const style = EDGE_STYLES[edgeType];
    const showArrow = edgeType === "process" || edgeType === "control";
    return {
      ...edge,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      selected: selectedEdgeId === edge.id,
      style: { stroke: style.stroke, strokeDasharray: style.strokeDasharray, strokeWidth: edgeType === "process" ? 2.6 : 1.8 },
      animated: style.animated,
      markerEnd: showArrow ? { type: MarkerType.ArrowClosed, color: style.stroke } : undefined,
    };
  });
}

function buildRfState(diagram: PidDiagram, selectedNodeIds: string[], selectedEdgeId: string | null) {
  const rfNodes = diagram.nodes.map((node) => toRfNode(node, selectedNodeIds));
  const nodeMap = new Map(rfNodes.map((node) => [node.id, node]));
  const rfEdges = diagram.edges.map((edge) => toRfEdge(edge, selectedEdgeId, nodeMap));
  return { rfNodes, rfEdges };
}

function toPidEdges(nextEdges: CanvasEdge[]): PidEdge[] {
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
    onViewportChange,
    onInteractionMessage,
  },
  ref
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const pendingDragCheckpointRef = useRef(false);
  const lastDiagramSignatureRef = useRef("");

  const initialState = useMemo(() => buildRfState(diagram, selectedNodeIds, selectedEdgeId), []);
  const [nodes, setNodes] = useState<CanvasNode[]>(initialState.rfNodes);
  const [edges, setEdges] = useState<CanvasEdge[]>(initialState.rfEdges);
  const [pendingConnectionNodeId, setPendingConnectionNodeId] = useState<string | null>(null);

  const nodesRef = useRef<CanvasNode[]>(initialState.rfNodes);
  const edgesRef = useRef<CanvasEdge[]>(initialState.rfEdges);

  const setCanvasNodes = useCallback((nextNodes: CanvasNode[]) => {
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
  }, []);

  const setCanvasEdges = useCallback((nextEdges: CanvasEdge[]) => {
    edgesRef.current = nextEdges;
    setEdges(nextEdges);
  }, []);

  const syncSelectionState = useCallback(
    (nextNodes: CanvasNode[], nextEdges: CanvasEdge[]) => {
      const withSelectionNodes = nextNodes.map((node) => ({
        ...node,
        selected: selectedNodeIds.includes(node.id),
      }));
      const withSelectionEdges = nextEdges.map((edge) => ({
        ...edge,
        selected: selectedEdgeId === edge.id,
      }));
      setCanvasNodes(withSelectionNodes);
      setCanvasEdges(withSelectionEdges);
    },
    [selectedEdgeId, selectedNodeIds, setCanvasEdges, setCanvasNodes]
  );

  useEffect(() => {
    const signature = JSON.stringify({
      updatedAt: diagram.updatedAt,
      processId: diagram.processId,
      nodeIds: diagram.nodes.map((node) => `${node.id}:${node.position.x}:${node.position.y}:${node.label}:${node.tag}`),
      edgeIds: diagram.edges.map((edge) => `${edge.id}:${edge.source}:${edge.target}:${edge.edgeType}:${edge.label}`),
    });

    if (lastDiagramSignatureRef.current !== signature) {
      const nextState = buildRfState(diagram, selectedNodeIds, selectedEdgeId);
      lastDiagramSignatureRef.current = signature;
      setCanvasNodes(nextState.rfNodes);
      setCanvasEdges(nextState.rfEdges);
    } else {
      syncSelectionState(
        nodesRef.current.map((node) => ({ ...node })),
        syncEdgeHandles(nodesRef.current, edgesRef.current.map((edge) => ({ ...edge })), selectedEdgeId)
      );
    }
  }, [diagram, selectedEdgeId, selectedNodeIds, setCanvasEdges, setCanvasNodes, syncSelectionState]);

  useEffect(() => {
    if (!flowInstanceRef.current) return;
    const viewport = flowInstanceRef.current.getViewport();
    if (
      Math.abs(viewport.x - diagram.viewport.x) < 0.5 &&
      Math.abs(viewport.y - diagram.viewport.y) < 0.5 &&
      Math.abs(viewport.zoom - diagram.viewport.zoom) < 0.001
    ) {
      return;
    }
    flowInstanceRef.current.setViewport(diagram.viewport, { duration: 120 });
  }, [diagram.viewport]);

  useEffect(() => {
    if (mode === "add-edge") return;
    setPendingConnectionNodeId(null);
  }, [mode]);

  useEffect(() => {
    if (!pendingConnectionNodeId) return;
    if (nodesRef.current.some((node) => node.id === pendingConnectionNodeId)) return;
    setPendingConnectionNodeId(null);
  }, [nodes, pendingConnectionNodeId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || mode !== "add-edge") return;
      setPendingConnectionNodeId((current) => {
        if (!current) return current;
        onInteractionMessage?.({ tone: "info", text: "Режим связи отменён." });
        onSelectionChange({ nodeIds: [], edgeId: null });
        return null;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, onInteractionMessage, onSelectionChange]);

  const emitDiagram = useCallback(
    (
      nextNodes: CanvasNode[],
      nextEdges: CanvasEdge[],
      nextViewport = diagram.viewport,
      sourceOverrides?: Record<string, { sourceRef?: PidSourceRef | null; properties?: PidNode["properties"] }>
    ) => {
      const sourceLookup = buildSourceLookup(diagram, sourceOverrides);
      const pidNodes: PidNode[] = nextNodes.map((item) => {
        const source = sourceLookup.get(item.id) || { sourceRef: null, properties: {} };
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
        viewport: nextViewport,
        updatedAt: new Date().toISOString(),
      });
    },
    [diagram, onDiagramChange]
  );

  const commitLocalState = useCallback(
    (sourceOverrides?: Record<string, { sourceRef?: PidSourceRef | null; properties?: PidNode["properties"] }>) => {
      const viewport = flowInstanceRef.current?.getViewport() || diagram.viewport;
      emitDiagram(nodesRef.current, edgesRef.current, viewport, sourceOverrides);
    },
    [diagram.viewport, emitDiagram]
  );

  const addNodeAtPosition = useCallback(
    (preset: PidNodeInsertPreset, position: { x: number; y: number }) => {
      if (readOnly) return;
      onRequestHistoryCheckpoint();

      const pidSymbol = normalizePidSymbol(
        preset.sourceRef?.meta || null,
        preset.sourceRef?.meta?.shapeKey || (preset.category === "instrument" ? preset.symbolKey : "generic")
      );
      const visual = getPidNodeVisualSpec(preset.category, pidSymbol.libraryKey || "generic");
      const id = `node_${Date.now()}`;
      const newNode: CanvasNode = {
        id,
        type: preset.type,
        position: clampPosition({
          x: position.x - visual.width / 2,
          y: position.y - visual.height / 2,
        }),
        selected: true,
        data: {
          label: preset.label,
          tag: "",
          symbolKey: preset.symbolKey,
          shapeKey: pidSymbol.libraryKey || "generic",
          pidSymbol,
          category: preset.category,
          visual,
        },
      };

      const nextNodes = [...nodesRef.current, newNode];
      const nextEdges = syncEdgeHandles(nextNodes, edgesRef.current, null);
      setCanvasNodes(nextNodes);
      setCanvasEdges(nextEdges);
      onSelectionChange({ nodeIds: [id], edgeId: null });
      emitDiagram(nextNodes, nextEdges, flowInstanceRef.current?.getViewport() || diagram.viewport, {
        [id]: { sourceRef: preset.sourceRef || null, properties: {} },
      });
      onPendingPresetConsumed();
    },
    [
      diagram.viewport,
      emitDiagram,
      onPendingPresetConsumed,
      onRequestHistoryCheckpoint,
      onSelectionChange,
      readOnly,
      setCanvasEdges,
      setCanvasNodes,
    ]
  );

  const addPendingPresetAtViewportCenter = useCallback(
    (presetOverride?: PidNodeInsertPreset | null) => {
      const effectivePreset = presetOverride || pendingPreset;
      if (!effectivePreset || !wrapperRef.current || !flowInstanceRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const position = flowInstanceRef.current.screenToFlowPosition(center);
      addNodeAtPosition(effectivePreset, position);
    },
    [addNodeAtPosition, pendingPreset]
  );

  const cancelPendingConnection = useCallback(() => {
    setPendingConnectionNodeId(null);
    onSelectionChange({ nodeIds: [], edgeId: null });
  }, [onSelectionChange]);

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
        const target = nodesRef.current.find((item) => item.id === nodeId);
        if (!target || !flowInstanceRef.current) return;
        const center = getNodeCenter(target);
        flowInstanceRef.current.setCenter(center.x, center.y, { zoom: 1.2, duration: 220 });
      },
      addPendingPresetAtViewportCenter,
      cancelPendingConnection,
    }),
    [addPendingPresetAtViewportCenter, cancelPendingConnection]
  );

  const createEdgeBetween = useCallback(
    (sourceId: string, targetId: string) => {
      if (readOnly) return;
      if (sourceId === targetId) {
        onInteractionMessage?.({ tone: "warning", text: "Нельзя связать узел с самим собой." });
        return;
      }

      const duplicate = edgesRef.current.some(
        (edge) => edge.source === sourceId && edge.target === targetId && (edge.data?.edgeType || "process") === edgeType
      );
      if (duplicate) {
        onInteractionMessage?.({ tone: "warning", text: "Такая связь уже существует." });
        return;
      }

      onRequestHistoryCheckpoint();
      const style = EDGE_STYLES[edgeType];
      const showArrow = edgeType === "process" || edgeType === "control";
      const nodeMap = new Map(nodesRef.current.map((node) => [node.id, node]));
      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);
      const handles =
        sourceNode && targetNode
          ? inferHandlePair(sourceNode, targetNode)
          : { sourceHandle: "right" as HandleId, targetHandle: "left" as HandleId };

      const newEdge: CanvasEdge = {
        id: `edge_${Date.now()}`,
        source: sourceId,
        target: targetId,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        label: "",
        data: { edgeType },
        style: { stroke: style.stroke, strokeDasharray: style.strokeDasharray, strokeWidth: edgeType === "process" ? 2.6 : 1.8 },
        animated: style.animated,
        markerEnd: showArrow ? { type: MarkerType.ArrowClosed, color: style.stroke } : undefined,
      };

      const nextEdges = syncEdgeHandles(nodesRef.current, [...edgesRef.current, newEdge], newEdge.id);
      setCanvasEdges(nextEdges);
      onSelectionChange({ nodeIds: [], edgeId: newEdge.id });
      setPendingConnectionNodeId(null);
      emitDiagram(nodesRef.current, nextEdges, flowInstanceRef.current?.getViewport() || diagram.viewport);
      onInteractionMessage?.({ tone: "info", text: "Связь создана." });
    },
    [
      diagram.viewport,
      edgeType,
      emitDiagram,
      onInteractionMessage,
      onRequestHistoryCheckpoint,
      onSelectionChange,
      readOnly,
      setCanvasEdges,
    ]
  );

  const onNodeClick: NodeMouseHandler = (event, node) => {
    if (mode === "delete" && !readOnly) {
      onRequestHistoryCheckpoint();
      const nextNodes = nodesRef.current.filter((item) => item.id !== node.id);
      const nextEdges = edgesRef.current.filter((item) => item.source !== node.id && item.target !== node.id);
      setCanvasNodes(nextNodes);
      setCanvasEdges(nextEdges);
      onSelectionChange({ nodeIds: [], edgeId: null });
      emitDiagram(nextNodes, nextEdges, flowInstanceRef.current?.getViewport() || diagram.viewport);
      setPendingConnectionNodeId(null);
      return;
    }

    if (mode === "add-edge" && !readOnly) {
      if (!pendingConnectionNodeId) {
        setPendingConnectionNodeId(node.id);
        onSelectionChange({ nodeIds: [node.id], edgeId: null });
        onInteractionMessage?.({ tone: "info", text: `Источник связи выбран. Теперь выберите второй узел.` });
        return;
      }
      createEdgeBetween(pendingConnectionNodeId, node.id);
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
      const nextEdges = edgesRef.current.filter((item) => item.id !== edge.id);
      setCanvasEdges(nextEdges);
      onSelectionChange({ nodeIds: [], edgeId: null });
      emitDiagram(nodesRef.current, nextEdges, flowInstanceRef.current?.getViewport() || diagram.viewport);
      return;
    }
    onSelectionChange({ nodeIds: [], edgeId: edge.id });
  };

  const onMoveEnd: OnMove = (_event, viewport) => {
    onViewportChange?.(viewport);
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
          const nextNodes = applyNodeChanges(changes, nodesRef.current).map((item) => ({
            ...item,
            position: clampPosition(item.position),
          })) as CanvasNode[];
          setCanvasNodes(nextNodes);
          setCanvasEdges(syncEdgeHandles(nextNodes, edgesRef.current, selectedEdgeId));
        }}
        onEdgesChange={(changes) => {
          const nextEdges = applyEdgeChanges(changes, edgesRef.current) as CanvasEdge[];
          setCanvasEdges(syncEdgeHandles(nodesRef.current, nextEdges, selectedEdgeId));
          emitDiagram(nodesRef.current, syncEdgeHandles(nodesRef.current, nextEdges, selectedEdgeId), flowInstanceRef.current?.getViewport() || diagram.viewport);
        }}
        onNodeClick={onNodeClick}
        onNodeDragStart={() => {
          if (!pendingDragCheckpointRef.current) {
            onRequestHistoryCheckpoint();
            pendingDragCheckpointRef.current = true;
          }
        }}
        onNodeDragStop={() => {
          pendingDragCheckpointRef.current = false;
          commitLocalState();
        }}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => {
          onSelectionChange({ nodeIds: [], edgeId: null });
          if (mode === "add-edge" && pendingConnectionNodeId) {
            setPendingConnectionNodeId(null);
            onInteractionMessage?.({ tone: "info", text: "Режим связи отменён." });
          }
        }}
        onSelectionChange={(params: OnSelectionChangeParams) => {
          if (mode !== "select") return;
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
        onMoveEnd={onMoveEnd}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        selectionOnDrag={mode === "select"}
        panOnDrag={mode === "pan"}
        nodesFocusable
        zoomOnScroll
        zoomOnPinch
        panOnScroll={false}
        zoomOnDoubleClick={false}
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
        minZoom={0.25}
        maxZoom={2.5}
        translateExtent={[
          [MIN_COORD, MIN_COORD],
          [MAX_COORD, MAX_COORD],
        ]}
        nodeExtent={[
          [MIN_COORD, MIN_COORD],
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
      {mode === "add-edge" ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
          {pendingConnectionNodeId
            ? `Выберите второй узел, чтобы создать связь типа "${EDGE_STYLES[edgeType] ? edgeType : "process"}".`
            : "Выберите первый узел, чтобы начать создание связи."}
        </div>
      ) : null}
      {mode === "add-edge" && selectedElements.edge ? (
        <div className="pointer-events-none absolute left-4 top-16 z-20 border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          Выбрана связь. Для новой связи кликните по двум узлам.
        </div>
      ) : null}
    </Box>
  );
});
