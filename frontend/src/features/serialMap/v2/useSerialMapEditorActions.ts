import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactFlowInstance } from "reactflow";

import {
  createSerialMapDocument,
  deleteSerialMapDocument,
  getSerialMapDocument,
  listSerialMapDocuments,
  listSerialMapEligibleEquipment,
  updateSerialMapDocument,
} from "../api";
import {
  computeConflicts,
  computeDiagnostics,
  createEmptyDataPoolEntry,
  createEmptyDocument,
  createEmptyGatewayMapping,
  mutateDocument,
  normalizeSerialMapDocument,
  snapshotOfDocument,
  validateImportedProject,
} from "../model";
import { clearSerialMapDraft, loadSerialMapDraft } from "../storage";
import type {
  SerialMapDataPoolEntry,
  SerialMapDocumentData,
  SerialMapEdge,
  SerialMapEligibleEquipment,
  SerialMapNode,
  SerialMapSaveStatus,
} from "../types";
import {
  buildEquipmentMap,
  createEdgeFromConnection,
  createManualSerialNode,
  downloadTextFile,
  exportSerialMapCsv,
  exportSerialMapXml,
} from "./utils";

type ToolMode = "select" | "connect" | "pan";

type Message = {
  tone: "info" | "warning";
  text: string;
} | null;

