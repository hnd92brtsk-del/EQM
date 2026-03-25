import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowDownUp,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Grip,
  Hand,
  Layers3,
  Link2,
  Rows3,
  Maximize2,
  Minimize2,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import { listSerialMapDocuments, getSerialMapDocument, createSerialMapDocument, updateSerialMapDocument, deleteSerialMapDocument, listSerialMapEligibleEquipment } from "../features/serialMap/api";
import {
  autoLayoutDocument,
  computeConflicts,
  computeDiagnostics,
  createEmptyDataPoolEntry,
  createEmptyDocument,
  createEmptyGatewayMapping,
  createNodeFromEquipment,
  createNodeFromPreset,
  getProtocolMeta,
  mutateDocument,
  normalizeSerialMapDocument,
  resolveNodeName,
  snapshotOfDocument,
  validateImportedProject,
} from "../features/serialMap/model";
import type {
  SerialMapDataPoolEntry,
  SerialMapDocumentData,
  SerialMapEdge,
  SerialMapNode,
  SerialMapNodeKind,
  SerialMapProtocol,
  SerialMapSaveStatus,
  SerialMapSnapshot,
} from "../features/serialMap/types";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "../components/ui/menubar";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { clearSerialMapDraft, loadSerialMapDraft } from "../features/serialMap/storage";

type ToolMode = "select" | "connect" | "pan";
type InspectorTab = "selection" | "data" | "gateway" | "diagnostics";
type Interaction =
  | { type: "pan"; startX: number; startY: number; viewport: SerialMapDocumentData["viewport"]; moved: boolean }
  | { type: "drag"; startX: number; startY: number; nodeIds: string[]; positions: Record<string, { x: number; y: number }>; snapshot: SerialMapSnapshot; moved: boolean }
  | { type: "select"; startX: number; startY: number; endX: number; endY: number }
  | null;

const defaultViewport = { x: 0, y: 0, zoom: 1 };
const parityOptions = ["None", "Even", "Odd", "Mark", "Space"] as const;
const protocolOptions: SerialMapProtocol[] = ["Modbus RTU", "Profibus DP", "CAN Bus", "RS-485", "RS-232", "Custom"];
const palette: Record<SerialMapNodeKind, { stroke: string; fill: string; head: string }> = {
  equipment: { stroke: "#2563eb", fill: "#ffffff", head: "#dbeafe" },
  master: { stroke: "#2563eb", fill: "#ffffff", head: "#dbeafe" },
  slave: { stroke: "#15803d", fill: "#ffffff", head: "#dcfce7" },
  sensor: { stroke: "#c2410c", fill: "#ffffff", head: "#ffedd5" },
  bus: { stroke: "#475569", fill: "#f8fafc", head: "#e2e8f0" },
  repeater: { stroke: "#7c3aed", fill: "#ffffff", head: "#ede9fe" },
  gateway: { stroke: "#dc2626", fill: "#ffffff", head: "#fee2e2" },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rectOf = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) });
