import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  Hand,
  Layers3,
  Link2,
  Maximize2,
  Minimize2,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Plus,
  Shapes,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import { getToken } from "../api/client";
import { usePidApi } from "../api/pid";
import { SearchableTreeSelectField, type SearchableTreeSelectOption } from "../components/SearchableTreeSelectField";
import { PidCanvas, type PidCanvasHandle } from "../components/pid/PidCanvas";
import { PidEquipmentListTab } from "../components/pid/PidEquipmentListTab";
import { PidPropertiesPanel } from "../components/pid/PidPropertiesPanel";
import { PidToolbox, type PidEditorMode, type PidNodeInsertPreset } from "../components/pid/PidToolbox";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "../components/ui/menubar";
import { useAuth } from "../context/AuthContext";
import { exportPidDiagramJson, validatePidDiagramImport } from "../features/pid/io";
import { cn } from "../lib/utils";
import type { PidDiagram, PidEdge, PidNode, PidProcess } from "../types/pid";
import { fetchLocationsTree } from "../utils/locations";
import { fetchMainEquipmentTree, type MainEquipmentTreeNode } from "../utils/mainEquipment";

type TreeNode = { id: number; name: string; children?: TreeNode[] };
type SaveStatus = "idle" | "saving" | "saved" | "error";
type InspectorTab = "properties" | "nodes" | "palette";
type ClipboardPayload = { nodes: PidNode[]; edges: PidEdge[] };
type DiagramHistory = { past: PidDiagram[]; future: PidDiagram[] };
type ProcessStats = { nodes: number; edges: number; updatedAt: string };

const sidebarActionButtonClass =
  "h-auto min-h-11 justify-center px-2.5 py-2 text-center text-[12px] leading-snug whitespace-normal [word-break:break-word]";

const emptyDiagram = (processId: number): PidDiagram => ({
  processId,
  version: 1,
  updatedAt: new Date().toISOString(),
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
});

function cloneDiagram(value: PidDiagram): PidDiagram {
  return {
    ...value,
    viewport: { ...value.viewport },
    nodes: value.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      sourceRef: node.sourceRef ? { ...node.sourceRef, meta: node.sourceRef.meta ? { ...node.sourceRef.meta } : undefined } : null,
      properties: {
        ...node.properties,
        meta: node.properties.meta ? { ...node.properties.meta } : undefined,
      },
    })),
    edges: value.edges.map((edge) => ({ ...edge, style: edge.style ? { ...edge.style } : {} })),
  };
}

function normalizeImportedDiagram(processId: number, diagram: PidDiagram): PidDiagram {
  return {
    ...cloneDiagram(diagram),
    processId,
    updatedAt: new Date().toISOString(),
  };
}

function isTextInputTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable;
}

function getFileBaseName(name: string) {
  const trimmed = name.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  return dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
}

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function processStatsOf(diagram: PidDiagram): ProcessStats {
  return {
    nodes: diagram.nodes.length,
    edges: diagram.edges.length,
    updatedAt: diagram.updatedAt,
  };
}

function buildLocationOptions(nodes: TreeNode[]): SearchableTreeSelectOption[] {
  return nodes.map((node) => ({
    value: node.id,
    label: node.name,
    children: node.children ? buildLocationOptions(node.children) : undefined,
  }));
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
  stats: { nodes: number; edges: number };
}) {
  const previewNodes = Array.from({ length: Math.min(stats.nodes, 5) }, (_, index) => ({
    left: 16 + (index % 3) * 18 + (index > 2 ? 10 : 0),
    top: index < 3 ? 14 : 34,
  }));

  return (
    <div
      className={cn(
        "w-full border p-3.5 text-left transition",
        active
          ? "border-slate-900 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
          : "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]"
      )}
    >
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
                {index > 0 ? (
                  <path
                    d={`M${previewNodes[index - 1].left + 6} ${previewNodes[index - 1].top + 6} L${node.left + 6} ${node.top + 6}`}
                    stroke={active ? "rgba(255,255,255,0.38)" : "#94a3b8"}
                    strokeWidth="1.35"
                  />
                ) : null}
                <circle cx={node.left + 6} cy={node.top + 6} r="5" fill={active ? "rgba(255,255,255,0.1)" : "#e2e8f0"} />
                <circle cx={node.left + 6} cy={node.top + 6} r="3.2" fill={active ? "#ffffff" : "#64748b"} />
              </g>
            ))}
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className={cn("min-w-0 px-2 py-1.5", active ? "bg-white/8" : "bg-slate-50")}>
            <div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>Узлы</div>
            <div className="mt-1 text-sm font-semibold">{stats.nodes}</div>
          </div>
          <div className={cn("min-w-0 px-2 py-1.5", active ? "bg-white/8" : "bg-slate-50")}>
            <div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>Связи</div>
            <div className="mt-1 text-sm font-semibold">{stats.edges}</div>
          </div>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-slate-400">{updatedAt}</div>
    </div>
  );
}

function CompactProcessRow({
  item,
  selected,
  active,
  stats,
  onClick,
  onDelete,
}: {
  item: PidProcess;
  selected: boolean;
  active: boolean;
  stats?: ProcessStats | null;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_36px_36px_32px] items-center gap-1.5 border-l-2 px-2.5 py-2.5 text-left text-[12px] transition",
        selected
          ? "border-l-slate-900 border-y-slate-900 border-r-slate-900 bg-slate-900 text-white"
          : "border-l-slate-300 border-y-slate-200 border-r-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      )}
      onClick={onClick}
      title={item.name}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold" title={item.name}>
            {item.name}
          </div>
          {active ? <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">LIVE</Badge> : null}
        </div>
        <div className={cn("mt-1 truncate text-[10px]", selected ? "text-slate-300" : "text-slate-500")}>
          {item.description || "Без описания"}
        </div>
      </div>
      <div className={cn("text-center font-semibold", selected ? "text-white" : "text-slate-700")}>{stats?.nodes ?? "-"}</div>
      <div className={cn("text-center font-semibold", selected ? "text-white" : "text-slate-700")}>{stats?.edges ?? "-"}</div>
      <button
        type="button"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center border text-slate-500 transition hover:text-red-600",
          selected ? "border-white/20 hover:bg-white/10" : "border-slate-200 hover:bg-red-50"
        )}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        title={`Удалить процесс "${item.name}"`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </button>
  );
}