export function useSerialMapEditorActions({ readOnly }: { readOnly: boolean }) {
  const queryClient = useQueryClient();
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragSnapshotRef = useRef<SerialMapDocumentData | null>(null);
  const activeDocumentIdRef = useRef<number | null>(null);
  const documentRef = useRef<SerialMapDocumentData>(createEmptyDocument());
  const nameRef = useRef("Serial Protocol Map");
  const descriptionRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const hydratingRef = useRef(false);

  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);
  const [documentName, setDocumentName] = useState("Serial Protocol Map");
  const [documentDescription, setDocumentDescription] = useState("");
  const [document, setDocument] = useState<SerialMapDocumentData>(createEmptyDocument());
  const [saveStatus, setSaveStatus] = useState<SerialMapSaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [message, setMessage] = useState<Message>(null);
  const [clipboardNodes, setClipboardNodes] = useState<SerialMapNode[]>([]);
  const [recoveryDraft, setRecoveryDraft] = useState<SerialMapDocumentData | null>(() => {
    const raw = loadSerialMapDraft();
    return raw ? normalizeSerialMapDocument(raw) : null;
  });

  const documentsQuery = useQuery({
    queryKey: ["serial-map-documents", "v2"],
    queryFn: () => listSerialMapDocuments({ page: 1, page_size: 100, scope: "engineering" }),
  });
  const detailQuery = useQuery({
    queryKey: ["serial-map-document", activeDocumentId],
    queryFn: () => getSerialMapDocument(activeDocumentId as number),
    enabled: activeDocumentId !== null,
  });
  const equipmentQuery = useQuery({
    queryKey: ["serial-map-eligible-equipment"],
    queryFn: () => listSerialMapEligibleEquipment({}),
  });

  const allDocuments = documentsQuery.data?.items || [];
  const allEquipment = equipmentQuery.data || [];
  const equipmentMap = useMemo(() => buildEquipmentMap(allEquipment), [allEquipment]);
  const conflicts = useMemo(() => computeConflicts(document), [document]);
  const conflictedNodeIds = useMemo(() => new Set(conflicts.flatMap((item) => item.nodeIds)), [conflicts]);
  const diagnostics = useMemo(() => computeDiagnostics(document), [document]);
  const selectedNode = useMemo(
    () => (selectedNodeIds.length === 1 ? document.nodes.find((item) => item.id === selectedNodeIds[0]) || null : null),
    [document.nodes, selectedNodeIds],
  );
  const selectedEdge = useMemo(
    () => (selectedEdgeId ? document.edges.find((item) => item.id === selectedEdgeId) || null : null),
    [document.edges, selectedEdgeId],
  );

  const hasOpenCanvas = activeDocumentId !== null;

  const markDirty = useCallback(() => {
    if (hydratingRef.current) return;
    setHasUnsavedChanges(true);
    setSaveStatus("idle");
  }, []);

  const mutateCurrentDocument = useCallback(
    (
      mutate: (current: SerialMapDocumentData) => SerialMapDocumentData,
      options?: { recordHistory?: boolean; markAsDirty?: boolean },
    ) => {
      setDocument((current) => {
        const next = mutateDocument(current, mutate, { recordHistory: options?.recordHistory });
        documentRef.current = next;
        return next;
      });
      if (options?.markAsDirty !== false) {
        markDirty();
      }
    },
    [markDirty],
  );

  const saveCurrent = useCallback(async () => {
    if (readOnly || activeDocumentIdRef.current === null || !hasUnsavedChanges || saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setSaveStatus("saving");
    try {
      const updated = await updateSerialMapDocument(activeDocumentIdRef.current, {
        name: nameRef.current,
        description: descriptionRef.current || null,
        document: documentRef.current,
        scope: "engineering",
      });
      queryClient.setQueryData(["serial-map-document", activeDocumentIdRef.current], updated);
      await queryClient.invalidateQueries({ queryKey: ["serial-map-documents", "v2"] });
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
      setMessage({ tone: "warning", text: "Не удалось сохранить документ." });
    } finally {
      saveInFlightRef.current = false;
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        void saveCurrent();
      }
    }
  }, [hasUnsavedChanges, queryClient, readOnly]);

  const queueAutosave = useCallback(() => {
    if (readOnly || activeDocumentId === null || !hasUnsavedChanges) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      if (saveInFlightRef.current) {
        queuedSaveRef.current = true;
        return;
      }
      void saveCurrent();
    }, 900);
  }, [activeDocumentId, hasUnsavedChanges, readOnly, saveCurrent]);

  useEffect(() => {
    queueAutosave();
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [document, documentDescription, documentName, queueAutosave]);

  useEffect(() => {
    activeDocumentIdRef.current = activeDocumentId;
    documentRef.current = document;
    nameRef.current = documentName;
    descriptionRef.current = documentDescription;
  }, [activeDocumentId, document, documentDescription, documentName]);

  useEffect(() => {
    if (allDocuments.length === 0) {
      setSelectedDocumentId(null);
      setActiveDocumentId(null);
      return;
    }
    if (selectedDocumentId === null) {
      setSelectedDocumentId(allDocuments[0].id);
    } else if (!allDocuments.some((item) => item.id === selectedDocumentId)) {
      setSelectedDocumentId(allDocuments[0].id);
    }
    if (activeDocumentId !== null && !allDocuments.some((item) => item.id === activeDocumentId)) {
      setActiveDocumentId(null);
    }
  }, [activeDocumentId, allDocuments, selectedDocumentId]);

  useEffect(() => {
    if (!detailQuery.data) return;
    hydratingRef.current = true;
    const normalized = normalizeSerialMapDocument(detailQuery.data.document);
    setDocument(normalized);
    setDocumentName(detailQuery.data.name);
    setDocumentDescription(detailQuery.data.description || "");
    setSelectedDocumentId(detailQuery.data.id);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setToolMode("select");
    setHasUnsavedChanges(false);
    setSaveStatus("saved");
    documentRef.current = normalized;
    nameRef.current = detailQuery.data.name;
    descriptionRef.current = detailQuery.data.description || "";
    window.setTimeout(() => {
      hydratingRef.current = false;
    }, 0);
  }, [detailQuery.data]);

  const resolveInsertPosition = useCallback(() => {
    const instance = flowRef.current;
    const canvas = canvasRef.current;
    if (instance && canvas) {
      const rect = canvas.getBoundingClientRect();
      return instance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + Math.min(220, rect.height / 2),
      });
    }
    const index = documentRef.current.nodes.length;
    return {
      x: 120 + (index % 4) * 240,
      y: 120 + Math.floor(index / 4) * 150,
    };
  }, []);

  const setSelection = useCallback((nodeIds: string[], edgeId: string | null) => {
    setSelectedNodeIds(nodeIds);
    setSelectedEdgeId(edgeId);
  }, []);

  const registerFlowInstance = useCallback((instance: ReactFlowInstance | null) => {
    flowRef.current = instance;
  }, []);

  const registerCanvasElement = useCallback((element: HTMLDivElement | null) => {
    canvasRef.current = element;
  }, []);

  const openDocument = useCallback(
    async (documentId: number) => {
      if (activeDocumentIdRef.current === documentId) return;
      if (hasUnsavedChanges) {
        await saveCurrent();
      }
      setActiveDocumentId(documentId);
    },
    [hasUnsavedChanges, saveCurrent],
  );

  const createDocument = useCallback(
    async (payload?: { name?: string; description?: string | null; document?: SerialMapDocumentData }) => {
      try {
        const created = await createSerialMapDocument({
          name: payload?.name?.trim() || "Новая схема последовательных интерфейсов",
          description: payload?.description || null,
          scope: "engineering",
          document: payload?.document || createEmptyDocument(),
        });
        await queryClient.invalidateQueries({ queryKey: ["serial-map-documents", "v2"] });
        queryClient.setQueryData(["serial-map-document", created.id], created);
        setSelectedDocumentId(created.id);
        setActiveDocumentId(created.id);
        setMessage({ tone: "info", text: "Документ создан." });
      } catch {
        setMessage({ tone: "warning", text: "Не удалось создать документ." });
      }
    },
    [queryClient],
  );

  const deleteDocument = useCallback(
    async (documentId: number) => {
      try {
        await deleteSerialMapDocument(documentId);
        await queryClient.invalidateQueries({ queryKey: ["serial-map-documents", "v2"] });
        if (activeDocumentIdRef.current === documentId) {
          setActiveDocumentId(null);
          setDocument(createEmptyDocument());
          setDocumentName("Serial Protocol Map");
          setDocumentDescription("");
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
        }
        setMessage({ tone: "info", text: "Документ удален." });
      } catch {
        setMessage({ tone: "warning", text: "Не удалось удалить документ." });
      }
    },
    [queryClient],
  );

  const updateDocumentMetadata = useCallback(
    async (documentId: number, name: string, description: string) => {
      try {
        const updated = await updateSerialMapDocument(documentId, {
          name,
          description: description || null,
        });
        queryClient.setQueryData(["serial-map-document", documentId], updated);
        await queryClient.invalidateQueries({ queryKey: ["serial-map-documents", "v2"] });
        if (activeDocumentIdRef.current === documentId) {
          setDocumentName(updated.name);
          setDocumentDescription(updated.description || "");
        }
      } catch {
        setMessage({ tone: "warning", text: "Не удалось обновить метаданные." });
      }
    },
    [queryClient],
  );

  const updateSelectedNode = useCallback(
    (patch: Partial<SerialMapNode>) => {
      if (!selectedNode) return;
      mutateCurrentDocument((current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === selectedNode.id ? { ...node, ...patch } : node)),
      }));
    },
    [mutateCurrentDocument, selectedNode],
  );

  const updateSelectedEdge = useCallback(
    (patch: Partial<SerialMapEdge>) => {
      if (!selectedEdge) return;
      mutateCurrentDocument((current) => ({
        ...current,
        edges: current.edges.map((edge) => (edge.id === selectedEdge.id ? { ...edge, ...patch } : edge)),
      }));
    },
    [mutateCurrentDocument, selectedEdge],
  );

  const updateDataPoolEntry = useCallback(
    (entryId: string, patch: Partial<SerialMapDataPoolEntry>) => {
      if (!selectedNode) return;
      mutateCurrentDocument((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id !== selectedNode.id
            ? node
            : {
                ...node,
                dataPool: node.dataPool.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)),
              },
        ),
      }));
    },
    [mutateCurrentDocument, selectedNode],
  );

  const addDataPoolEntry = useCallback(() => {
    if (!selectedNode) return;
    mutateCurrentDocument((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id !== selectedNode.id
          ? node
          : {
              ...node,
              dataPool: [...node.dataPool, createEmptyDataPoolEntry(node.protocol)],
            },
      ),
    }));
  }, [mutateCurrentDocument, selectedNode]);

  const removeDataPoolEntry = useCallback(
    (entryId: string) => {
      if (!selectedNode) return;
      mutateCurrentDocument((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id !== selectedNode.id
            ? node
            : {
                ...node,
                dataPool: node.dataPool.filter((entry) => entry.id !== entryId),
              },
        ),
      }));
    },
    [mutateCurrentDocument, selectedNode],
  );

  const addGatewayMapping = useCallback(() => {
    if (!selectedNode || selectedNode.kind !== "gateway") return;
    mutateCurrentDocument((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id !== selectedNode.id
          ? node
          : {
              ...node,
              converterMappings: [...(node.converterMappings || []), createEmptyGatewayMapping()],
            },
      ),
    }));
  }, [mutateCurrentDocument, selectedNode]);

  const updateGatewayMapping = useCallback(
    (mappingId: string, patch: Record<string, string>) => {
      if (!selectedNode || selectedNode.kind !== "gateway") return;
      mutateCurrentDocument((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id !== selectedNode.id
            ? node
            : {
                ...node,
                converterMappings: (node.converterMappings || []).map((mapping) =>
                  mapping.id === mappingId ? { ...mapping, ...patch } : mapping,
                ),
              },
        ),
      }));
    },
    [mutateCurrentDocument, selectedNode],
  );

  const removeGatewayMapping = useCallback(
    (mappingId: string) => {
      if (!selectedNode || selectedNode.kind !== "gateway") return;
      mutateCurrentDocument((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id !== selectedNode.id
            ? node
            : {
                ...node,
                converterMappings: (node.converterMappings || []).filter((mapping) => mapping.id !== mappingId),
              },
        ),
      }));
    },
    [mutateCurrentDocument, selectedNode],
  );

  const copySelection = useCallback(() => {
    if (!selectedNodeIds.length) return;
    const nodes = documentRef.current.nodes.filter((node) => selectedNodeIds.includes(node.id));
    setClipboardNodes(nodes.map((node) => structuredClone(node)));
    setMessage({ tone: "info", text: "Выделение скопировано." });
  }, [selectedNodeIds]);

  const pasteSelection = useCallback(() => {
    if (!clipboardNodes.length) return;
    const pasteOffset = 32;
    const clones = clipboardNodes.map((node, index) => ({
      ...structuredClone(node),
      id: `node_${Math.random().toString(36).slice(2, 10)}`,
      position: {
        x: node.position.x + pasteOffset + index * 8,
        y: node.position.y + pasteOffset + index * 8,
      },
    }));
    mutateCurrentDocument((current) => ({
      ...current,
      nodes: [...current.nodes, ...clones],
    }));
    setSelectedNodeIds(clones.map((item) => item.id));
  }, [clipboardNodes, mutateCurrentDocument]);

  const duplicateSelection = useCallback(() => {
    copySelection();
    window.setTimeout(() => {
      pasteSelection();
    }, 0);
  }, [copySelection, pasteSelection]);

  const deleteSelection = useCallback(() => {
    if (!selectedNodeIds.length && !selectedEdgeId) return;
    mutateCurrentDocument((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => !selectedNodeIds.includes(node.id)),
      edges: current.edges.filter(
        (edge) =>
          edge.id !== selectedEdgeId &&
          !selectedNodeIds.includes(edge.fromNodeId) &&
          !selectedNodeIds.includes(edge.toNodeId),
      ),
    }));
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [mutateCurrentDocument, selectedEdgeId, selectedNodeIds]);

  const addPresetNode = useCallback(
    (kind: "master" | "slave" | "sensor" | "bus" | "repeater" | "gateway") => {
      const count = documentRef.current.nodes.filter((node) => node.kind === kind).length + 1;
      const nextNode = createManualSerialNode(kind, resolveInsertPosition(), count);
      mutateCurrentDocument((current) => ({
        ...current,
        nodes: [...current.nodes, nextNode],
      }));
      setSelectedNodeIds([nextNode.id]);
      setSelectedEdgeId(null);
    },
    [mutateCurrentDocument, resolveInsertPosition],
  );

  const addEquipmentNode = useCallback(
    async (item: SerialMapEligibleEquipment) => {
      const { createNodeFromEquipment } = await import("../model");
      const nextNode = createNodeFromEquipment(item, resolveInsertPosition());
      mutateCurrentDocument((current) => ({
        ...current,
        nodes: [...current.nodes, nextNode],
      }));
      setSelectedNodeIds([nextNode.id]);
      setSelectedEdgeId(null);
    },
    [mutateCurrentDocument, resolveInsertPosition],
  );

  const connectNodes = useCallback(
    (sourceId: string, targetId: string) => {
      const nextEdge = createEdgeFromConnection(
        { source: sourceId, target: targetId, sourceHandle: null, targetHandle: null },
        documentRef.current.nodes,
      );
      if (!nextEdge) {
        setMessage({ tone: "warning", text: "Нельзя создать такую связь." });
        return;
      }
      const exists = documentRef.current.edges.some(
        (edge) =>
          edge.fromNodeId === nextEdge.fromNodeId &&
          edge.toNodeId === nextEdge.toNodeId &&
          edge.protocol === nextEdge.protocol,
      );
      if (exists) {
        setMessage({ tone: "warning", text: "Такая связь уже существует." });
        return;
      }
      mutateCurrentDocument((current) => ({
        ...current,
        edges: [...current.edges, nextEdge],
      }));
      setSelectedEdgeId(nextEdge.id);
      setSelectedNodeIds([]);
    },
    [mutateCurrentDocument],
  );

  const syncNodePositions = useCallback(
    (positions: Record<string, { x: number; y: number }>, options?: { pushHistory?: boolean }) => {
      if (options?.pushHistory && dragSnapshotRef.current) {
        setDocument((current) => ({
          ...current,
          nodes: current.nodes.map((node) =>
            positions[node.id] ? { ...node, position: positions[node.id] } : node,
          ),
          history: {
            past: [...current.history.past, snapshotOfDocument(dragSnapshotRef.current!)].slice(-100),
            future: [],
          },
          updatedAt: new Date().toISOString(),
        }));
        dragSnapshotRef.current = null;
        markDirty();
        return;
      }

      mutateCurrentDocument(
        (current) => ({
          ...current,
          nodes: current.nodes.map((node) =>
            positions[node.id] ? { ...node, position: positions[node.id] } : node,
          ),
        }),
        { recordHistory: false },
      );
    },
    [markDirty, mutateCurrentDocument],
  );

  const beginNodeDrag = useCallback(() => {
    dragSnapshotRef.current = structuredClone(documentRef.current);
  }, []);

  const endNodeDrag = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      syncNodePositions(positions, { pushHistory: true });
    },
    [syncNodePositions],
  );

  const undo = useCallback(() => {
    setDocument((current) => {
      const previous = current.history.past[current.history.past.length - 1];
      if (!previous) return current;
      const next = {
        ...current,
        nodes: structuredClone(previous.nodes),
        edges: structuredClone(previous.edges),
        viewport: structuredClone(previous.viewport),
        history: {
          past: current.history.past.slice(0, -1),
          future: [snapshotOfDocument(current), ...current.history.future].slice(0, 100),
        },
        updatedAt: new Date().toISOString(),
      };
      documentRef.current = next;
      return next;
    });
    markDirty();
  }, [markDirty]);

  const redo = useCallback(() => {
    setDocument((current) => {
      const nextSnapshot = current.history.future[0];
      if (!nextSnapshot) return current;
      const next = {
        ...current,
        nodes: structuredClone(nextSnapshot.nodes),
        edges: structuredClone(nextSnapshot.edges),
        viewport: structuredClone(nextSnapshot.viewport),
        history: {
          past: [...current.history.past, snapshotOfDocument(current)].slice(-100),
          future: current.history.future.slice(1),
        },
        updatedAt: new Date().toISOString(),
      };
      documentRef.current = next;
      return next;
    });
    markDirty();
  }, [markDirty]);

  const fitView = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.2, duration: 250 });
  }, []);

  const resetView = useCallback(() => {
    flowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 250 });
  }, []);

  const focusNode = useCallback((nodeId: string) => {
    const target = documentRef.current.nodes.find((node) => node.id === nodeId);
    if (!target || !flowRef.current) return;
    flowRef.current.setCenter(target.position.x + target.width / 2, target.position.y + target.height / 2, {
      zoom: Math.max(flowRef.current.getZoom(), 1),
      duration: 250,
    });
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeId(null);
  }, []);

  const autoLayout = useCallback(async () => {
    const { autoLayoutDocument } = await import("../model");
    mutateCurrentDocument((current) => autoLayoutDocument(current));
  }, [mutateCurrentDocument]);

  const importDocumentsFromText = useCallback(
    async (text: string) => {
      try {
        const parsed = JSON.parse(text);
        const result = validateImportedProject(parsed);
        if (!result.documents.length) {
          setMessage({ tone: "warning", text: "Файл не содержит валидных схем для импорта." });
          return;
        }
        for (const item of result.documents) {
          await createSerialMapDocument({
            name: item.name,
            description: item.description || null,
            scope: "engineering",
            document: item.document,
          });
        }
        await queryClient.invalidateQueries({ queryKey: ["serial-map-documents", "v2"] });
        setMessage({
          tone: "info",
          text: result.diagnostics.length
            ? `Импорт завершен. Диагностика: ${result.diagnostics.length}.`
            : "Импорт завершен.",
        });
      } catch {
        setMessage({ tone: "warning", text: "Не удалось импортировать JSON." });
      }
    },
    [queryClient],
  );

  const exportCurrent = useCallback(
    (format: "json" | "xml" | "csv") => {
      const baseName = (documentName || "serial-map-v2").trim().replace(/[\\/:*?"<>|]+/g, "_");
      if (format === "json") {
        downloadTextFile(`${baseName}.json`, JSON.stringify(documentRef.current, null, 2), "application/json;charset=utf-8");
        return;
      }
      if (format === "xml") {
        downloadTextFile(`${baseName}.xml`, exportSerialMapXml(documentRef.current), "application/xml;charset=utf-8");
        return;
      }
      downloadTextFile(`${baseName}.csv`, exportSerialMapCsv(documentRef.current), "text/csv;charset=utf-8");
    },
    [documentName],
  );

  const restoreFallbackDraft = useCallback(async () => {
    if (!recoveryDraft) return;
    await createDocument({
      name: "Восстановленный локальный черновик",
      description: "Imported from localStorage fallback",
      document: recoveryDraft,
    });
    clearSerialMapDraft();
    setRecoveryDraft(null);
  }, [createDocument, recoveryDraft]);

  return {
    allDocuments,
    allEquipment,
    conflictedNodeIds,
    conflicts,
    diagnostics,
    document,
    documentDescription,
    documentName,
    hasOpenCanvas,
    hasUnsavedChanges,
    message,
    readOnly,
    recoveryDraft,
    saveStatus,
    selectedDocumentId,
    selectedEdge,
    selectedEdgeId,
    selectedNode,
    selectedNodeIds,
    showGrid,
    showMiniMap,
    toolMode,
    activeDocumentId,
    equipmentMap,
    registerCanvasElement,
    registerFlowInstance,
    setDocumentDescription,
    setDocumentName,
    setMessage,
    setSelectedDocumentId,
    setSelection,
    setShowGrid,
    setShowMiniMap,
    setToolMode,
    addDataPoolEntry,
    addEquipmentNode,
    addGatewayMapping,
    addPresetNode,
    autoLayout,
    beginNodeDrag,
    connectNodes,
    copySelection,
    createDocument,
    deleteDocument,
    deleteSelection,
    duplicateSelection,
    endNodeDrag,
    exportCurrent,
    fitView,
    focusNode,
    importDocumentsFromText,
    mutateCurrentDocument,
    openDocument,
    pasteSelection,
    redo,
    removeDataPoolEntry,
    removeGatewayMapping,
    resetView,
    restoreFallbackDraft,
    saveCurrent,
    syncNodePositions,
    undo,
    updateDataPoolEntry,
    updateDocumentMetadata,
    updateGatewayMapping,
    updateSelectedEdge,
    updateSelectedNode,
  };
}