const intersects = (node: SerialMapNode, rect: { x: number; y: number; width: number; height: number }) => !(node.position.x + node.width < rect.x || node.position.x > rect.x + rect.width || node.position.y + node.height < rect.y || node.position.y > rect.y + rect.height);
const boundsOf = (nodes: SerialMapNode[]) => !nodes.length ? { x: 0, y: 0, width: 800, height: 500 } : { x: Math.min(...nodes.map((n) => n.position.x)), y: Math.min(...nodes.map((n) => n.position.y)), width: Math.max(...nodes.map((n) => n.position.x + n.width)) - Math.min(...nodes.map((n) => n.position.x)), height: Math.max(...nodes.map((n) => n.position.y + n.height)) - Math.min(...nodes.map((n) => n.position.y)) };
const centerOf = (node: SerialMapNode) => ({ x: node.position.x + node.width / 2, y: node.position.y + node.height / 2 });
const sidebarActionButtonClass = "h-auto min-h-11 justify-center px-2.5 py-2 text-center text-[12px] leading-snug whitespace-normal [word-break:break-word]";

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function xmlSafe(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function exportXml(document: SerialMapDocumentData) {
  return `<?xml version="1.0" encoding="UTF-8"?><SerialMap><Nodes>${document.nodes.map((node) => `<Node id="${xmlSafe(node.id)}" type="${xmlSafe(node.kind)}" name="${xmlSafe(node.name)}" address="${node.address ?? ""}" protocol="${xmlSafe(node.protocol)}" baudRate="${node.baudRate}" parity="${xmlSafe(node.parity)}" dataBits="${node.dataBits}" stopBits="${node.stopBits}" segment="${node.segment}"><Note>${xmlSafe(node.note)}</Note></Node>`).join("")}</Nodes><Edges>${document.edges.map((edge) => `<Edge id="${xmlSafe(edge.id)}" from="${xmlSafe(edge.fromNodeId)}" to="${xmlSafe(edge.toNodeId)}" protocol="${xmlSafe(edge.protocol)}" baudRate="${edge.baudRate}" label="${xmlSafe(edge.label)}" cableMark="${xmlSafe(edge.cableMark)}" />`).join("")}</Edges></SerialMap>`;
}

function exportCsv(document: SerialMapDocumentData) {
  return `\uFEFF${["ID,Тип,Имя,Адрес,Протокол,Бод,Чётность,Биты данных,Стоп-биты,Сегмент,Примечание,Мост", ...document.nodes.map((node) => [node.id, node.kind, node.name, node.address ?? "", node.protocol, node.baudRate, node.parity, node.dataBits, node.stopBits, node.segment, node.note, node.bridgeProtocol || ""].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))].join("\n")}`;
}

function DocumentPreviewCard({
  active,
  title,
  subtitle,
  updatedAt,
  stats,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  updatedAt: string;
  stats: { nodes: number; edges: number; warnings: number };
}) {
  const previewNodes = Array.from({ length: Math.min(stats.nodes, 5) }, (_, index) => ({
    left: 16 + (index % 3) * 18 + (index > 2 ? 10 : 0),
    top: index < 3 ? 14 : 34,
  }));

  return (
    <div className={cn("w-full border p-3.5 text-left transition", active ? "border-slate-900 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]" : "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className={cn("mt-1 line-clamp-2 text-[11px]", active ? "text-slate-300" : "text-slate-500")}>{subtitle}</div>
        </div>
        {active ? <Badge className="bg-white text-slate-900">Активен</Badge> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[92px_minmax(0,1fr)]">
        <div className={cn("relative h-[66px] overflow-hidden border", active ? "border-white/15 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),rgba(255,255,255,0.04))]" : "border-slate-200 bg-slate-50")}>
          <div className={cn("absolute inset-x-0 top-0 h-7", active ? "bg-white/5" : "bg-white")} />
          <svg viewBox="0 0 92 68" className="h-full w-full">
            {previewNodes.map((node, index) => (
              <g key={`${node.left}-${node.top}-${index}`}>
                {index > 0 ? <path d={`M${previewNodes[index - 1].left + 6} ${previewNodes[index - 1].top + 6} L${node.left + 6} ${node.top + 6}`} stroke={active ? "rgba(255,255,255,0.38)" : "#94a3b8"} strokeWidth="1.35" /> : null}
                <circle cx={node.left + 6} cy={node.top + 6} r="5" fill={active ? "rgba(255,255,255,0.1)" : "#e2e8f0"} />
                <circle cx={node.left + 6} cy={node.top + 6} r="3.2" fill={active ? "#ffffff" : "#64748b"} />
              </g>
            ))}
          </svg>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className={cn("min-w-0 px-2 py-1.5", active ? "bg-white/8" : "bg-slate-50")}><div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>Узлы</div><div className="mt-1 text-sm font-semibold">{stats.nodes}</div></div>
          <div className={cn("min-w-0 px-2 py-1.5", active ? "bg-white/8" : "bg-slate-50")}><div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>Связи</div><div className="mt-1 text-sm font-semibold">{stats.edges}</div></div>
          <div className={cn("min-w-0 px-2 py-1.5", active ? "bg-white/8" : "bg-slate-50")}><div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>Предупр.</div><div className="mt-1 text-sm font-semibold">{stats.warnings}</div></div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span>{updatedAt}</span><span>{stats.nodes + stats.edges > 0 ? `${Math.round((stats.edges / Math.max(stats.nodes, 1)) * 100)}%` : "--"}</span></div>
    </div>
  );
}

function CompactDocumentRow({
  item,
  selected,
  active,
  onClick,
  onDelete,
}: {
  item: { id: number; name: string; description: string | null; document: SerialMapDocumentData };
  selected: boolean;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const warningCount = computeDiagnostics(item.document).filter((entry) => entry.level !== "info").length;
  return (
    <button
      type="button"
      className={cn("grid w-full min-w-0 grid-cols-[minmax(0,1fr)_36px_36px_48px_32px] items-center gap-1.5 border-l-2 px-2.5 py-2.5 text-left text-[12px] transition", selected ? "border-l-slate-900 border-y-slate-900 border-r-slate-900 bg-slate-900 text-white" : "border-l-slate-300 border-y-slate-200 border-r-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}
      onClick={onClick}
      title={item.name}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold" title={item.name}>{item.name}</div>
          {active ? <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">LIVE</Badge> : null}
        </div>
        <div className={cn("mt-1 truncate text-[10px]", selected ? "text-slate-300" : "text-slate-500")}>{item.description || "Без описания"}</div>
      </div>
      <div className={cn("text-center font-semibold", selected ? "text-white" : "text-slate-700")}>{item.document.nodes.length}</div>
      <div className={cn("text-center font-semibold", selected ? "text-white" : "text-slate-700")}>{item.document.edges.length}</div>
      <div className={cn("text-center font-semibold", selected ? "text-white" : warningCount > 0 ? "text-amber-600" : "text-slate-500")}>{warningCount}</div>
      <button
        type="button"
        className={cn("inline-flex h-7 w-7 items-center justify-center border text-slate-500 transition hover:text-red-600", selected ? "border-white/20 hover:bg-white/10" : "border-slate-200 hover:bg-red-50")}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        title={`Удалить схему "${item.name}"`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </button>
  );
}

function EmptyCanvasState({ title, description, primaryAction, secondaryAction }: { title: string; description: string; primaryAction?: React.ReactNode; secondaryAction?: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
      <div className="w-full max-w-md border border-slate-200 bg-white p-6 text-center shadow-lg">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="mt-2 text-sm text-slate-500">{description}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">{primaryAction}{secondaryAction}</div>
      </div>
    </div>
  );
}

export default function SerialMapPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const readOnly = !canWrite;
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addNodeMenuRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction>(null);
  const hydratingRef = useRef(false);

  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);
  const [documentName, setDocumentName] = useState("Карта последовательных протоколов");
  const [documentDescription, setDocumentDescription] = useState("");
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [selectedDocumentDescription, setSelectedDocumentDescription] = useState("");
  const [document, setDocument] = useState<SerialMapDocumentData>(createEmptyDocument());
  const [saveStatus, setSaveStatus] = useState<SerialMapSaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("selection");
  const [pendingConnectId, setPendingConnectId] = useState<string | null>(null);
  const [canvasSearch, setCanvasSearch] = useState("");
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [isAddNodeMenuOpen, setIsAddNodeMenuOpen] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [isInspectorDrawerOpen, setIsInspectorDrawerOpen] = useState(false);
  const [isEditingSelectedDocument, setIsEditingSelectedDocument] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createNameDraft, setCreateNameDraft] = useState("Новая схема последовательных протоколов");
  const [createDescriptionDraft, setCreateDescriptionDraft] = useState("");
  const [pendingDeleteDocument, setPendingDeleteDocument] = useState<{ id: number; name: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [clipboardNodes, setClipboardNodes] = useState<SerialMapNode[]>([]);
  const [recoveryDraft, setRecoveryDraft] = useState<SerialMapDocumentData | null>(() => {
    const raw = loadSerialMapDraft();
    return raw ? normalizeSerialMapDocument(raw) : null;
  });
  const activeDocumentIdRef = useRef<number | null>(null);
  const documentRef = useRef<SerialMapDocumentData>(createEmptyDocument());
  const documentNameRef = useRef(documentName);
  const documentDescriptionRef = useRef(documentDescription);
  const readOnlyRef = useRef(readOnly);
  const saveInFlightRef = useRef(false);
  const needsSaveAfterCurrentRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);

  const documentsQuery = useQuery({ queryKey: ["serial-map-documents"], queryFn: () => listSerialMapDocuments({ page: 1, page_size: 100, scope: "engineering" }) });
  const detailQuery = useQuery({ queryKey: ["serial-map-document", activeDocumentId], queryFn: () => getSerialMapDocument(activeDocumentId as number), enabled: activeDocumentId !== null });
  const equipmentQuery = useQuery({ queryKey: ["serial-map-eligible-equipment"], queryFn: () => listSerialMapEligibleEquipment({}) });

  const allDocuments = documentsQuery.data?.items || [];
  const selectedDocument = allDocuments.find((item) => item.id === selectedDocumentId) || null;
  const filteredDocuments = useMemo(() => {
    const q = documentSearch.trim().toLowerCase();
    if (!q) return allDocuments;
    return allDocuments.filter((item) => [item.name, item.description || ""].join(" ").toLowerCase().includes(q));
  }, [allDocuments, documentSearch]);

  useEffect(() => {
    if (allDocuments.length === 0) {
      if (selectedDocumentId !== null) setSelectedDocumentId(null);
      if (activeDocumentId !== null) setActiveDocumentId(null);
      return;
    }
    if (selectedDocumentId === null) setSelectedDocumentId(allDocuments[0].id);
    if (selectedDocumentId !== null && !allDocuments.some((item) => item.id === selectedDocumentId)) setSelectedDocumentId(allDocuments[0]?.id ?? null);
    if (activeDocumentId !== null && !allDocuments.some((item) => item.id === activeDocumentId)) setActiveDocumentId(null);
  }, [activeDocumentId, allDocuments, selectedDocumentId]);

  useEffect(() => {
    if (!detailQuery.data) return;
    const normalized = normalizeSerialMapDocument(detailQuery.data.document);
    hydratingRef.current = true;
    setDocumentName(detailQuery.data.name);
    setDocumentDescription(detailQuery.data.description || "");
    documentRef.current = normalized;
    setDocument(normalized);
    setSelectedDocumentId(detailQuery.data.id);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setPendingConnectId(null);
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setSaveStatus("saved");
    setTimeout(() => { hydratingRef.current = false; }, 0);
  }, [detailQuery.data]);

  useEffect(() => {
    if (selectedDocument) {
      setSelectedDocumentName(selectedDocument.name);
      setSelectedDocumentDescription(selectedDocument.description || "");
    } else {
      setSelectedDocumentName(documentName);
      setSelectedDocumentDescription(documentDescription);
    }
  }, [documentDescription, documentName, selectedDocument]);

  useEffect(() => {
    activeDocumentIdRef.current = activeDocumentId;
    documentRef.current = document;
    documentNameRef.current = documentName;
    documentDescriptionRef.current = documentDescription;
    readOnlyRef.current = readOnly;
  }, [activeDocumentId, document, documentDescription, documentName, readOnly]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(globalThis.document.fullscreenElement === canvasShellRef.current);
    };

    globalThis.document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => globalThis.document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (addNodeMenuRef.current && target && !addNodeMenuRef.current.contains(target)) {
        setIsAddNodeMenuOpen(false);
      }
      if (searchPanelRef.current && target && !searchPanelRef.current.contains(target)) {
        setIsSearchResultsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pendingConnectId || toolMode === "connect") {
        setPendingConnectId(null);
        setToolMode("select");
        setMessage({ tone: "info", text: "Режим связи отменён." });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingConnectId, toolMode]);

  const saveStateLabel = saveStatus === "saving" ? "Сохранение..." : saveStatus === "saved" ? "Сохранено" : saveStatus === "error" ? "Ошибка сохранения" : hasUnsavedChanges ? "Есть изменения" : "Без изменений";
  const equipmentMap = useMemo(() => new Map((equipmentQuery.data || []).map((item) => [item.key, item])), [equipmentQuery.data]);
  const conflicts = useMemo(() => computeConflicts(document), [document]);
  const diagnostics = useMemo(() => computeDiagnostics(document), [document]);
  const selectedNode = selectedNodeIds.length === 1 ? document.nodes.find((node) => node.id === selectedNodeIds[0]) || null : null;
  const selectedEdge = selectedEdgeId ? document.edges.find((edge) => edge.id === selectedEdgeId) || null : null;
  const mapBounds = useMemo(() => boundsOf(document.nodes), [document.nodes]);
  const miniMapViewBox = useMemo(() => ({
    x: mapBounds.x - 30,
    y: mapBounds.y - 30,
    width: Math.max(mapBounds.width + 60, 260),
    height: Math.max(mapBounds.height + 60, 180),
  }), [mapBounds]);
  const searchResults = useMemo(() => {
    const q = canvasSearch.trim().toLowerCase();
    if (!q) return [];
    return document.nodes.filter((node) =>
      [
        resolveNodeName(node, equipmentMap),
        node.name,
        node.note,
        String(node.address ?? ""),
        node.protocol,
        node.kind,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [canvasSearch, document.nodes, equipmentMap]);
  const visibleNodes = canvasSearch.trim() ? searchResults : document.nodes;
  const visibleEquipment = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const items = equipmentQuery.data || [];
    return !q ? items : items.filter((item) => [item.displayName, item.manufacturerName || "", item.locationFullPath || ""].join(" ").toLowerCase().includes(q));
  }, [equipmentQuery.data, inventorySearch]);

  const previewTitle = selectedDocument?.name || documentName;
  const previewDescription = selectedDocument?.description || documentDescription || "Без описания";
  const previewDocument = selectedDocument?.document || document;
  const previewUpdatedAt = selectedDocument ? new Date(selectedDocument.updated_at).toLocaleString(i18n.language) : saveStateLabel;
  const previewStats = { nodes: previewDocument.nodes.length, edges: previewDocument.edges.length, warnings: computeDiagnostics(previewDocument).filter((entry) => entry.level !== "info").length };
  const miniMapViewportRect = useMemo(() => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: (-document.viewport.x) / document.viewport.zoom,
      y: (-document.viewport.y) / document.viewport.zoom,
      width: bounds.width / document.viewport.zoom,
      height: bounds.height / document.viewport.zoom,
    };
  }, [document.viewport]);

  const markDirty = () => {
    if (hydratingRef.current) return;
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
    if (saveInFlightRef.current) {
      needsSaveAfterCurrentRef.current = true;
    }
    setSaveStatus("idle");
  };

  const mutateCurrentDocument = (mutate: (current: SerialMapDocumentData) => SerialMapDocumentData, options?: { recordHistory?: boolean }) => {
    const next = mutateDocument(documentRef.current, mutate, options);
    documentRef.current = next;
    setDocument(next);
    markDirty();
  };

  const flushSave = async () => {
    if (readOnlyRef.current || activeDocumentIdRef.current === null || !hasUnsavedChangesRef.current) {
      return;
    }

    if (saveInFlightRef.current) {
      needsSaveAfterCurrentRef.current = true;
      return;
    }

    saveInFlightRef.current = true;

    while (hasUnsavedChangesRef.current && activeDocumentIdRef.current !== null && !readOnlyRef.current) {
      needsSaveAfterCurrentRef.current = false;
      try {
        setSaveStatus("saving");
        const updated = await updateSerialMapDocument(activeDocumentIdRef.current, {
          name: documentNameRef.current || "Карта последовательных протоколов",
          description: documentDescriptionRef.current || null,
          scope: "engineering",
          document: documentRef.current,
        });
        await queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
        queryClient.setQueryData(["serial-map-document", activeDocumentIdRef.current], updated);
        hasUnsavedChangesRef.current = false;
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
        saveInFlightRef.current = false;
        return;
      }

      if (!needsSaveAfterCurrentRef.current) {
        break;
      }
    }

    saveInFlightRef.current = false;
  };

  const commitUserAction = () => {
    void flushSave();
  };

  const handleFieldCommit = () => {
    commitUserAction();
  };

  const handleFieldKeyDown = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleFieldCommit();
      event.currentTarget.blur();
    }
  };

  const handleSelectCommit = () => {
    commitUserAction();
  };

  const handleMetadataDraftCommit = async () => {
    if (!isEditingSelectedDocument || selectedDocumentId === null || readOnly) return;
    const trimmedName = selectedDocumentName.trim();
    const trimmedDescription = selectedDocumentDescription.trim();
    const currentName = selectedDocument?.name || "";
    const currentDescription = selectedDocument?.description || "";
    if ((trimmedName || "Карта последовательных протоколов") === currentName && trimmedDescription === currentDescription) {
      setIsEditingSelectedDocument(false);
      return;
    }
    await handleSaveSelectedMetadata();
  };

  const handleMetadataDraftKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleMetadataDraftCommit();
      event.currentTarget.blur();
    }
  };

  const toLogical = (clientX: number, clientY: number) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    return !bounds ? { x: 0, y: 0 } : { x: (clientX - bounds.left - document.viewport.x) / document.viewport.zoom, y: (clientY - bounds.top - document.viewport.y) / document.viewport.zoom };
  };

  const setViewport = (viewport: SerialMapDocumentData["viewport"]) => mutateCurrentDocument((current) => ({ ...current, viewport }), { recordHistory: false });
  const commitSnapshot = (snapshot: SerialMapSnapshot) => setDocument((current) => {
    const next = { ...current, updatedAt: new Date().toISOString(), history: { past: [...current.history.past, snapshot].slice(-100), future: [] } };
    documentRef.current = next;
    return next;
  });

  const focusPoint = (x: number, y: number) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setViewport({
      x: bounds.width / 2 - x * document.viewport.zoom,
      y: bounds.height / 2 - y * document.viewport.zoom,
      zoom: document.viewport.zoom,
    });
  };

  const focusNode = (nodeId: string) => {
    const node = document.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    focusPoint(node.position.x + node.width / 2, node.position.y + node.height / 2);
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeId(null);
    setInspectorTab("selection");
  };

  const fitView = () => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds || !document.nodes.length) return setViewport(defaultViewport);
    const b = boundsOf(document.nodes);
    const zoom = clamp(Math.min(bounds.width / (b.width + 120), bounds.height / (b.height + 120)), 0.2, 2.5);
    setViewport({ x: bounds.width / 2 - (b.x + b.width / 2) * zoom, y: bounds.height / 2 - (b.y + b.height / 2) * zoom, zoom });
  };

  const resetView = () => setViewport(defaultViewport);

  const toggleFullscreen = async () => {
    const target = canvasShellRef.current;
    if (!target) return;
    try {
      if (globalThis.document.fullscreenElement === target) {
        await globalThis.document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch {
      setMessage({ tone: "warning", text: "Не удалось переключить полноэкранный режим." });
    }
  };

  const createEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = document.nodes.find((node) => node.id === fromId);
    const to = document.nodes.find((node) => node.id === toId);
    if (!from || !to) return;
    const duplicate = document.edges.some((edge) => (edge.fromNodeId === fromId && edge.toNodeId === toId) || (edge.fromNodeId === toId && edge.toNodeId === fromId));
    if (duplicate) return setMessage({ tone: "warning", text: "Такая связь уже существует." });
    if ([from, to].some((node) => node.protocol === "RS-232" && document.edges.some((edge) => edge.fromNodeId === node.id || edge.toNodeId === node.id))) return setMessage({ tone: "warning", text: "RS-232 допускает только одно соединение на узел." });
    const edgeId = `edge_${Math.random().toString(36).slice(2, 10)}`;
    mutateCurrentDocument((current) => ({ ...current, edges: [...current.edges, { id: edgeId, fromNodeId: fromId, toNodeId: toId, protocol: from.protocol, baudRate: from.baudRate, label: "", cableMark: "", meta: {} }] }));
    setSelectedNodeIds([]);
    setSelectedEdgeId(edgeId);
    setToolMode("select");
    commitUserAction();
    setMessage({ tone: "info", text: "Связь создана." });
  };

  const beginNodeInteraction = (event: ReactPointerEvent, nodeId: string) => {
    event.stopPropagation();
    if (toolMode === "connect") {
      if (pendingConnectId && pendingConnectId !== nodeId) {
        createEdge(pendingConnectId, nodeId);
        setPendingConnectId(null);
      } else {
        setPendingConnectId(nodeId);
        if (pendingConnectId === nodeId) {
          setMessage({ tone: "info", text: "Выберите другой узел для создания связи." });
        } else {
          const nodeName = document.nodes.find((node) => node.id === nodeId)?.name || "узел";
          setMessage({ tone: "info", text: `Источник связи выбран: ${nodeName}. Теперь выберите второй узел.` });
        }
      }
      return;
    }
    if (toolMode === "pan" || event.button !== 0) {
      interactionRef.current = { type: "pan", startX: event.clientX, startY: event.clientY, viewport: document.viewport, moved: false };
      return;
    }
    const selection = event.shiftKey ? (selectedNodeIds.includes(nodeId) ? selectedNodeIds.filter((id) => id !== nodeId) : [...selectedNodeIds, nodeId]) : (selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId]);
    setSelectedNodeIds(selection);
    setSelectedEdgeId(null);
    setInspectorTab("selection");
    if (readOnly) return;
    const nodeIds = selection.length ? selection : [nodeId];
    interactionRef.current = { type: "drag", startX: event.clientX, startY: event.clientY, nodeIds, snapshot: snapshotOfDocument(document), moved: false, positions: Object.fromEntries(document.nodes.filter((node) => nodeIds.includes(node.id)).map((node) => [node.id, { ...node.position }])) };
  };

  const beginCanvasInteraction = (event: ReactPointerEvent) => {
    if (toolMode === "pan" || event.button === 1) {
      interactionRef.current = { type: "pan", startX: event.clientX, startY: event.clientY, viewport: document.viewport, moved: false };
      return;
    }
    if (toolMode === "connect") {
      setPendingConnectId(null);
      setToolMode("select");
      setMessage({ tone: "info", text: "Режим связи отменён." });
      return;
    }
    interactionRef.current = { type: "select", startX: event.clientX, startY: event.clientY, endX: event.clientX, endY: event.clientY };
    if (!event.shiftKey) setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.type === "pan") {
        const dx = event.clientX - interaction.startX;
        const dy = event.clientY - interaction.startY;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) interaction.moved = true;
        setDocument((current) => {
          const next = { ...current, viewport: { ...interaction.viewport, x: interaction.viewport.x + event.clientX - interaction.startX, y: interaction.viewport.y + event.clientY - interaction.startY } };
          documentRef.current = next;
          return next;
        });
      } else if (interaction.type === "drag") {
        const dx = (event.clientX - interaction.startX) / document.viewport.zoom;
        const dy = (event.clientY - interaction.startY) / document.viewport.zoom;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) interaction.moved = true;
        setDocument((current) => {
          const next = { ...current, nodes: current.nodes.map((node) => !interaction.nodeIds.includes(node.id) ? node : ({ ...node, position: { x: interaction.positions[node.id].x + dx, y: interaction.positions[node.id].y + dy } })) };
          documentRef.current = next;
          return next;
        });
      } else {
        interactionRef.current = { ...interaction, endX: event.clientX, endY: event.clientY };
      }
    };
    const onUp = () => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.type === "drag" && interaction.moved) {
        commitSnapshot(interaction.snapshot);
        markDirty();
        commitUserAction();
      }
      if (interaction.type === "pan" && interaction.moved) {
        markDirty();
        commitUserAction();
      }
      if (interaction.type === "select") {
        setSelectedNodeIds(document.nodes.filter((node) => intersects(node, rectOf(toLogical(interaction.startX, interaction.startY), toLogical(interaction.endX, interaction.endY)))).map((node) => node.id));
      }
      interactionRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [document.nodes, document.viewport.zoom, selectedNodeIds]);

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const mx = event.clientX - bounds.left;
    const my = event.clientY - bounds.top;
    const zoom = clamp(document.viewport.zoom * (event.deltaY > 0 ? 0.88 : 1.14), 0.2, 3);
    setViewport({
      x: mx - ((mx - document.viewport.x) / document.viewport.zoom) * zoom,
      y: my - ((my - document.viewport.y) / document.viewport.zoom) * zoom,
      zoom,
    });
  };

  const edgePath = (edge: SerialMapEdge) => {
    const from = document.nodes.find((item) => item.id === edge.fromNodeId);
    const to = document.nodes.find((item) => item.id === edge.toNodeId);
    if (!from || !to) return "";
    const a = centerOf(from);
    const b = centerOf(to);
    const dx = Math.abs(b.x - a.x) * 0.42;
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };

  const updateSelectedNode = (patch: Partial<SerialMapNode>) => selectedNode && mutateCurrentDocument((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node) }));
  const updateSelectedEdge = (patch: Partial<SerialMapEdge>) => selectedEdge && mutateCurrentDocument((current) => ({ ...current, edges: current.edges.map((edge) => edge.id === selectedEdge.id ? { ...edge, ...patch } : edge) }));
  const updateDataPool = (entryId: string, patch: Partial<SerialMapDataPoolEntry>) => selectedNode && mutateCurrentDocument((current) => ({ ...current, nodes: current.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, dataPool: node.dataPool.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry) })) }));
  const addDataPoolEntry = () => selectedNode && mutateCurrentDocument((current) => ({ ...current, nodes: current.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, dataPool: [...node.dataPool, { ...createEmptyDataPoolEntry(node.protocol), sortOrder: node.dataPool.length + 1 }] })) }));
  const removeDataPoolEntry = (entryId: string) => selectedNode && mutateCurrentDocument((current) => ({ ...current, nodes: current.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, dataPool: node.dataPool.filter((entry) => entry.id !== entryId) })) }));
  const updateGatewayMapping = (mappingId: string, patch: Record<string, string>) => selectedNode && mutateCurrentDocument((current) => ({ ...current, nodes: current.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, converterMappings: (node.converterMappings || []).map((item) => item.id === mappingId ? { ...item, ...patch } : item) })) }));
  const addGatewayMapping = () => selectedNode && mutateCurrentDocument((current) => ({ ...current, nodes: current.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, converterMappings: [...(node.converterMappings || []), createEmptyGatewayMapping()] })) }));
  const removeGatewayMapping = (mappingId: string) => selectedNode && mutateCurrentDocument((current) => ({ ...current, nodes: current.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, converterMappings: (node.converterMappings || []).filter((item) => item.id !== mappingId) })) }));

  const addPresetNode = (kind: Exclude<SerialMapNodeKind, "equipment">) => {
    if (readOnly || activeDocumentId === null) return;
    mutateCurrentDocument((current) => ({ ...current, nodes: [...current.nodes, createNodeFromPreset(kind, { x: mapBounds.x + 80 + current.nodes.length * 24, y: mapBounds.y + 80 + current.nodes.length * 16 }, current.nodes.length + 1)] }));
    commitUserAction();
  };

  const addEquipmentNode = (equipmentKey: string) => {
    const item = equipmentMap.get(equipmentKey);
    if (!item || readOnly || activeDocumentId === null) return;
    mutateCurrentDocument((current) => ({ ...current, nodes: [...current.nodes, createNodeFromEquipment(item, { x: mapBounds.x + 80 + current.nodes.length * 28, y: mapBounds.y + 90 + current.nodes.length * 18 })] }));
    commitUserAction();
  };

  const focusSearchResult = (nodeId: string) => {
    focusNode(nodeId);
    setIsSearchResultsOpen(false);
  };

  const handleMiniMapPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const logicalX = miniMapViewBox.x + ((event.clientX - bounds.left) / bounds.width) * miniMapViewBox.width;
    const logicalY = miniMapViewBox.y + ((event.clientY - bounds.top) / bounds.height) * miniMapViewBox.height;
    focusPoint(logicalX, logicalY);
  };

  const copySelection = () => {
    const items = document.nodes.filter((node) => selectedNodeIds.includes(node.id));
    if (!items.length) return;
    setClipboardNodes(structuredClone(items));
    setMessage({ tone: "info", text: `Скопировано узлов: ${items.length}.` });
  };

  const pasteSelection = () => {
    if (!clipboardNodes.length || readOnly || activeDocumentId === null) return;
    const clones = clipboardNodes.map((node, index) => ({ ...structuredClone(node), id: `node_${Math.random().toString(36).slice(2, 10)}`, name: `${node.name} копия`, position: { x: node.position.x + 48 + index * 12, y: node.position.y + 48 + index * 12 } }));
    mutateCurrentDocument((current) => ({ ...current, nodes: [...current.nodes, ...clones] }));
    setSelectedNodeIds(clones.map((node) => node.id));
    setSelectedEdgeId(null);
    commitUserAction();
  };

  const duplicateSelection = () => {
    if (!selectedNodeIds.length || readOnly) return;
    copySelection();
    pasteSelection();
  };

  const deleteSelection = async () => {
    if (readOnly || (!selectedNodeIds.length && !selectedEdgeId)) return;
    if (!window.confirm("Удалить выделение?")) return;
    mutateCurrentDocument((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => !selectedNodeIds.includes(node.id)),
      edges: current.edges.filter((edge) => edge.id !== selectedEdgeId && !selectedNodeIds.includes(edge.fromNodeId) && !selectedNodeIds.includes(edge.toNodeId)),
    }));
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setPendingConnectId(null);
    commitUserAction();
  };

  const undo = () => {
    if (!document.history.past.length) return;
    const previous = document.history.past[document.history.past.length - 1];
    setDocument((current) => {
      const next = {
        ...current,
        nodes: structuredClone(previous.nodes),
        edges: structuredClone(previous.edges),
        viewport: structuredClone(previous.viewport),
        history: { past: current.history.past.slice(0, -1), future: [snapshotOfDocument(current), ...current.history.future].slice(0, 100) },
      };
      documentRef.current = next;
      return next;
    });
    markDirty();
    commitUserAction();
  };

  const redo = () => {
    if (!document.history.future.length) return;
    const next = document.history.future[0];
    setDocument((current) => {
      const updated = {
        ...current,
        nodes: structuredClone(next.nodes),
        edges: structuredClone(next.edges),
        viewport: structuredClone(next.viewport),
        history: { past: [...current.history.past, snapshotOfDocument(current)].slice(-100), future: current.history.future.slice(1) },
      };
      documentRef.current = updated;
      return updated;
    });
    markDirty();
    commitUserAction();
  };

  const openCreateDialog = () => {
    setCreateNameDraft("Новая схема последовательных протоколов");
    setCreateDescriptionDraft("");
    setIsCreateDialogOpen(true);
  };

  const createNewDocument = async (payload?: { name?: string; description?: string | null; document?: SerialMapDocumentData }) => {
    if (readOnly) return;
    try {
      setSaveStatus("saving");
      const created = await createSerialMapDocument({
        name: payload?.name || "Карта последовательных протоколов",
        description: payload?.description || null,
        scope: "engineering",
        document: payload?.document || createEmptyDocument(),
      });
      hydratingRef.current = true;
      setSelectedDocumentId(created.id);
      setActiveDocumentId(created.id);
      setDocumentName(created.name);
      setDocumentDescription(created.description || "");
      documentRef.current = normalizeSerialMapDocument(created.document);
      setDocument(documentRef.current);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setPendingConnectId(null);
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
      queryClient.setQueryData(["serial-map-document", created.id], created);
      setTimeout(() => { hydratingRef.current = false; }, 0);
      setIsCreateDialogOpen(false);
      setIsSidebarDrawerOpen(false);
    } catch {
      setSaveStatus("error");
      setMessage({ tone: "warning", text: "Не удалось создать схему на сервере." });
    }
  };

  const handleCreateDocumentConfirm = async () => {
    const name = createNameDraft.trim();
    if (!name) return;
    await createNewDocument({
      name,
      description: createDescriptionDraft.trim() || null,
    });
  };

  const openSelectedDocument = () => {
    if (selectedDocumentId === null) return;
    setIsEditingSelectedDocument(false);
    setActiveDocumentId(selectedDocumentId);
    setIsSidebarDrawerOpen(false);
  };

  const handleSaveSelectedMetadata = async () => {
    if (selectedDocumentId === null || readOnly) return;
    try {
      const updated = await updateSerialMapDocument(selectedDocumentId, {
        name: selectedDocumentName.trim() || "Карта последовательных протоколов",
        description: selectedDocumentDescription.trim() || null,
      });
      queryClient.setQueryData(["serial-map-document", selectedDocumentId], updated);
      queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
      if (activeDocumentId === selectedDocumentId) {
        hydratingRef.current = true;
        setDocumentName(updated.name);
        setDocumentDescription(updated.description || "");
        setTimeout(() => { hydratingRef.current = false; }, 0);
      }
      setIsEditingSelectedDocument(false);
    } catch {
      setMessage({ tone: "warning", text: "Не удалось сохранить название и описание схемы." });
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (readOnly) return;
    const remaining = allDocuments.filter((item) => item.id !== documentId);
    await deleteSerialMapDocument(documentId);
    queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
    if (activeDocumentId === documentId) {
      setActiveDocumentId(null);
      documentRef.current = createEmptyDocument();
      setDocument(documentRef.current);
      setDocumentName("Карта последовательных протоколов");
      setDocumentDescription("");
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
    }
    setSelectedDocumentId(remaining[0]?.id ?? null);
    setIsEditingSelectedDocument(false);
    setPendingDeleteDocument(null);
  };

  const handleDeleteSelectedDocument = async () => {
    if (selectedDocumentId === null || readOnly || !selectedDocument) return;
    setPendingDeleteDocument({ id: selectedDocument.id, name: selectedDocument.name });
  };

  const exportProject = (format: "json" | "xml" | "csv") => {
    if (format === "json") download(`${documentName || "serial-map"}.json`, JSON.stringify(document, null, 2), "application/json;charset=utf-8");
    if (format === "xml") download(`${documentName || "serial-map"}.xml`, exportXml(document), "application/xml;charset=utf-8");
    if (format === "csv") download(`${documentName || "serial-map"}.csv`, exportCsv(document), "text/csv;charset=utf-8");
  };

  const handleImportDocuments = async (items: Array<{ name: string; description: string | null; document: SerialMapDocumentData }>) => {
    if (readOnly) return;
    let firstCreatedId: number | null = null;
    for (const item of items) {
      const created = await createSerialMapDocument({ name: item.name, description: item.description, scope: "engineering", document: item.document });
      if (firstCreatedId === null) firstCreatedId = created.id;
      queryClient.setQueryData(["serial-map-document", created.id], created);
    }
    await queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
    if (firstCreatedId !== null) {
      setSelectedDocumentId(firstCreatedId);
      setActiveDocumentId(firstCreatedId);
    }
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateImportedProject(parsed);
      if (!result.documents.length) {
        setMessage({ tone: "warning", text: result.diagnostics[0]?.message || "Импорт не удался." });
      } else {
        await handleImportDocuments(result.documents);
        setMessage({ tone: "info", text: result.documents.length > 1 ? `Импортировано документов: ${result.documents.length}.` : "Схема импортирована на сервер." });
      }
    } catch {
      setMessage({ tone: "warning", text: "Не удалось импортировать JSON." });
    }
    event.target.value = "";
  };

  const handleDropImport = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateImportedProject(parsed);
      if (result.documents.length) {
        await handleImportDocuments(result.documents);
        setMessage({ tone: "info", text: result.documents.length > 1 ? `Импортировано документов: ${result.documents.length}.` : "Схема импортирована на сервер." });
      }
    } catch {
      setMessage({ tone: "warning", text: "Не удалось импортировать JSON." });
    }
  };

  const restoreFallbackDraft = async () => {
    if (!recoveryDraft) return;
    await createNewDocument({ name: "Восстановленная схема", document: recoveryDraft });
    clearSerialMapDraft();
    setRecoveryDraft(null);
  };

  const activeInteraction = interactionRef.current;
  const logicalSelectionRect = activeInteraction?.type === "select" ? rectOf(toLogical(activeInteraction.startX, activeInteraction.startY), toLogical(activeInteraction.endX, activeInteraction.endY)) : null;
  const selectedCount = selectedNodeIds.length + (selectedEdgeId ? 1 : 0);
  const activeProtocolMeta = selectedNode ? getProtocolMeta(selectedNode.protocol) : null;
  const hasOpenCanvas = activeDocumentId !== null;
  const canCopySelection = selectedNodeIds.length > 0;
  const canPasteSelection = clipboardNodes.length > 0 && !readOnly && hasOpenCanvas;
  const canDuplicateSelection = !readOnly && selectedNodeIds.length > 0;
  const canDeleteSelection = !readOnly && selectedCount > 0;

  const renderSelectionPanel = () => {
    if (selectedNode) {
      return (
        <div className="space-y-3">
          <Input value={selectedNode.name} onChange={(event) => updateSelectedNode({ name: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} disabled={readOnly} />
          <div className="grid grid-cols-2 gap-3">
            <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedNode.protocol} onChange={(event) => updateSelectedNode({ protocol: event.target.value as SerialMapProtocol })} onBlur={handleSelectCommit} disabled={readOnly}>{protocolOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <Input value={selectedNode.address ?? ""} onChange={(event) => updateSelectedNode({ address: event.target.value === "" ? null : Number(event.target.value) })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Адрес" disabled={readOnly} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={selectedNode.baudRate} onChange={(event) => updateSelectedNode({ baudRate: Number(event.target.value) })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Скорость" disabled={readOnly} />
            <Input value={selectedNode.segment} onChange={(event) => updateSelectedNode({ segment: Number(event.target.value) })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Сегмент" disabled={readOnly} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedNode.parity} onChange={(event) => updateSelectedNode({ parity: event.target.value as SerialMapNode["parity"] })} onBlur={handleSelectCommit} disabled={readOnly}>{parityOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <Input value={selectedNode.dataBits} onChange={(event) => updateSelectedNode({ dataBits: Number(event.target.value) })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Биты" disabled={readOnly} />
            <Input value={selectedNode.stopBits} onChange={(event) => updateSelectedNode({ stopBits: Number(event.target.value) })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Стоп-биты" disabled={readOnly} />
          </div>
          <textarea className="min-h-[88px] w-full border border-slate-200 px-3 py-2 text-sm" value={selectedNode.note} onChange={(event) => updateSelectedNode({ note: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Комментарий" disabled={readOnly} />
          <div className="text-xs text-slate-500">Поддерживаемые регистры: {activeProtocolMeta?.registerTypes.join(", ") || "-"}</div>
        </div>
      );
    }
    if (selectedEdge) {
      return (
        <div className="space-y-3">
          <select className="h-10 w-full border border-slate-200 bg-white px-3 text-sm" value={selectedEdge.protocol} onChange={(event) => {
            const protocol = event.target.value as SerialMapProtocol;
            const supportedRates = getProtocolMeta(protocol).baudRates;
            updateSelectedEdge({ protocol, baudRate: supportedRates.includes(selectedEdge.baudRate) ? selectedEdge.baudRate : supportedRates[0] });
          }} onBlur={handleSelectCommit} disabled={readOnly}>
            {protocolOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <Input value={selectedEdge.cableMark} onChange={(event) => updateSelectedEdge({ cableMark: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.serialMap.fields.cableMark", { defaultValue: "Марка кабеля" })} disabled={readOnly} />
          <Input value={selectedEdge.label} onChange={(event) => updateSelectedEdge({ label: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Подпись" disabled={readOnly} />
          <Input value={selectedEdge.baudRate} onChange={(event) => updateSelectedEdge({ baudRate: Number(event.target.value) })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Скорость" disabled={readOnly} />
        </div>
      );
    }
    return <div className="space-y-4"><div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Выберите узел или связь на холсте для редактирования.</div><div className="grid grid-cols-2 gap-3"><div className="min-w-0 border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Узлы</div><div className="mt-1 text-lg font-semibold">{document.nodes.length}</div></div><div className="min-w-0 border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Связи</div><div className="mt-1 text-lg font-semibold">{document.edges.length}</div></div><div className="min-w-0 border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Предупреждения</div><div className="mt-1 text-lg font-semibold">{diagnostics.filter((item) => item.level !== "info").length}</div></div><div className="min-w-0 border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Выбор</div><div className="mt-1 text-lg font-semibold">{selectedCount}</div></div></div><div className="space-y-3 border-t border-slate-200 pt-4"><div className="text-sm font-semibold text-slate-900">Добавить оборудование</div><Input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Поиск оборудования" /><div className="max-h-[260px] space-y-2 overflow-auto pr-1">{visibleEquipment.slice(0, 12).map((item) => <div key={item.key} className="min-w-0 border border-slate-200 p-3"><div className="truncate font-semibold text-slate-900">{item.displayName}</div><div className="mt-1 text-xs text-slate-500">{item.serialPorts.map((port) => `${port.type} x${port.count}`).join(", ")}</div><div className="mt-1 truncate text-xs text-slate-400">{item.locationFullPath || item.containerName}</div><div className="mt-2"><Button size="sm" variant="outline" onClick={() => addEquipmentNode(item.key)} disabled={readOnly || !hasOpenCanvas}>Добавить</Button></div></div>)}{visibleEquipment.length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Подходящее оборудование не найдено.</div> : null}</div></div></div>;
  };

  const renderDataPanel = () => selectedNode ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Пул данных узла</div><Button size="sm" onClick={addDataPoolEntry} disabled={readOnly}><Plus className="h-4 w-4" />Добавить</Button></div>
      {(selectedNode.dataPool || []).map((entry) => (
        <div key={entry.id} className="space-y-2 border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input value={entry.name} onChange={(event) => updateDataPool(entry.id, { name: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Имя" disabled={readOnly} />
            <Input value={entry.address} onChange={(event) => updateDataPool(entry.id, { address: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Адрес" disabled={readOnly} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={entry.registerType} onChange={(event) => updateDataPool(entry.id, { registerType: event.target.value })} onBlur={handleSelectCommit} disabled={readOnly}>{Array.from(new Set([...(activeProtocolMeta?.registerTypes || []), entry.registerType].filter(Boolean))).map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={entry.dataType} onChange={(event) => updateDataPool(entry.id, { dataType: event.target.value })} onBlur={handleSelectCommit} disabled={readOnly}>{Array.from(new Set([...(activeProtocolMeta?.dataTypes || []), entry.dataType].filter(Boolean))).map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
          <Input value={entry.description} onChange={(event) => updateDataPool(entry.id, { description: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Описание" disabled={readOnly} />
          <Button size="sm" variant="destructive" onClick={() => { removeDataPoolEntry(entry.id); commitUserAction(); }} disabled={readOnly}><Trash2 className="h-4 w-4" />Удалить</Button>
        </div>
      ))}
      {(selectedNode.dataPool || []).length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Пул данных пока пуст.</div> : null}
    </div>
  ) : <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Выберите узел, чтобы работать с пулом данных.</div>;

  const renderGatewayPanel = () => selectedNode?.kind === "gateway" ? (
    <div className="space-y-3">
      <select className="h-10 w-full border border-slate-200 bg-white px-3 text-sm" value={selectedNode.bridgeProtocol || ""} onChange={(event) => updateSelectedNode({ bridgeProtocol: (event.target.value || null) as SerialMapProtocol | null })} onBlur={handleSelectCommit} disabled={readOnly}><option value="">Протокол моста</option>{protocolOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Маппинги шлюза</div><Button size="sm" onClick={() => { addGatewayMapping(); commitUserAction(); }} disabled={readOnly}><Plus className="h-4 w-4" />Добавить</Button></div>
      {(selectedNode.converterMappings || []).map((mapping) => (
        <div key={mapping.id} className="space-y-2 border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input value={mapping.srcRegisterType} onChange={(event) => updateGatewayMapping(mapping.id, { srcRegisterType: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Исходный регистр" disabled={readOnly} />
            <Input value={mapping.srcAddress} onChange={(event) => updateGatewayMapping(mapping.id, { srcAddress: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Исходный адрес" disabled={readOnly} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={mapping.dstRegisterType} onChange={(event) => updateGatewayMapping(mapping.id, { dstRegisterType: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Целевой регистр" disabled={readOnly} />
            <Input value={mapping.dstAddress} onChange={(event) => updateGatewayMapping(mapping.id, { dstAddress: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Целевой адрес" disabled={readOnly} />
          </div>
          <Input value={mapping.note} onChange={(event) => updateGatewayMapping(mapping.id, { note: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Примечание" disabled={readOnly} />
          <Button size="sm" variant="destructive" onClick={() => { removeGatewayMapping(mapping.id); commitUserAction(); }} disabled={readOnly}><Trash2 className="h-4 w-4" />Удалить</Button>
        </div>
      ))}
      {(selectedNode.converterMappings || []).length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Маппинги шлюза пока не заданы.</div> : null}
    </div>
  ) : <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Выберите шлюз, чтобы настраивать bridge protocol и маппинги.</div>;

  const renderDiagnosticsPanel = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Диагностика</div><Button size="sm" variant="outline" onClick={() => exportProject("csv")}>CSV</Button></div>
        {diagnostics.length ? diagnostics.map((item, index) => <div key={`${item.level}-${index}`} className={cn("border p-3 text-sm", item.level === "error" ? "border-red-200 bg-red-50/40" : item.level === "warning" ? "border-amber-200 bg-amber-50/40" : "border-blue-200 bg-blue-50/40")}>{item.message}</div>) : <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">Диагностика чистая, проблем не найдено.</div>}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-900">Конфликты адресов</div>
        {conflicts.length ? conflicts.map((conflict) => <div key={`${conflict.protocol}-${conflict.address}`} className="border border-slate-200 p-3"><div className="font-semibold text-slate-900">{conflict.protocol} / {conflict.address}</div><div className="mt-1 text-xs text-slate-500">{conflict.nodes.map((node) => node.name).join(", ")}</div></div>) : <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Конфликтов адресов не найдено.</div>}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-900">Таблица адресов</div>
        <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
          {document.nodes.filter((node) => node.address !== null).sort((a, b) => (a.address || 0) - (b.address || 0)).map((node) => <div key={node.id} className="flex items-center justify-between border border-slate-200 p-3"><div><div className="font-semibold text-slate-900">{node.name}</div><div className="text-xs text-slate-500">{node.protocol} • Адрес {node.address}</div></div><Button size="sm" variant="outline" onClick={() => focusNode(node.id)}>Перейти</Button></div>)}
          {document.nodes.filter((node) => node.address !== null).length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Узлов с адресами пока нет.</div> : null}
        </div>
      </div>
    </div>
  );

  const inspectorPanel = <Card className="h-full min-w-0 overflow-hidden border-slate-200 shadow-none"><CardHeader className="border-b border-slate-200"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><CardTitle>Свойства</CardTitle><CardDescription>{saveStateLabel}</CardDescription></div><Badge variant={saveStatus === "error" ? "destructive" : saveStatus === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2">{([["selection", "Свойства"], ["data", "Данные"], ["gateway", "Шлюз"], ["diagnostics", "Диагностика"]] as const).map(([tab, label]) => <button key={tab} type="button" className={cn("min-h-11 min-w-0 border px-2 py-2 text-xs font-medium leading-tight whitespace-normal [word-break:break-word]", inspectorTab === tab ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")} onClick={() => setInspectorTab(tab)}>{label}</button>)}</div></CardHeader><CardContent className="max-h-[calc(100vh-210px)] overflow-auto p-5">{inspectorTab === "selection" ? renderSelectionPanel() : inspectorTab === "data" ? renderDataPanel() : inspectorTab === "gateway" ? renderGatewayPanel() : renderDiagnosticsPanel()}</CardContent></Card>;

  const sidebarPanel = <Card className="h-full min-w-0 overflow-hidden border-slate-200 shadow-none"><CardHeader className="border-b border-slate-200"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-slate-500" />Контуры</CardTitle><CardDescription>Каждая схема хранится как отдельный серверный документ.</CardDescription></div>{activeDocumentId !== null ? <Badge variant="outline">{saveStateLabel}</Badge> : null}</div><div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" className={sidebarActionButtonClass} onClick={openCreateDialog} disabled={readOnly}><Plus className="h-4 w-4 shrink-0" />Новая схема</Button><Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={openSelectedDocument} disabled={selectedDocumentId === null}>Открыть</Button><Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={() => setIsEditingSelectedDocument(true)} disabled={selectedDocumentId === null || readOnly}>Редактировать</Button><Button size="sm" className={sidebarActionButtonClass} variant="destructive" onClick={() => { void handleDeleteSelectedDocument(); }} disabled={selectedDocumentId === null || readOnly}><Trash2 className="h-4 w-4 shrink-0" />Удалить</Button><Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={() => fileInputRef.current?.click()} disabled={readOnly}><Upload className="h-4 w-4 shrink-0" />Импорт</Button><Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={() => exportProject("json")} disabled={!hasOpenCanvas}><Upload className="h-4 w-4 shrink-0" />Экспорт JSON</Button></div>{recoveryDraft ? <div className="mt-3 space-y-2 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><div>Найден старый локальный черновик. Его можно один раз сохранить на сервер.</div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void restoreFallbackDraft()}>Восстановить</Button><Button size="sm" variant="outline" onClick={() => { clearSerialMapDraft(); setRecoveryDraft(null); }}>Очистить localStorage</Button></div></div> : null}</CardHeader><CardContent className="grid gap-4 p-5"><Input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="Поиск по схемам" /><div className="space-y-2 min-w-0"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900">Список схем</div><div className="text-xs text-slate-500">{filteredDocuments.length} / {allDocuments.length}</div></div><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px_36px_48px_32px] items-center gap-1.5 border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"><div>Схема</div><div className="text-center">Узлы</div><div className="text-center">Связи</div><div className="text-center">Предупр.</div><div className="text-center">X</div></div><div className="max-h-[42vh] overflow-auto border-x border-b border-slate-200 bg-slate-50/30 pr-1"><div className="space-y-px bg-slate-200">{filteredDocuments.map((item) => <CompactDocumentRow key={item.id} item={item} selected={item.id === selectedDocumentId} active={item.id === activeDocumentId} onClick={() => { setSelectedDocumentId(item.id); setIsEditingSelectedDocument(false); }} onDelete={() => setPendingDeleteDocument({ id: item.id, name: item.name })} />)}{filteredDocuments.length === 0 ? <div className="border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">Документы последовательных протоколов не найдены.</div> : null}</div></div></div><div className="space-y-3 border-t border-slate-200 pt-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Предпросмотр</div><div className="text-xs text-slate-500">{selectedDocumentId !== null && activeDocumentId === selectedDocumentId ? "Открыто на холсте" : "Выбрано в списке схем"}</div></div>{selectedDocumentId !== null && activeDocumentId === selectedDocumentId ? <Badge variant="success">Активен</Badge> : null}</div>{isEditingSelectedDocument ? <div className="space-y-3 border border-slate-200 p-3"><Input value={selectedDocumentName} onChange={(event) => setSelectedDocumentName(event.target.value)} onBlur={() => { void handleMetadataDraftCommit(); }} onKeyDown={handleMetadataDraftKeyDown} placeholder="Название схемы" disabled={readOnly} /><Input value={selectedDocumentDescription} onChange={(event) => setSelectedDocumentDescription(event.target.value)} onBlur={() => { void handleMetadataDraftCommit(); }} onKeyDown={handleMetadataDraftKeyDown} placeholder="Описание" disabled={readOnly} /><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { void handleSaveSelectedMetadata(); }} disabled={readOnly}><Save className="h-4 w-4" />Сохранить</Button><Button size="sm" variant="outline" onClick={() => setIsEditingSelectedDocument(false)}>Отмена</Button></div></div> : previewDocument ? <DocumentPreviewCard active={activeDocumentId === selectedDocumentId} title={previewTitle} subtitle={previewDescription} updatedAt={previewUpdatedAt} stats={previewStats} /> : <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Выберите схему, чтобы увидеть предпросмотр.</div>}</div></CardContent></Card>;

  return (
    <div className="space-y-4 text-slate-900" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { void handleDropImport(event); }}>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} />
      <Card className="border-slate-200 shadow-none"><CardHeader className="pb-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><CardTitle className="text-xl">{t("pages.serialMap.title")}</CardTitle><CardDescription>Серверное хранение, видимый список схем, menubar над холстом и единая панель свойств.</CardDescription></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Узлы: {document.nodes.length}</Badge><Badge variant="outline">Связи: {document.edges.length}</Badge><Badge variant="outline">Конфликты: {conflicts.length}</Badge><Badge variant={saveStatus === "error" ? "destructive" : saveStatus === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge></div></div><div className="flex flex-wrap gap-2 xl:hidden"><Button size="sm" variant="outline" onClick={() => setIsSidebarDrawerOpen(true)}><PanelLeft className="h-4 w-4" />Контуры</Button><Button size="sm" variant="outline" onClick={() => setIsInspectorDrawerOpen(true)}><PanelRight className="h-4 w-4" />Свойства</Button></div></CardHeader></Card>
      {(message || pendingConnectId) ? <div className={cn("flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm", message?.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800")}><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /><span>{message?.text || "Выберите второй узел для связи."}</span></div>{pendingConnectId ? <Button size="sm" variant="outline" onClick={() => { setPendingConnectId(null); setToolMode("select"); }}>Сбросить</Button> : null}</div> : null}
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start">{sidebarPanel}</div>
        <Card ref={canvasShellRef} className="overflow-hidden border-slate-200 shadow-none">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Menubar className="w-fit">
                  <MenubarMenu>
                    <MenubarTrigger>Правка</MenubarTrigger>
                    <MenubarContent>
                      <MenubarLabel>Выделение</MenubarLabel>
                      <MenubarItem onClick={copySelection} disabled={!canCopySelection}>
                        <span>Копировать</span>
                        <MenubarShortcut>Ctrl/Cmd+C</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem onClick={pasteSelection} disabled={!canPasteSelection}>
                        <span>Вставить</span>
                        <MenubarShortcut>Ctrl/Cmd+V</MenubarShortcut>
                      </MenubarItem>
                      <MenubarSeparator />
                      <MenubarLabel>Изменить</MenubarLabel>
                      <MenubarItem onClick={duplicateSelection} disabled={!canDuplicateSelection}>
                        <span>Дублировать</span>
                        <MenubarShortcut>Ctrl/Cmd+D</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem onClick={() => { setInspectorTab("selection"); if (!isInspectorDrawerOpen) setIsInspectorDrawerOpen(true); }} disabled={!selectedCount}>
                        <span>Редактировать</span>
                      </MenubarItem>
                      <MenubarItem className="text-red-600 hover:bg-red-50" onClick={() => { void deleteSelection(); }} disabled={!canDeleteSelection}>
                        <span>Удалить</span>
                        <MenubarShortcut>Del</MenubarShortcut>
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Вид</MenubarTrigger>
                    <MenubarContent>
                      <MenubarCheckboxItem checked={showMiniMap} onClick={() => setShowMiniMap((value) => !value)}>Миникарта</MenubarCheckboxItem>
                      <MenubarCheckboxItem checked={showGrid} onClick={() => setShowGrid((value) => !value)}>Сетка</MenubarCheckboxItem>
                      <MenubarSeparator />
                      <MenubarItem onClick={resetView} disabled={!hasOpenCanvas}>
                        <span>Сбросить вид</span>
                        <MenubarShortcut>1:1</MenubarShortcut>
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="icon" variant="outline" onClick={undo} disabled={!document.history.past.length} title="Отменить">
                    <ArrowDownUp className="h-4 w-4 rotate-90" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={redo} disabled={!document.history.future.length} title="Повторить">
                    <ArrowDownUp className="h-4 w-4 -rotate-90" />
                  </Button>
                  <div className="mx-1 hidden h-6 w-px bg-slate-200 xl:block" />
                  <Button
                    size="icon"
                    variant={toolMode === "select" ? "default" : "outline"}
                    onClick={() => { setPendingConnectId(null); setToolMode("select"); }}
                    disabled={!hasOpenCanvas}
                    title="Курсор"
                  >
                    <MousePointer2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={toolMode === "pan" ? "default" : "outline"}
                    onClick={() => { setPendingConnectId(null); setToolMode((value) => value === "pan" ? "select" : "pan"); }}
                    disabled={!hasOpenCanvas}
                    title="Рука"
                  >
                    <Hand className="h-4 w-4" />
                  </Button>
                  <div className="mx-1 hidden h-6 w-px bg-slate-200 xl:block" />
                  <Button size="icon" variant="outline" onClick={copySelection} disabled={!canCopySelection} title="Копировать">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={pasteSelection} disabled={!canPasteSelection} title="Вставить">
                    <ClipboardPaste className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={duplicateSelection} disabled={!canDuplicateSelection} title="Дублировать">
                    <CopyPlus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => { void deleteSelection(); }} disabled={!canDeleteSelection} title="Удалить">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="mx-1 hidden h-6 w-px bg-slate-200 xl:block" />
                  <div ref={addNodeMenuRef} className="relative">
                    <Button size="icon" variant="outline" onClick={() => setIsAddNodeMenuOpen((value) => !value)} disabled={readOnly || !hasOpenCanvas} title="Добавить узел">
                      <Plus className="h-4 w-4" />
                    </Button>
                    {isAddNodeMenuOpen ? <div className="absolute left-0 top-full z-20 mt-2 w-44 border border-slate-200 bg-white p-1 shadow-lg">{(["master", "slave", "sensor", "bus", "repeater", "gateway"] as const).map((kind) => <button key={kind} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { addPresetNode(kind); setIsAddNodeMenuOpen(false); }}>{kind === "master" ? "Master" : kind === "slave" ? "Slave" : kind === "sensor" ? "Sensor" : kind === "bus" ? "Bus" : kind === "repeater" ? "Repeater" : "Gateway"}</button>)}</div> : null}
                  </div>
                  <Button
                    size="icon"
                    variant={toolMode === "connect" ? "default" : "outline"}
                    onClick={() => setToolMode((value) => value === "connect" ? "select" : "connect")}
                    disabled={readOnly || !hasOpenCanvas}
                    title="Режим связи"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => { mutateCurrentDocument((current) => autoLayoutDocument(current)); commitUserAction(); }} disabled={!hasOpenCanvas} title="Автораскладка">
                    <Rows3 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={fitView} disabled={!hasOpenCanvas} title="Уместить">
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => void toggleFullscreen()} disabled={!hasOpenCanvas} title={isFullscreen ? "Свернуть из полноэкранного режима" : "Развернуть на весь экран"}>
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 xl:items-end">
                <div ref={searchPanelRef} className="relative min-w-0 xl:w-[280px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" value={canvasSearch} onChange={(event) => { setCanvasSearch(event.target.value); setIsSearchResultsOpen(event.target.value.trim().length > 0); }} onFocus={() => setIsSearchResultsOpen(canvasSearch.trim().length > 0)} placeholder="Поиск узлов по имени, адресу и протоколу" />
                  {canvasSearch.trim() && isSearchResultsOpen ? <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-full overflow-auto border border-slate-200 bg-white shadow-lg">{searchResults.length ? searchResults.map((node) => <button key={node.id} type="button" className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0" onClick={() => focusSearchResult(node.id)}><div className="truncate text-sm font-semibold text-slate-900">{resolveNodeName(node, equipmentMap)}</div><div className="mt-1 text-xs text-slate-500">{node.kind.toUpperCase()} • {node.protocol}{node.address !== null ? ` • А ${node.address}` : ""}</div></button>) : <div className="px-3 py-3 text-sm text-slate-500">Совпадений не найдено.</div>}</div> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Выбор: {selectedCount}</Badge>
                  <Badge variant="outline">{Math.round(document.viewport.zoom * 100)}%</Badge>
                  <Badge variant={saveStatus === "error" ? "destructive" : saveStatus === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge>
                </div>
              </div>
            </div>
          </div>
          <CardHeader className="flex-row items-center justify-between space-y-0"><div className="min-w-0"><CardTitle>Холст последовательных протоколов</CardTitle><CardDescription>{visibleNodes.length} видимых узлов, {document.edges.length} видимых связей</CardDescription></div></CardHeader>
          <CardContent className="p-0">
            <div ref={wrapperRef} onWheel={handleWheel} onPointerDown={beginCanvasInteraction} className={cn("relative h-[calc(100vh-260px)] min-h-[680px] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(239,246,255,0.95))]", isFullscreen && "h-screen min-h-screen bg-white")}>
              {!hasOpenCanvas ? <EmptyCanvasState title={allDocuments.length > 0 ? "Нет открытой схемы" : "Документы последовательных протоколов не найдены"} description={allDocuments.length > 0 ? "Выберите схему в файловом sidebar и нажмите Открыть." : "Создайте новую схему или импортируйте JSON, чтобы начать."} primaryAction={allDocuments.length > 0 ? <Button size="sm" onClick={openSelectedDocument} disabled={selectedDocumentId === null}>Открыть</Button> : <Button size="sm" onClick={openCreateDialog} disabled={readOnly}><Plus className="h-4 w-4" />Новая схема</Button>} secondaryAction={<Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={readOnly}><Upload className="h-4 w-4" />Импорт</Button>} /> : null}
              <svg width="100%" height="100%" style={{ display: "block" }}>
                <defs><pattern id="serial-grid" width={showGrid ? 32 : 99999} height={showGrid ? 32 : 99999} patternUnits="userSpaceOnUse"><path d={`M ${showGrid ? 32 : 99999} 0 L 0 0 0 ${showGrid ? 32 : 99999}`} fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.75" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#serial-grid)" />
                <g transform={`translate(${document.viewport.x} ${document.viewport.y}) scale(${document.viewport.zoom})`}>
                  {document.edges.map((edge) => <g key={edge.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeIds([]); setInspectorTab("selection"); }}><path d={edgePath(edge)} fill="none" stroke={selectedEdgeId === edge.id ? "#2563eb" : "#64748b"} strokeWidth={selectedEdgeId === edge.id ? 4 : 3} strokeLinecap="round" /><text x={(centerOf(document.nodes.find((n) => n.id === edge.fromNodeId) || document.nodes[0]).x + centerOf(document.nodes.find((n) => n.id === edge.toNodeId) || document.nodes[0]).x) / 2} y={(centerOf(document.nodes.find((n) => n.id === edge.fromNodeId) || document.nodes[0]).y + centerOf(document.nodes.find((n) => n.id === edge.toNodeId) || document.nodes[0]).y) / 2 - 10} fill="#334155" fontSize="12" fontWeight="700">{edge.label || edge.protocol}</text></g>)}
                  {document.nodes.map((node) => { const colors = palette[node.kind]; const active = selectedNodeIds.includes(node.id); const protocol = getProtocolMeta(node.protocol); return <g key={node.id} transform={`translate(${node.position.x} ${node.position.y})`} onPointerDown={(event) => beginNodeInteraction(event, node.id)} style={{ cursor: toolMode === "connect" ? "crosshair" : "grab" }}><rect width={node.width} height={node.height} fill={colors.fill} stroke={active ? "#2563eb" : colors.stroke} strokeWidth={active ? 4 : 2.2} filter={active ? "drop-shadow(0 12px 18px rgba(37,99,235,0.18))" : "drop-shadow(0 10px 18px rgba(15,23,42,0.10))"} /><rect width={node.width} height="28" fill={colors.head} /><text x="16" y="19" fill="#0f172a" fontSize="13" fontWeight="800">{node.kind.toUpperCase()}</text><text x="16" y="50" fill="#0f172a" fontSize="16" fontWeight="800">{resolveNodeName(node, equipmentMap)}</text><text x="16" y="69" fill="#475569" fontSize="12" fontWeight="700">{node.protocol}{node.address !== null ? ` • А ${node.address}` : ""}</text><text x="16" y="84" fill="#64748b" fontSize="11" fontWeight="700">{protocol.baudRates.includes(node.baudRate) ? `${node.baudRate} bit/s` : `${node.baudRate}`}</text>{pendingConnectId === node.id ? <circle cx={node.width - 18} cy={16} r={7} fill="#2563eb" /> : null}</g>; })}
                  {logicalSelectionRect ? <rect x={logicalSelectionRect.x} y={logicalSelectionRect.y} width={logicalSelectionRect.width} height={logicalSelectionRect.height} fill="rgba(37,99,235,0.12)" stroke="#2563eb" strokeDasharray="8 6" /> : null}
                </g>
              </svg>
              {isFullscreen ? <div className="absolute right-4 top-4 z-20 w-[min(360px,calc(100vw-32px))]" onPointerDown={(event) => event.stopPropagation()}>{inspectorPanel}</div> : null}
              {showMiniMap ? <Card className="absolute bottom-4 right-4 w-[190px] rounded-none border-slate-200 bg-white/95 shadow-sm"><CardContent className="p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Миникарта</div><svg width="100%" height="120" viewBox={`${miniMapViewBox.x} ${miniMapViewBox.y} ${miniMapViewBox.width} ${miniMapViewBox.height}`} onPointerDown={handleMiniMapPointerDown} style={{ cursor: "pointer" }}>{document.edges.map((edge) => <path key={edge.id} d={edgePath(edge)} fill="none" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />)}{document.nodes.map((node) => <rect key={node.id} x={node.position.x} y={node.position.y} width={node.width} height={node.height} fill={selectedNodeIds.includes(node.id) ? "#93c5fd" : "#e2e8f0"} stroke="#64748b" strokeWidth="3" onPointerDown={(event) => { event.stopPropagation(); focusNode(node.id); }} style={{ cursor: "pointer" }} />)}{miniMapViewportRect ? <rect x={miniMapViewportRect.x} y={miniMapViewportRect.y} width={miniMapViewportRect.width} height={miniMapViewportRect.height} fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth="4" pointerEvents="none" /> : null}</svg></CardContent></Card> : null}
              <div className="pointer-events-none absolute bottom-4 left-4 border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-500 shadow-sm"><div className="flex items-center gap-2"><Grip className="h-3.5 w-3.5" /> Панорама: drag по пустому холсту или wheel</div><div className="mt-1 flex items-center gap-2"><ArrowDownUp className="h-3.5 w-3.5" /> Выбор: клик, Shift-мультивыбор или рамка</div><div className="mt-1 flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Связи: режим Connect в menubar</div></div>
            </div>
          </CardContent>
        </Card>
        {!isFullscreen ? <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-24px)]">{inspectorPanel}</div> : null}
      </div>
      {isCreateDialogOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onClick={() => setIsCreateDialogOpen(false)}><div className="w-full max-w-md border border-slate-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="text-lg font-semibold text-slate-900">Новая схема</div><div className="mt-1 text-sm text-slate-500">Укажите имя новой карты последовательных протоколов перед созданием серверного документа.</div><div className="mt-4 space-y-3"><div className="space-y-1.5"><div className="text-sm font-medium text-slate-900">Название</div><Input value={createNameDraft} onChange={(event) => setCreateNameDraft(event.target.value)} placeholder="Название схемы" autoFocus /></div><div className="space-y-1.5"><div className="text-sm font-medium text-slate-900">Описание</div><Input value={createDescriptionDraft} onChange={(event) => setCreateDescriptionDraft(event.target.value)} placeholder="Описание (необязательно)" /></div></div><div className="mt-5 flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button><Button size="sm" onClick={() => { void handleCreateDocumentConfirm(); }} disabled={!createNameDraft.trim() || readOnly}><Plus className="h-4 w-4" />Создать</Button></div></div></div> : null}
      {pendingDeleteDocument ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onClick={() => setPendingDeleteDocument(null)}><div className="w-full max-w-md border border-slate-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="text-lg font-semibold text-slate-900">Удалить схему?</div><div className="mt-2 text-sm text-slate-500">Схема <span className="font-semibold text-slate-900">"{pendingDeleteDocument.name}"</span> будет удалена с сервера. Это действие нельзя отменить.</div><div className="mt-5 flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setPendingDeleteDocument(null)}>Отмена</Button><Button size="sm" variant="destructive" onClick={() => { void handleDeleteDocument(pendingDeleteDocument.id); }} disabled={readOnly}><Trash2 className="h-4 w-4" />Удалить</Button></div></div></div> : null}
      {isSidebarDrawerOpen ? <div className="fixed inset-0 z-50 bg-slate-900/35 xl:hidden" onClick={() => setIsSidebarDrawerOpen(false)}><div className="h-full w-[min(92vw,360px)] bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Контуры</div><Button size="sm" variant="outline" onClick={() => setIsSidebarDrawerOpen(false)}>Закрыть</Button></div>{sidebarPanel}</div></div> : null}
      {isInspectorDrawerOpen ? <div className="fixed inset-0 z-50 bg-slate-900/35 xl:hidden" onClick={() => setIsInspectorDrawerOpen(false)}><div className="ml-auto h-full w-[min(94vw,420px)] bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Свойства</div><Button size="sm" variant="outline" onClick={() => setIsInspectorDrawerOpen(false)}>Закрыть</Button></div>{inspectorPanel}</div></div> : null}
    </div>
  );
}