function EmptyCanvasState({
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
      <div className="w-full max-w-md border border-slate-200 bg-white p-6 text-center shadow-lg">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="mt-2 text-sm text-slate-500">{description}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      </div>
    </div>
  );
}

export default function TechnologicalEquipmentPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const pidApi = usePidApi();
  const queryClient = useQueryClient();

  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const readOnly = !canWrite;

  const canvasRef = useRef<PidCanvasHandle | null>(null);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const diagramRef = useRef<PidDiagram | null>(null);
  const propertyEditKeyRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedFingerprintRef = useRef<string | null>(null);
  const lastSavedFingerprintRef = useRef<string | null>(null);

  const [locationId, setLocationId] = useState<number | "">("");
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<number | null>(null);
  const [diagram, setDiagram] = useState<PidDiagram | null>(null);
  const [history, setHistory] = useState<DiagramHistory>({ past: [], future: [] });
  const [clipboard, setClipboard] = useState<ClipboardPayload | null>(null);
  const [toolMode, setToolMode] = useState<PidEditorMode>("select");
  const [edgeType, setEdgeType] = useState<PidEdge["edgeType"]>("process");
  const [pendingPreset, setPendingPreset] = useState<PidNodeInsertPreset | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [processSearch, setProcessSearch] = useState("");
  const [canvasSearch, setCanvasSearch] = useState("");
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [autosaveBlocked, setAutosaveBlocked] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createNameDraft, setCreateNameDraft] = useState("Новая схема технологического оборудования");
  const [createDescriptionDraft, setCreateDescriptionDraft] = useState("");
  const [selectedProcessName, setSelectedProcessName] = useState("");
  const [selectedProcessDescription, setSelectedProcessDescription] = useState("");
  const [isEditingSelectedProcess, setIsEditingSelectedProcess] = useState(false);
  const [statsMap, setStatsMap] = useState<Record<number, ProcessStats>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [isInspectorDrawerOpen, setIsInspectorDrawerOpen] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const autoFitProcessRef = useRef<number | null>(null);

  const getDiagramFingerprint = useCallback(
    (value: PidDiagram) =>
      JSON.stringify({
        processId: value.processId,
        viewport: {
          x: Math.round(value.viewport.x * 1000) / 1000,
          y: Math.round(value.viewport.y * 1000) / 1000,
          zoom: Math.round(value.viewport.zoom * 1000) / 1000,
        },
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
      }),
    []
  );

  const updateStats = useCallback((processId: number, nextDiagram: PidDiagram) => {
    setStatsMap((current) => ({
      ...current,
      [processId]: processStatsOf(nextDiagram),
    }));
  }, []);

  const loadDiagramIntoCanvas = useCallback(
    (nextDiagram: PidDiagram | null, options?: { resetHistory?: boolean }) => {
      const normalized = nextDiagram ? cloneDiagram(nextDiagram) : null;
      diagramRef.current = normalized;
      setDiagram(normalized);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      propertyEditKeyRef.current = null;
      if (options?.resetHistory ?? true) {
        setHistory({ past: [], future: [] });
      }
    },
    []
  );

  const checkpointCurrentDiagram = useCallback(() => {
    const current = diagramRef.current;
    if (!current) return;
    const snapshot = cloneDiagram(current);
    const fingerprint = getDiagramFingerprint(snapshot);
    setHistory((previous) => {
      const tail = previous.past[previous.past.length - 1];
      if (tail && getDiagramFingerprint(tail) === fingerprint) {
        return previous;
      }
      return {
        past: [...previous.past, snapshot].slice(-100),
        future: [],
      };
    });
  }, [getDiagramFingerprint]);

  const applyDiagram = useCallback(
    (nextDiagram: PidDiagram) => {
      const normalized = cloneDiagram(nextDiagram);
      diagramRef.current = normalized;
      setDiagram(normalized);
      updateStats(normalized.processId, normalized);
    },
    [updateStats]
  );

  const ensurePropertyCheckpoint = useCallback(
    (key: string) => {
      if (propertyEditKeyRef.current === key) return;
      checkpointCurrentDiagram();
      propertyEditKeyRef.current = key;
    },
    [checkpointCurrentDiagram]
  );

  const locationsQuery = useQuery({
    queryKey: ["pid-locations"],
    queryFn: () => fetchLocationsTree(false),
  });

  const mainEquipmentQuery = useQuery({
    queryKey: ["pid-main-equipment-tree"],
    queryFn: () => fetchMainEquipmentTree(false),
  });

  const processesQuery = useQuery({
    queryKey: ["pid-processes", locationId],
    queryFn: () => pidApi.fetchProcesses(Number(locationId)),
    enabled: Boolean(locationId),
  });

  const activeDiagramQuery = useQuery({
    queryKey: ["pid-diagram", activeProcessId],
    queryFn: () => pidApi.fetchDiagram(activeProcessId!),
    enabled: activeProcessId !== null,
  });

  const selectedPreviewQuery = useQuery({
    queryKey: ["pid-diagram", selectedProcessId],
    queryFn: () => pidApi.fetchDiagram(selectedProcessId!),
    enabled: selectedProcessId !== null && selectedProcessId !== activeProcessId,
  });

  useEffect(() => {
    diagramRef.current = diagram;
  }, [diagram]);

  useEffect(() => {
    if (message === null) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === canvasShellRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!activeDiagramQuery.data) return;
    lastSavedFingerprintRef.current = getDiagramFingerprint(activeDiagramQuery.data);
    setSaveStatus("idle");
    setAutosaveBlocked(false);
    updateStats(activeDiagramQuery.data.processId, activeDiagramQuery.data);
    loadDiagramIntoCanvas(activeDiagramQuery.data);
  }, [activeDiagramQuery.data, getDiagramFingerprint, loadDiagramIntoCanvas, updateStats]);

  useEffect(() => {
    if (!selectedPreviewQuery.data) return;
    updateStats(selectedPreviewQuery.data.processId, selectedPreviewQuery.data);
  }, [selectedPreviewQuery.data, updateStats]);

  useEffect(() => {
    if (!diagram) {
      setHasUnsavedChanges(false);
      return;
    }
    setHasUnsavedChanges(getDiagramFingerprint(diagram) !== lastSavedFingerprintRef.current);
  }, [diagram, getDiagramFingerprint]);

  useEffect(() => {
    setSelectedProcessId(null);
    setActiveProcessId(null);
    loadDiagramIntoCanvas(null);
    setAutosaveBlocked(false);
    setSaveStatus("idle");
    lastSavedFingerprintRef.current = null;
    setStatsMap({});
  }, [locationId, loadDiagramIntoCanvas]);

  useEffect(() => {
    const selected = (processesQuery.data || []).find((item) => item.id === selectedProcessId) || null;
    setSelectedProcessName(selected?.name || "");
    setSelectedProcessDescription(selected?.description || "");
    setIsEditingSelectedProcess(false);
  }, [processesQuery.data, selectedProcessId]);

  useEffect(() => {
    propertyEditKeyRef.current = null;
  }, [selectedNodeIds, selectedEdgeId, activeProcessId]);

  useEffect(() => {
    if (activeProcessId === null) {
      autoFitProcessRef.current = null;
      return;
    }
    if (!diagram || diagram.processId !== activeProcessId || !diagram.nodes.length) return;
    if (autoFitProcessRef.current === activeProcessId) return;
    autoFitProcessRef.current = activeProcessId;
    const timer = window.setTimeout(() => {
      canvasRef.current?.fitView();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeProcessId, diagram]);

  useEffect(() => {
    if (!diagram || !activeProcessId || !canWrite || autosaveBlocked || saveInFlightRef.current) return;
    if (!getToken()) {
      setAutosaveBlocked(true);
      return;
    }

    const snapshot = cloneDiagram(diagram);
    const fingerprint = getDiagramFingerprint(snapshot);
    if (fingerprint === lastSavedFingerprintRef.current) return;
    if (fingerprint === saveQueuedFingerprintRef.current) return;

    saveQueuedFingerprintRef.current = fingerprint;
    setSaveStatus("saving");

    const timeout = window.setTimeout(() => {
      saveInFlightRef.current = true;
      pidApi
        .saveDiagram(snapshot.processId, snapshot)
        .then((saved) => {
          lastSavedFingerprintRef.current = getDiagramFingerprint(saved);
          setAutosaveBlocked(false);
          setSaveStatus("saved");
          updateStats(saved.processId, saved);
          queryClient.setQueryData(["pid-diagram", saved.processId], saved);
        })
        .catch((error: Error & { status?: number }) => {
          if (error.status === 401) {
            setAutosaveBlocked(true);
          }
          setSaveStatus("error");
        })
        .finally(() => {
          saveInFlightRef.current = false;
          saveQueuedFingerprintRef.current = null;
        });
    }, 900);

    return () => {
      window.clearTimeout(timeout);
      if (saveQueuedFingerprintRef.current === fingerprint) {
        saveQueuedFingerprintRef.current = null;
      }
    };
  }, [activeProcessId, autosaveBlocked, canWrite, diagram, getDiagramFingerprint, pidApi, queryClient, updateStats]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          setHistory((current) => {
            if (!current.future.length || !diagramRef.current) return current;
            const [next, ...rest] = current.future;
            const active = cloneDiagram(diagramRef.current);
            loadDiagramIntoCanvas(next, { resetHistory: false });
            return {
              past: [...current.past, active].slice(-100),
              future: rest,
            };
          });
        } else {
          setHistory((current) => {
            if (!current.past.length || !diagramRef.current) return current;
            const previous = current.past[current.past.length - 1];
            const active = cloneDiagram(diagramRef.current);
            loadDiagramIntoCanvas(previous, { resetHistory: false });
            return {
              past: current.past.slice(0, -1),
              future: [active, ...current.future].slice(0, 100),
            };
          });
        }
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        setHistory((current) => {
          if (!current.future.length || !diagramRef.current) return current;
          const [next, ...rest] = current.future;
          const active = cloneDiagram(diagramRef.current);
          loadDiagramIntoCanvas(next, { resetHistory: false });
          return {
            past: [...current.past, active].slice(-100),
            future: rest,
          };
        });
        return;
      }
      if (isTextInputTarget(event.target)) return;
      if (modifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
        return;
      }
      if (modifier && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteSelection();
        return;
      }
      if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        void deleteSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (searchPanelRef.current && target && !searchPanelRef.current.contains(target)) {
        setIsSearchResultsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const activeProcesses = useMemo(
    () => ((processesQuery.data || []) as PidProcess[]).filter((item) => !item.is_deleted),
    [processesQuery.data]
  );

  const filteredProcesses = useMemo(() => {
    const query = processSearch.trim().toLowerCase();
    if (!query) return activeProcesses;
    return activeProcesses.filter(
      (item) => item.name.toLowerCase().includes(query) || (item.description || "").toLowerCase().includes(query)
    );
  }, [activeProcesses, processSearch]);

  const selectedProcess = useMemo(
    () => activeProcesses.find((item) => item.id === selectedProcessId) || null,
    [activeProcesses, selectedProcessId]
  );

  const previewDiagram =
    selectedProcessId !== null && selectedProcessId === activeProcessId ? diagram : selectedPreviewQuery.data || null;
  const previewStats = previewDiagram
    ? processStatsOf(previewDiagram)
    : selectedProcessId !== null
      ? statsMap[selectedProcessId]
      : null;

  const saveStateLabel =
    saveStatus === "saving"
      ? "Сохранение..."
      : saveStatus === "saved"
        ? "Сохранено"
        : saveStatus === "error"
          ? "Ошибка сохранения"
          : hasUnsavedChanges
            ? "Есть изменения"
            : "Без изменений";

  const searchResults = useMemo(() => {
    if (!diagram) return [];
    const query = canvasSearch.trim().toLowerCase();
    if (!query) return [];
    return diagram.nodes.filter((node) =>
      [node.label, node.tag, node.symbolKey].some((part) => part.toLowerCase().includes(query))
    );
  }, [canvasSearch, diagram]);

  const selectedNode =
    diagram && selectedNodeIds.length === 1 ? diagram.nodes.find((node) => node.id === selectedNodeIds[0]) || null : null;
  const selectedEdge =
    diagram && selectedEdgeId ? diagram.edges.find((edge) => edge.id === selectedEdgeId) || null : null;

  const canCopySelection = Boolean(diagram && selectedNodeIds.length > 0);
  const canPasteSelection = Boolean(diagram && clipboard && !readOnly);
  const canDuplicateSelection = Boolean(diagram && selectedNodeIds.length > 0 && !readOnly);
  const canDeleteSelection = Boolean(diagram && (selectedNodeIds.length > 0 || selectedEdgeId) && !readOnly);
  const hasOpenCanvas = Boolean(activeProcessId && diagram);

  const openCreateDialog = () => {
    setCreateNameDraft("Новая схема технологического оборудования");
    setCreateDescriptionDraft("");
    setIsCreateDialogOpen(true);
  };

  const openSelectedProcess = () => {
    if (selectedProcessId === null) return;
    setActiveProcessId(selectedProcessId);
    const cached = queryClient.getQueryData<PidDiagram>(["pid-diagram", selectedProcessId]);
    if (cached) {
      lastSavedFingerprintRef.current = getDiagramFingerprint(cached);
      setAutosaveBlocked(false);
      setSaveStatus("idle");
      loadDiagramIntoCanvas(cached);
    } else {
      loadDiagramIntoCanvas(null);
    }
  };

  const handleCreateProcessConfirm = async () => {
    if (!locationId || !createNameDraft.trim()) return;
    try {
      const created = await pidApi.createProcess(Number(locationId), {
        name: createNameDraft.trim(),
        description: createDescriptionDraft.trim() || null,
      });
      const initialDiagram = emptyDiagram(created.id);
      queryClient.invalidateQueries({ queryKey: ["pid-processes", locationId] });
      queryClient.setQueryData(["pid-diagram", created.id], initialDiagram);
      setSelectedProcessId(created.id);
      setActiveProcessId(created.id);
      lastSavedFingerprintRef.current = getDiagramFingerprint(initialDiagram);
      setSaveStatus("idle");
      setAutosaveBlocked(false);
      updateStats(created.id, initialDiagram);
      loadDiagramIntoCanvas(initialDiagram);
      setIsCreateDialogOpen(false);
      setMessage({ tone: "info", text: "Новый процесс создан." });
    } catch {
      setMessage({ tone: "warning", text: "Не удалось создать процесс." });
    }
  };

  const handleDeleteSelectedProcess = async () => {
    if (selectedProcessId === null || readOnly) return;
    const process = activeProcesses.find((item) => item.id === selectedProcessId);
    if (!process) return;
    const confirmed = window.confirm(`Удалить процесс "${process.name}"?`);
    if (!confirmed) return;
    try {
      await pidApi.deleteProcess(selectedProcessId);
      queryClient.invalidateQueries({ queryKey: ["pid-processes", locationId] });
      if (activeProcessId === selectedProcessId) {
        setActiveProcessId(null);
        loadDiagramIntoCanvas(null);
        lastSavedFingerprintRef.current = null;
      }
      setSelectedProcessId(null);
      setMessage({ tone: "info", text: "Процесс удалён." });
    } catch {
      setMessage({ tone: "warning", text: "Не удалось удалить процесс." });
    }
  };

  const handleSaveSelectedMetadata = async () => {
    if (selectedProcessId === null || readOnly) return;
    try {
      const updated = await pidApi.updateProcess(selectedProcessId, {
        name: selectedProcessName.trim(),
        description: selectedProcessDescription.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["pid-processes", locationId] });
      setSelectedProcessName(updated.name);
      setSelectedProcessDescription(updated.description || "");
      setIsEditingSelectedProcess(false);
      setMessage({ tone: "info", text: "Данные процесса обновлены." });
    } catch {
      setMessage({ tone: "warning", text: "Не удалось сохранить данные процесса." });
    }
  };

  const exportActiveProcess = () => {
    if (!diagram || !activeProcessId) return;
    const processName = activeProcesses.find((item) => item.id === activeProcessId)?.name || "pid-process";
    download(`${processName}.json`, exportPidDiagramJson(diagram), "application/json;charset=utf-8");
  };

  const handleImportInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !locationId) return;
    try {
      const text = await file.text();
      const imported = validatePidDiagramImport(JSON.parse(text));
      const created = await pidApi.createProcess(Number(locationId), {
        name: getFileBaseName(file.name),
      });
      const normalized = normalizeImportedDiagram(created.id, imported);
      const saved = await pidApi.saveDiagram(created.id, normalized);
      queryClient.invalidateQueries({ queryKey: ["pid-processes", locationId] });
      queryClient.setQueryData(["pid-diagram", created.id], saved);
      setSelectedProcessId(created.id);
      setActiveProcessId(created.id);
      lastSavedFingerprintRef.current = getDiagramFingerprint(saved);
      setSaveStatus("saved");
      updateStats(created.id, saved);
      loadDiagramIntoCanvas(saved);
      setMessage({ tone: "info", text: "JSON импортирован в новый процесс." });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Не удалось импортировать JSON.";
      setMessage({ tone: "warning", text });
    }
  };

  const updateSelection = (next: { nodeIds: string[]; edgeId: string | null }) => {
    setSelectedNodeIds(next.nodeIds);
    setSelectedEdgeId(next.edgeId);
    if (next.nodeIds.length > 0 || next.edgeId) {
      setInspectorTab("properties");
    }
  };

  const buildClipboardPayload = () => {
    if (!diagram || !selectedNodeIds.length) return null;
    const nodeSet = new Set(selectedNodeIds);
    return {
      nodes: diagram.nodes.filter((node) => nodeSet.has(node.id)).map((node) => ({ ...node, position: { ...node.position } })),
      edges: diagram.edges
        .filter((edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target))
        .map((edge) => ({ ...edge, style: edge.style ? { ...edge.style } : {} })),
    } satisfies ClipboardPayload;
  };

  const copySelection = () => {
    const payload = buildClipboardPayload();
    if (!payload) return;
    setClipboard(payload);
    setMessage({ tone: "info", text: `Скопировано узлов: ${payload.nodes.length}.` });
  };

  const pastePayload = (payload: ClipboardPayload | null) => {
    if (!diagram || !payload || readOnly) return;
    checkpointCurrentDiagram();
    const now = Date.now();
    const idMap = new Map<string, string>();
    const nextNodes = payload.nodes.map((node, index) => {
      const id = `${node.id}_copy_${now}_${index}`;
      idMap.set(node.id, id);
      return {
        ...node,
        id,
        position: {
          x: node.position.x + 40,
          y: node.position.y + 40,
        },
      };
    });
    const nextEdges = payload.edges
      .map((edge, index) => {
        const source = idMap.get(edge.source);
        const target = idMap.get(edge.target);
        if (!source || !target) return null;
        return {
          ...edge,
          id: `${edge.id}_copy_${now}_${index}`,
          source,
          target,
        };
      })
      .filter(Boolean) as PidEdge[];
    const nextDiagram: PidDiagram = {
      ...diagram,
      nodes: [...diagram.nodes, ...nextNodes],
      edges: [...diagram.edges, ...nextEdges],
      updatedAt: new Date().toISOString(),
    };
    setSelectedNodeIds(nextNodes.map((node) => node.id));
    setSelectedEdgeId(null);
    applyDiagram(nextDiagram);
    setMessage({ tone: "info", text: `Вставлено узлов: ${nextNodes.length}.` });
  };

  const pasteSelection = () => {
    pastePayload(clipboard);
  };

  const duplicateSelection = () => {
    const payload = buildClipboardPayload();
    if (!payload) return;
    setClipboard(payload);
    pastePayload(payload);
  };

  const deleteSelection = async () => {
    if (!diagram || readOnly || (!selectedNodeIds.length && !selectedEdgeId)) return;
    checkpointCurrentDiagram();
    const nodeSet = new Set(selectedNodeIds);
    const nextDiagram: PidDiagram = {
      ...diagram,
      nodes: diagram.nodes.filter((node) => !nodeSet.has(node.id)),
      edges: diagram.edges.filter(
        (edge) => edge.id !== selectedEdgeId && !nodeSet.has(edge.source) && !nodeSet.has(edge.target)
      ),
      updatedAt: new Date().toISOString(),
    };
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    applyDiagram(nextDiagram);
  };

  const focusSearchResult = (nodeId: string) => {
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeId(null);
    setInspectorTab("properties");
    canvasRef.current?.focusNode(nodeId);
    setIsSearchResultsOpen(false);
  };

  const toggleFullscreen = async () => {
    try {
      const target = canvasShellRef.current;
      if (!target) return;
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch {
      setMessage({ tone: "warning", text: "Не удалось переключить полноэкранный режим." });
    }
  };

  const activeProcessStats = activeProcessId && diagram ? processStatsOf(diagram) : null;
  const previewUpdatedAt = selectedProcess?.updated_at ? new Date(selectedProcess.updated_at).toLocaleString() : "Нет данных";

  const handleMetadataDraftKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSaveSelectedMetadata();
    }
  };

  const sidebarPanel = (
    <Card className="h-full min-w-0 overflow-hidden border-slate-200 shadow-none">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-slate-500" />
              Процессы
            </CardTitle>
            <CardDescription>PID process остаётся серверной сущностью для диаграмм технологического оборудования.</CardDescription>
          </div>
          {activeProcessId !== null ? <Badge variant="outline">{saveStateLabel}</Badge> : null}
        </div>

        <div className="mt-3">
          <SearchableTreeSelectField
            label="Локация"
            value={locationId}
            options={buildLocationOptions((locationsQuery.data || []) as TreeNode[])}
            onChange={(next) => setLocationId(next === "" ? "" : Number(next))}
            placeholder="Выберите локацию"
            emptyOptionLabel="Выберите локацию"
            fullWidth
            size="small"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" className={sidebarActionButtonClass} onClick={openCreateDialog} disabled={!locationId || readOnly}>
            <Plus className="h-4 w-4 shrink-0" />
            Новый
          </Button>
          <Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={openSelectedProcess} disabled={selectedProcessId === null}>
            Открыть
          </Button>
          <Button
            size="sm"
            className={sidebarActionButtonClass}
            variant="outline"
            onClick={() => setIsEditingSelectedProcess(true)}
            disabled={selectedProcessId === null || readOnly}
          >
            Редактировать
          </Button>
          <Button
            size="sm"
            className={sidebarActionButtonClass}
            variant="destructive"
            onClick={() => {
              void handleDeleteSelectedProcess();
            }}
            disabled={selectedProcessId === null || readOnly}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            Удалить
          </Button>
          <Button
            size="sm"
            className={sidebarActionButtonClass}
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={!locationId || readOnly}
          >
            <Upload className="h-4 w-4 shrink-0" />
            Импорт JSON
          </Button>
          <Button
            size="sm"
            className={sidebarActionButtonClass}
            variant="outline"
            onClick={exportActiveProcess}
            disabled={!hasOpenCanvas}
          >
            <Upload className="h-4 w-4 shrink-0" />
            Экспорт JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-5">
        <Input value={processSearch} onChange={(event) => setProcessSearch(event.target.value)} placeholder="Поиск по процессам" />
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Список процессов</div>
            <div className="text-xs text-slate-500">
              {filteredProcesses.length} / {activeProcesses.length}
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px_36px_32px] items-center gap-1.5 border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <div>Процесс</div>
            <div className="text-center">Узлы</div>
            <div className="text-center">Связи</div>
            <div className="text-center">X</div>
          </div>
          <div className="max-h-[42vh] overflow-auto border-x border-b border-slate-200 bg-slate-50/30 pr-1">
            <div className="space-y-px bg-slate-200">
              {filteredProcesses.map((item) => (
                <CompactProcessRow
                  key={item.id}
                  item={item}
                  selected={item.id === selectedProcessId}
                  active={item.id === activeProcessId}
                  stats={statsMap[item.id]}
                  onClick={() => {
                    setSelectedProcessId(item.id);
                    setIsEditingSelectedProcess(false);
                  }}
                  onDelete={() => {
                    setSelectedProcessId(item.id);
                    void handleDeleteSelectedProcess();
                  }}
                />
              ))}
              {filteredProcesses.length === 0 ? (
                <div className="border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                  Процессы не найдены.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Предпросмотр</div>
              <div className="text-xs text-slate-500">
                {selectedProcessId !== null && activeProcessId === selectedProcessId ? "Открыто на холсте" : "Выбрано в списке процессов"}
              </div>
            </div>
            {selectedProcessId !== null && activeProcessId === selectedProcessId ? <Badge variant="success">Активен</Badge> : null}
          </div>

          {isEditingSelectedProcess ? (
            <div className="space-y-3 border border-slate-200 p-3">
              <Input
                value={selectedProcessName}
                onChange={(event) => setSelectedProcessName(event.target.value)}
                onKeyDown={handleMetadataDraftKeyDown}
                placeholder="Название процесса"
                disabled={readOnly}
              />
              <Input
                value={selectedProcessDescription}
                onChange={(event) => setSelectedProcessDescription(event.target.value)}
                onKeyDown={handleMetadataDraftKeyDown}
                placeholder="Описание"
                disabled={readOnly}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { void handleSaveSelectedMetadata(); }} disabled={readOnly}>
                  <Save className="h-4 w-4" />
                  Сохранить
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditingSelectedProcess(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : selectedProcess ? (
            <DocumentPreviewCard
              active={selectedProcessId === activeProcessId}
              title={selectedProcess.name}
              subtitle={selectedProcess.description || "Без описания"}
              updatedAt={previewStats ? new Date(previewStats.updatedAt).toLocaleString() : previewUpdatedAt}
              stats={{
                nodes: previewStats?.nodes || 0,
                edges: previewStats?.edges || 0,
              }}
            />
          ) : (
            <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Выберите процесс, чтобы увидеть предпросмотр.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const inspectorPanel = (
    <Card className="h-full min-w-0 overflow-hidden border-slate-200 shadow-none">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Инспектор</CardTitle>
            <CardDescription>{saveStateLabel}</CardDescription>
          </div>
          <Badge variant={saveStatus === "error" ? "destructive" : saveStatus === "saved" ? "success" : "secondary"}>
            {saveStateLabel}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            ["properties", "Свойства"],
            ["nodes", "Узлы"],
            ["palette", "Палитра"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "min-h-11 min-w-0 border px-2 py-2 text-xs font-medium leading-tight whitespace-normal [word-break:break-word]",
                inspectorTab === tab ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
              )}
              onClick={() => setInspectorTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-210px)] overflow-auto p-5">
        {inspectorTab === "properties" ? (
          <PidPropertiesPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            readOnly={readOnly}
            bordered={false}
            onNodeChange={(nextNode) => {
              if (!diagram) return;
              ensurePropertyCheckpoint(`node:${nextNode.id}`);
              applyDiagram({
                ...diagram,
                nodes: diagram.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
                updatedAt: new Date().toISOString(),
              });
            }}
            onEdgeChange={(nextEdge) => {
              if (!diagram) return;
              ensurePropertyCheckpoint(`edge:${nextEdge.id}`);
              applyDiagram({
                ...diagram,
                edges: diagram.edges.map((edge) => (edge.id === nextEdge.id ? nextEdge : edge)),
                updatedAt: new Date().toISOString(),
              });
            }}
          />
        ) : null}

        {inspectorTab === "nodes" ? (
          diagram ? (
            <PidEquipmentListTab
              nodes={diagram.nodes}
              onJumpToNode={(nodeId) => {
                setSelectedNodeIds([nodeId]);
                setSelectedEdgeId(null);
                canvasRef.current?.focusNode(nodeId);
              }}
            />
          ) : (
            <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Откройте процесс, чтобы увидеть список узлов.
            </div>
          )
        ) : null}

        {inspectorTab === "palette" ? (
          hasOpenCanvas ? (
            <PidToolbox
              mode={toolMode}
              onModeChange={setToolMode}
              edgeType={edgeType}
              onEdgeTypeChange={setEdgeType}
              showModeControls={false}
              showEdgeTypeControls={false}
              onPresetPick={(preset) => {
                setPendingPreset(preset);
                canvasRef.current?.addPendingPresetAtViewportCenter(preset);
              }}
              mainEquipmentTree={(mainEquipmentQuery.data || []) as MainEquipmentTreeNode[]}
            />
          ) : (
            <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Сначала откройте процесс, затем добавляйте элементы на холст.
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          void handleImportInput(event);
        }}
      />

      <Card className="border-slate-200 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-xl">{t("pid.page.title")}</CardTitle>
              <CardDescription>
                Серверные PID processes, serial-подобный shell, единое меню над холстом и инспектор справа.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Узлы: {activeProcessStats?.nodes ?? 0}</Badge>
              <Badge variant="outline">Связи: {activeProcessStats?.edges ?? 0}</Badge>
              <Badge variant={saveStatus === "error" ? "destructive" : saveStatus === "saved" ? "success" : "secondary"}>
                {saveStateLabel}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:hidden">
            <Button size="sm" variant="outline" onClick={() => setIsSidebarDrawerOpen(true)}>
              <PanelLeft className="h-4 w-4" />
              Процессы
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsInspectorDrawerOpen(true)}>
              <PanelRight className="h-4 w-4" />
              Инспектор
            </Button>
          </div>
          {message ? (
            <div
              className={cn(
                "border px-3 py-2 text-sm",
                message.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"
              )}
            >
              {message.text}
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(320px,360px)]">
        <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start">{sidebarPanel}</div>

        <Card ref={canvasShellRef} className={cn("flex min-h-[760px] flex-col border-slate-200 shadow-none", isFullscreen && "h-screen")}>
          <CardHeader className="border-b border-slate-200 pb-4">
            <div className="flex flex-col gap-3">
              <Menubar>
                <MenubarMenu>
                  <MenubarTrigger>Файл</MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem onClick={openCreateDialog} disabled={!locationId || readOnly}>
                      Новый процесс
                    </MenubarItem>
                    <MenubarItem onClick={() => fileInputRef.current?.click()} disabled={!locationId || readOnly}>
                      Импорт JSON
                    </MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem onClick={exportActiveProcess} disabled={!hasOpenCanvas}>
                      Экспорт JSON
                    </MenubarItem>
                  </MenubarContent>
                </MenubarMenu>

                <MenubarMenu>
                  <MenubarTrigger>Правка</MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem
                      onClick={() => {
                        setHistory((current) => {
                          if (!current.past.length || !diagramRef.current) return current;
                          const previous = current.past[current.past.length - 1];
                          const active = cloneDiagram(diagramRef.current);
                          loadDiagramIntoCanvas(previous, { resetHistory: false });
                          return {
                            past: current.past.slice(0, -1),
                            future: [active, ...current.future].slice(0, 100),
                          };
                        });
                      }}
                      disabled={!history.past.length}
                    >
                      Отменить
                      <MenubarShortcut>Ctrl/Cmd+Z</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem
                      onClick={() => {
                        setHistory((current) => {
                          if (!current.future.length || !diagramRef.current) return current;
                          const [next, ...rest] = current.future;
                          const active = cloneDiagram(diagramRef.current);
                          loadDiagramIntoCanvas(next, { resetHistory: false });
                          return {
                            past: [...current.past, active].slice(-100),
                            future: rest,
                          };
                        });
                      }}
                      disabled={!history.future.length}
                    >
                      Повторить
                      <MenubarShortcut>Shift+Ctrl/Cmd+Z</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem onClick={copySelection} disabled={!canCopySelection}>
                      Копировать
                      <MenubarShortcut>Ctrl/Cmd+C</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem onClick={pasteSelection} disabled={!canPasteSelection}>
                      Вставить
                      <MenubarShortcut>Ctrl/Cmd+V</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem onClick={duplicateSelection} disabled={!canDuplicateSelection}>
                      Дублировать
                      <MenubarShortcut>Ctrl/Cmd+D</MenubarShortcut>
                    </MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem className="text-red-600 hover:bg-red-50" onClick={() => { void deleteSelection(); }} disabled={!canDeleteSelection}>
                      Удалить
                      <MenubarShortcut>Delete</MenubarShortcut>
                    </MenubarItem>
                  </MenubarContent>
                </MenubarMenu>

                <MenubarMenu>
                  <MenubarTrigger>Вид</MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem onClick={() => canvasRef.current?.fitView()} disabled={!hasOpenCanvas}>
                      Подогнать схему
                    </MenubarItem>
                    <MenubarItem onClick={() => canvasRef.current?.resetView()} disabled={!hasOpenCanvas}>
                      Сбросить вид
                    </MenubarItem>
                    <MenubarCheckboxItem checked={showMiniMap} onClick={() => setShowMiniMap((value) => !value)} disabled={!hasOpenCanvas}>
                      Миникарта
                    </MenubarCheckboxItem>
                    <MenubarSeparator />
                    <MenubarItem onClick={() => { void toggleFullscreen(); }} disabled={!hasOpenCanvas}>
                      {isFullscreen ? "Свернуть из полноэкранного режима" : "Развернуть на весь экран"}
                    </MenubarItem>
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="icon" variant={toolMode === "select" ? "default" : "outline"} onClick={() => setToolMode("select")} title="Выделение">
                  <MousePointer2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant={toolMode === "pan" ? "default" : "outline"} onClick={() => setToolMode("pan")} title="Панорамирование">
                  <Hand className="h-4 w-4" />
                </Button>
                <Button size="icon" variant={toolMode === "add-edge" ? "default" : "outline"} onClick={() => setToolMode("add-edge")} title="Создание связей">
                  <Link2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant={toolMode === "delete" ? "default" : "outline"} onClick={() => setToolMode("delete")} title="Удаление">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (pendingPreset) {
                      canvasRef.current?.addPendingPresetAtViewportCenter(pendingPreset);
                      return;
                    }
                    setInspectorTab("palette");
                    setMessage({ tone: "info", text: "Выберите тип узла в палитре справа." });
                  }}
                  disabled={!hasOpenCanvas}
                  title={pendingPreset ? "Добавить выбранный узел" : "Открыть палитру узлов"}
                >
                  <Shapes className="h-4 w-4" />
                  Добавить узел
                </Button>
                <select
                  className="h-10 border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                  value={edgeType}
                  onChange={(event) => setEdgeType(event.target.value as PidEdge["edgeType"])}
                  disabled={!hasOpenCanvas}
                >
                  <option value="process">Process</option>
                  <option value="signal">Signal</option>
                  <option value="control">Control</option>
                  <option value="electric">Electric</option>
                </select>
                <Button size="icon" variant="outline" onClick={() => {
                  setHistory((current) => {
                    if (!current.past.length || !diagramRef.current) return current;
                    const previous = current.past[current.past.length - 1];
                    const active = cloneDiagram(diagramRef.current);
                    loadDiagramIntoCanvas(previous, { resetHistory: false });
                    return {
                      past: current.past.slice(0, -1),
                      future: [active, ...current.future].slice(0, 100),
                    };
                  });
                }} disabled={!history.past.length} title="Отменить">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => {
                  setHistory((current) => {
                    if (!current.future.length || !diagramRef.current) return current;
                    const [next, ...rest] = current.future;
                    const active = cloneDiagram(diagramRef.current);
                    loadDiagramIntoCanvas(next, { resetHistory: false });
                    return {
                      past: [...current.past, active].slice(-100),
                      future: rest,
                    };
                  });
                }} disabled={!history.future.length} title="Повторить">
                  <RotateCw className="h-4 w-4" />
                </Button>
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
                <Button size="icon" variant="outline" onClick={() => canvasRef.current?.fitView()} disabled={!hasOpenCanvas} title="Подогнать схему">
                  <Search className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => { void toggleFullscreen(); }} disabled={!hasOpenCanvas} title={isFullscreen ? "Свернуть" : "Развернуть"}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>

                <div ref={searchPanelRef} className="relative min-w-0 flex-1 xl:max-w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    value={canvasSearch}
                    onChange={(event) => {
                      setCanvasSearch(event.target.value);
                      setIsSearchResultsOpen(event.target.value.trim().length > 0);
                    }}
                    onFocus={() => setIsSearchResultsOpen(canvasSearch.trim().length > 0)}
                    placeholder="Поиск узлов по имени, тегу и symbolKey"
                    disabled={!hasOpenCanvas}
                  />
                  {canvasSearch.trim() && isSearchResultsOpen ? (
                    <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-full overflow-auto border border-slate-200 bg-white shadow-lg">
                      {searchResults.length ? (
                        searchResults.map((node) => (
                          <button
                            key={node.id}
                            type="button"
                            className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0"
                            onClick={() => focusSearchResult(node.id)}
                          >
                            <div className="truncate text-sm font-semibold text-slate-900">{node.label || node.symbolKey}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {node.tag || "Без тега"} • {node.symbolKey}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm text-slate-500">Совпадений не найдено.</div>
                      )}
                    </div>
                  ) : null}
                </div>

                {activeProcessId !== null ? <Badge variant="outline">{Math.round((diagram?.viewport.zoom || 1) * 100)}%</Badge> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn("flex-1 p-5", isFullscreen && "min-h-0")}>
            <div className={cn("relative min-w-0", isFullscreen ? "h-full bg-white" : "h-[620px] min-h-[620px]")}>
              {!hasOpenCanvas ? (
                <EmptyCanvasState
                  title={activeProcesses.length > 0 ? "Нет открытого процесса" : "Процессы не найдены"}
                  description={
                    activeProcesses.length > 0
                      ? "Выберите процесс в sidebar и нажмите Открыть."
                      : "Сначала выберите локацию, затем создайте новый процесс или импортируйте JSON."
                  }
                  primaryAction={
                    activeProcesses.length > 0 ? (
                      <Button size="sm" onClick={openSelectedProcess} disabled={selectedProcessId === null}>
                        Открыть
                      </Button>
                    ) : (
                      <Button size="sm" onClick={openCreateDialog} disabled={!locationId || readOnly}>
                        <Plus className="h-4 w-4" />
                        Новый процесс
                      </Button>
                    )
                  }
                  secondaryAction={
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!locationId || readOnly}>
                      <Upload className="h-4 w-4" />
                      Импорт JSON
                    </Button>
                  }
                />
              ) : null}

              {diagram ? (
                <PidCanvas
                  ref={canvasRef}
                  diagram={diagram}
                  readOnly={readOnly}
                  showMiniMap={showMiniMap}
                  mode={toolMode}
                  edgeType={edgeType}
                  pendingPreset={pendingPreset}
                  selectedNodeIds={selectedNodeIds}
                  selectedEdgeId={selectedEdgeId}
                  onSelectionChange={updateSelection}
                  onPendingPresetConsumed={() => setPendingPreset(null)}
                  onRequestHistoryCheckpoint={checkpointCurrentDiagram}
                  onDiagramChange={applyDiagram}
                />
              ) : (
                <div className="flex min-h-[620px] items-center justify-center border border-slate-200 text-sm text-slate-500">
                  Загрузка диаграммы...
                </div>
              )}

              {isFullscreen ? (
                <div className="absolute right-4 top-4 z-20 w-[min(360px,calc(100vw-32px))]" onPointerDown={(event) => event.stopPropagation()}>
                  {inspectorPanel}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {!isFullscreen ? <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-24px)]">{inspectorPanel}</div> : null}
      </div>

      {isSidebarDrawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/35 xl:hidden" onClick={() => setIsSidebarDrawerOpen(false)}>
          <div className="h-full w-[min(92vw,360px)] bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Процессы</div>
              <Button size="sm" variant="outline" onClick={() => setIsSidebarDrawerOpen(false)}>
                Закрыть
              </Button>
            </div>
            {sidebarPanel}
          </div>
        </div>
      ) : null}

      {isInspectorDrawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/35 xl:hidden" onClick={() => setIsInspectorDrawerOpen(false)}>
          <div className="ml-auto h-full w-[min(94vw,420px)] bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Инспектор</div>
              <Button size="sm" variant="outline" onClick={() => setIsInspectorDrawerOpen(false)}>
                Закрыть
              </Button>
            </div>
            {inspectorPanel}
          </div>
        </div>
      ) : null}

      {isCreateDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onClick={() => setIsCreateDialogOpen(false)}>
          <div className="w-full max-w-md border border-slate-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="text-lg font-semibold text-slate-900">Новый процесс</div>
            <div className="mt-1 text-sm text-slate-500">
              Укажите имя и описание нового PID process перед созданием серверного документа.
            </div>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <div className="text-sm font-medium text-slate-900">Название</div>
                <Input value={createNameDraft} onChange={(event) => setCreateNameDraft(event.target.value)} placeholder="Название процесса" autoFocus />
              </div>
              <div className="space-y-1.5">
                <div className="text-sm font-medium text-slate-900">Описание</div>
                <Input value={createDescriptionDraft} onChange={(event) => setCreateDescriptionDraft(event.target.value)} placeholder="Описание (необязательно)" />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Отмена
              </Button>
              <Button size="sm" onClick={() => { void handleCreateProcessConfirm(); }} disabled={!createNameDraft.trim() || !locationId || readOnly}>
                <Plus className="h-4 w-4" />
                Создать
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
