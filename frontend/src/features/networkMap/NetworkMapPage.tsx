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
  Maximize2,
  Minimize2,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Plus,
  Route,
  Rows3,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import { getSubnetAddresses, listSubnets } from "../ipam/api/ipam";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { formatDateTime } from "../../utils/dateFormat";
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
} from "../../components/ui/menubar";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { cn } from "../../lib/utils";
import {
  createNetworkTopology,
  deleteNetworkTopology,
  getNetworkTopology,
  listNetworkTopologies,
  listNetworkTopologyEligibleEquipment,
  updateNetworkTopology,
} from "./api";
import type {
  NetworkEdge,
  NetworkNode,
  NetworkTopologyDocumentRecord,
  NetworkTopologyEligibleEquipment,
  NodeInterface,
  RouteEntry,
  SaveState,
  TopologyDocument,
  TopologyPolicy,
} from "./types";
import {
  DEFAULT_DOCUMENT,
  NETWORK_EDGE_STYLES,
  NETWORK_LAYERS,
  NETWORK_NODE_TYPES,
  ROUTE_PROTOCOLS,
  autoLayout,
  computeShortestPath,
  computeTopologyValidation,
  createEmptyNodeInterface,
  createEmptyPolicy,
  createEmptyRouteEntry,
  createId,
  createManualNode,
  createNodeFromEquipment,
  exportDocument,
  getStatusPalette,
  importDocumentFromFile,
  isEquipmentAlreadyOnCanvas,
  updateEdge,
  updateNode,
} from "./utils";

type ToolMode = "select" | "connect" | "pan";
type InspectorTab = "selection" | "data" | "gateway" | "diagnostics";
type NetworkTopologySnapshot = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  policies: TopologyPolicy[];
  viewport: { x: number; y: number };
  zoom: number;
};
type HistoryState = { past: NetworkTopologySnapshot[]; future: NetworkTopologySnapshot[] };
type Interaction =
  | { type: "pan"; startX: number; startY: number; viewport: { x: number; y: number }; moved: boolean }
  | { type: "drag"; startX: number; startY: number; nodeIds: string[]; positions: Record<string, { x: number; y: number }>; snapshot: NetworkTopologySnapshot; moved: boolean }
  | { type: "select"; startX: number; startY: number; endX: number; endY: number }
  | null;

const defaultViewport = { x: 0, y: 0 };
const defaultZoom = 1;
const nodeWidth = 188;
const nodeHeight = 104;
const sidebarActionButtonClass = "h-auto min-h-11 justify-center px-2.5 py-2 text-center text-[12px] leading-snug whitespace-normal [word-break:break-word]";

function parseIpv4(ip: string) {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return octets;
}

function ipv4ToNumber(ip: string) {
  const octets = parseIpv4(ip);
  if (!octets) return null;
  return octets.reduce((value, octet) => value * 256 + octet, 0);
}

function isIpInSubnet(ip: string, subnet: { network_address: string; prefix: number }) {
  const ipValue = ipv4ToNumber(ip);
  const networkValue = ipv4ToNumber(subnet.network_address);
  if (ipValue === null || networkValue === null) return false;
  if (subnet.prefix <= 0) return true;
  const hostBits = 32 - subnet.prefix;
  const blockSize = 2 ** hostBits;
  return Math.floor(ipValue / blockSize) === Math.floor(networkValue / blockSize);
}

function getSubnetIpPrefix(subnet: { network_address: string; prefix: number }) {
  const octets = parseIpv4(subnet.network_address);
  if (!octets) return subnet.network_address;
  const octetCount = Math.max(1, Math.floor(subnet.prefix / 8));
  return `${octets.slice(0, octetCount).join(".")}.`;
}

function normalizeDocument(document: TopologyDocument | null | undefined): TopologyDocument {
  return {
    nodes: document?.nodes || [],
    edges: document?.edges || [],
    policies: document?.policies || [],
    viewport: document?.viewport || defaultViewport,
    zoom: document?.zoom ?? defaultZoom,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rectOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

function intersects(node: NetworkNode, rect: { x: number; y: number; width: number; height: number }) {
  return !(node.x + nodeWidth < rect.x || node.x > rect.x + rect.width || node.y + nodeHeight < rect.y || node.y > rect.y + rect.height);
}

function boundsOf(nodes: NetworkNode[]) {
  if (!nodes.length) return { x: 0, y: 0, width: 800, height: 520 };
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + nodeWidth));
  const maxY = Math.max(...nodes.map((node) => node.y + nodeHeight));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function centerOf(node: NetworkNode) {
  return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight / 2 };
}

function snapshotOfTopology(document: TopologyDocument): NetworkTopologySnapshot {
  return {
    nodes: structuredClone(document.nodes),
    edges: structuredClone(document.edges),
    policies: structuredClone(document.policies),
    viewport: structuredClone(document.viewport || defaultViewport),
    zoom: document.zoom ?? defaultZoom,
  };
}

function warningCountOfDocument(document: TopologyDocument) {
  return computeTopologyValidation(document).length;
}

function getNodeTypeLabel(type: NetworkNode["type"]) {
  switch (type) {
    case "core-switch":
      return "Core switch";
    case "load-balancer":
      return "Load balancer";
    case "vpn-gateway":
      return "VPN gateway";
    case "wireless-controller":
      return "Wireless ctrl";
    case "access-point":
      return "Access point";
    case "vm-host":
      return "VM host";
    case "iot-gateway":
      return "IoT gateway";
    default:
      return type.replace(/-/g, " ");
  }
}

function getEdgeStroke(edge: NetworkEdge, selected: boolean, traced: boolean) {
  if (selected) return { color: "#2563eb", width: 4, dash: undefined as string | undefined };
  if (traced) return { color: "#2563eb", width: 3.6, dash: undefined as string | undefined };
  const color = getStatusPalette(edge.status).stroke;
  switch (edge.style) {
    case "fiber":
      return { color, width: 3.4, dash: undefined };
    case "vpn":
      return { color, width: 3, dash: "10 6" };
    case "wireless":
      return { color, width: 3, dash: "5 5" };
    case "mpls":
      return { color, width: 3.2, dash: "14 6 4 6" };
    case "trunk":
      return { color, width: 4.4, dash: undefined };
    default:
      return { color, width: 3, dash: undefined };
  }
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
  item: NetworkTopologyDocumentRecord;
  selected: boolean;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const warningCount = warningCountOfDocument(normalizeDocument(item.document));
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

export default function NetworkMapPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = hasPermission(user, "engineering", "write");
  const readOnly = !canWrite;

  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addNodeMenuRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction>(null);
  const hydratingRef = useRef(false);

  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [documentName, setDocumentName] = useState(t("pages.networkMap.defaultName"));
  const [documentDescription, setDocumentDescription] = useState("");
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [selectedDocumentDescription, setSelectedDocumentDescription] = useState("");
  const [topology, setTopology] = useState<TopologyDocument>(normalizeDocument(DEFAULT_DOCUMENT));
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("selection");
  const [pendingConnectId, setPendingConnectId] = useState<string | null>(null);
  const [pathStartId, setPathStartId] = useState("");
  const [pathEndId, setPathEndId] = useState("");
  const [selectedSubnetId, setSelectedSubnetId] = useState<number | null>(null);
  const [selectedAddressOffset, setSelectedAddressOffset] = useState<number | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [isInspectorDrawerOpen, setIsInspectorDrawerOpen] = useState(false);
  const [isEditingSelectedDocument, setIsEditingSelectedDocument] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createNameDraft, setCreateNameDraft] = useState(t("pages.networkMap.defaultName"));
  const [createDescriptionDraft, setCreateDescriptionDraft] = useState("");
  const [pendingDeleteDocument, setPendingDeleteDocument] = useState<{ id: number; name: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [clipboardNodes, setClipboardNodes] = useState<NetworkNode[]>([]);
  const [canvasSearch, setCanvasSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const [isAddNodeMenuOpen, setIsAddNodeMenuOpen] = useState(false);

  const activeIdRef = useRef<number | null>(null);
  const topologyRef = useRef<TopologyDocument>(normalizeDocument(DEFAULT_DOCUMENT));
  const documentNameRef = useRef(documentName);
  const documentDescriptionRef = useRef(documentDescription);
  const readOnlyRef = useRef(readOnly);
  const saveInFlightRef = useRef(false);
  const needsSaveAfterCurrentRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);

  const topologiesQuery = useQuery({ queryKey: ["network-topologies"], queryFn: () => listNetworkTopologies({ page: 1, page_size: 100, scope: "engineering" }) });
  const detailQuery = useQuery({ queryKey: ["network-topology", activeId], queryFn: () => getNetworkTopology(activeId as number), enabled: activeId !== null });
  const inventoryQuery = useQuery({ queryKey: ["network-topology-eligible-equipment"], queryFn: () => listNetworkTopologyEligibleEquipment({}) });
  const subnetsQuery = useQuery({ queryKey: ["network-map-subnets"], queryFn: () => listSubnets({ page: 1, page_size: 200, sort: "network_address" }) });
  const subnetAddressesQuery = useQuery({
    queryKey: ["network-map-subnet-addresses", selectedSubnetId],
    enabled: selectedSubnetId !== null,
    queryFn: () => getSubnetAddresses(selectedSubnetId as number, { mode: "list", include_service: false, page: 1, page_size: 512, sort: "ip_address" }),
  });

  const allTopologies = topologiesQuery.data?.items || [];
  const selectedDocument = allTopologies.find((item) => item.id === selectedDocumentId) || null;
  const availableSubnets = subnetsQuery.data?.items || [];

  useEffect(() => {
    if (allTopologies.length === 0) {
      if (selectedDocumentId !== null) setSelectedDocumentId(null);
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (selectedDocumentId === null) setSelectedDocumentId(allTopologies[0].id);
    if (selectedDocumentId !== null && !allTopologies.some((item) => item.id === selectedDocumentId)) setSelectedDocumentId(allTopologies[0]?.id ?? null);
    if (activeId !== null && !allTopologies.some((item) => item.id === activeId)) setActiveId(null);
  }, [activeId, allTopologies, selectedDocumentId]);

  useEffect(() => {
    if (!detailQuery.data) return;
    const normalized = normalizeDocument(detailQuery.data.document);
    hydratingRef.current = true;
    setDocumentName(detailQuery.data.name);
    setDocumentDescription(detailQuery.data.description || "");
    topologyRef.current = normalized;
    setTopology(normalized);
    setHistory({ past: [], future: [] });
    setSelectedDocumentId(detailQuery.data.id);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setPendingConnectId(null);
    setToolMode("select");
    setPathStartId("");
    setPathEndId("");
    setSelectedSubnetId(null);
    setSelectedAddressOffset(null);
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setSaveState("saved");
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
    activeIdRef.current = activeId;
    topologyRef.current = topology;
    documentNameRef.current = documentName;
    documentDescriptionRef.current = documentDescription;
    readOnlyRef.current = readOnly;
  }, [activeId, topology, documentDescription, documentName, readOnly]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(globalThis.document.fullscreenElement === canvasShellRef.current);
    globalThis.document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => globalThis.document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (addNodeMenuRef.current && target && !addNodeMenuRef.current.contains(target)) setIsAddNodeMenuOpen(false);
      if (searchPanelRef.current && target && !searchPanelRef.current.contains(target)) setIsSearchResultsOpen(false);
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
      setIsAddNodeMenuOpen(false);
      setIsSearchResultsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingConnectId, toolMode]);

  const equipmentItems = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const items = inventoryQuery.data || [];
    return !q ? items : items.filter((item) => [item.display_name, item.equipment_type_name, item.manufacturer_name || "", item.location || "", item.primary_ip || ""].join(" ").toLowerCase().includes(q));
  }, [inventoryQuery.data, inventorySearch]);
  const equipmentPresence = useMemo(() => new Map(equipmentItems.map((item) => [`${item.equipment_source}:${item.equipment_item_id}`, isEquipmentAlreadyOnCanvas(topology, item)])), [equipmentItems, topology]);
  const filteredTopologies = useMemo(() => {
    const q = documentSearch.trim().toLowerCase();
    if (!q) return allTopologies;
    return allTopologies.filter((item) => [item.name, item.description || ""].join(" ").toLowerCase().includes(q));
  }, [allTopologies, documentSearch]);
  const validation = useMemo(() => computeTopologyValidation(topology), [topology]);
  const selectedNode = selectedNodeIds.length === 1 ? topology.nodes.find((node) => node.id === selectedNodeIds[0]) || null : null;
  const selectedEdge = selectedEdgeId ? topology.edges.find((edge) => edge.id === selectedEdgeId) || null : null;
  const selectedCount = selectedNodeIds.length + (selectedEdgeId ? 1 : 0);
  const tracedPath = useMemo(() => computeShortestPath(topology, pathStartId, pathEndId), [pathEndId, pathStartId, topology]);
  const nodeWarnings = validation.filter((item) => item.severity === "warning").length;
  const nodeCritical = validation.filter((item) => item.severity === "critical").length;
  const totalInterfaces = topology.nodes.reduce((sum, node) => sum + node.interfaces.length, 0);
  const totalRoutes = topology.nodes.reduce((sum, node) => sum + node.routes.length, 0);
  const totalPolicies = topology.policies.length;
  const visibleNodes = useMemo(() => {
    const q = canvasSearch.trim().toLowerCase();
    if (!q) return topology.nodes;
    return topology.nodes.filter((node) => [node.name, node.model, node.ip, node.vlan, node.zone, node.type, node.layer].join(" ").toLowerCase().includes(q));
  }, [canvasSearch, topology.nodes]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const searchResults = visibleNodes;
  const mapBounds = useMemo(() => boundsOf(topology.nodes), [topology.nodes]);
  const miniMapViewBox = useMemo(() => ({
    x: mapBounds.x - 30,
    y: mapBounds.y - 30,
    width: Math.max(mapBounds.width + 60, 260),
    height: Math.max(mapBounds.height + 60, 180),
  }), [mapBounds]);
  const previewDocument = selectedDocument?.document ? normalizeDocument(selectedDocument.document) : topology;
  const previewTitle = selectedDocument?.name || documentName;
  const previewDescription = selectedDocument?.description || documentDescription || t("pages.networkMap.documents.noDescription");
  const previewUpdatedAt = selectedDocument ? formatDateTime(selectedDocument.updated_at) : saveState === "saved" ? t("pages.networkMap.states.saved") : saveState === "saving" ? t("pages.networkMap.states.saving") : saveState === "error" ? t("pages.networkMap.states.error") : "Есть изменения";
  const previewStats = { nodes: previewDocument.nodes.length, edges: previewDocument.edges.length, warnings: warningCountOfDocument(previewDocument) };
  const selectedSubnet = availableSubnets.find((item) => item.id === selectedSubnetId) || null;
  const selectableAddresses = useMemo(() => {
    const items = subnetAddressesQuery.data?.items || [];
    return items.filter((item) => item.status === "free" || (selectedNode?.ip && item.ip_address === selectedNode.ip));
  }, [selectedNode?.ip, subnetAddressesQuery.data?.items]);
  const selectedAddress = selectableAddresses.find((item) => item.ip_offset === selectedAddressOffset) || null;

  useEffect(() => {
    if (!selectedNode) {
      setSelectedSubnetId(null);
      setSelectedAddressOffset(null);
      return;
    }
    setSelectedAddressOffset(null);
    const ipMatch = selectedNode.ip ? availableSubnets.find((subnet) => isIpInSubnet(selectedNode.ip, subnet)) || null : null;
    const vlanMatch = selectedNode.vlan ? availableSubnets.find((subnet) => subnet.vlan_number !== null && String(subnet.vlan_number || "") === selectedNode.vlan) || null : null;
    setSelectedSubnetId(ipMatch?.id ?? vlanMatch?.id ?? null);
  }, [availableSubnets, selectedNode]);

  useEffect(() => {
    if (!selectedNode || !selectedSubnetId) {
      setSelectedAddressOffset(null);
      return;
    }
    const currentAddress = (subnetAddressesQuery.data?.items || []).find((item) => item.ip_address === selectedNode.ip);
    setSelectedAddressOffset(currentAddress?.ip_offset || null);
  }, [selectedNode, selectedSubnetId, subnetAddressesQuery.data?.items]);

  const saveStateLabel = saveState === "saving" ? t("pages.networkMap.states.saving") : saveState === "saved" ? t("pages.networkMap.states.saved") : saveState === "error" ? t("pages.networkMap.states.error") : hasUnsavedChanges ? "Есть изменения" : t("pages.networkMap.states.unsaved");
  const hasOpenCanvas = activeId !== null;

  const markDirty = () => {
    if (hydratingRef.current) return;
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
    if (saveInFlightRef.current) needsSaveAfterCurrentRef.current = true;
    setSaveState("idle");
  };

  const pushSnapshot = (snapshot: NetworkTopologySnapshot) => {
    setHistory((current) => ({ past: [...current.past, snapshot].slice(-100), future: [] }));
  };

  const mutateCurrentTopology = (mutate: (current: TopologyDocument) => TopologyDocument, options?: { recordHistory?: boolean }) => {
    const current = topologyRef.current;
    const next = normalizeDocument(mutate(current));
    if (next === current) return;
    if ((options?.recordHistory ?? true) === true) pushSnapshot(snapshotOfTopology(current));
    topologyRef.current = next;
    setTopology(next);
    markDirty();
  };

  const flushSave = async () => {
    if (readOnlyRef.current || activeIdRef.current === null || !hasUnsavedChangesRef.current) return;
    if (saveInFlightRef.current) {
      needsSaveAfterCurrentRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    while (hasUnsavedChangesRef.current && activeIdRef.current !== null && !readOnlyRef.current) {
      needsSaveAfterCurrentRef.current = false;
      try {
        setSaveState("saving");
        const updated = await updateNetworkTopology(activeIdRef.current, {
          name: documentNameRef.current || t("pages.networkMap.defaultName"),
          description: documentDescriptionRef.current || null,
          scope: "engineering",
          document: topologyRef.current,
        });
        await queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
        queryClient.setQueryData(["network-topology", activeIdRef.current], updated);
        hasUnsavedChangesRef.current = false;
        setHasUnsavedChanges(false);
        setSaveState("saved");
      } catch {
        setSaveState("error");
        saveInFlightRef.current = false;
        return;
      }

      if (!needsSaveAfterCurrentRef.current) break;
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
    if ((trimmedName || t("pages.networkMap.defaultName")) === currentName && trimmedDescription === currentDescription) {
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
    const zoom = topologyRef.current.zoom ?? defaultZoom;
    const viewport = topologyRef.current.viewport || defaultViewport;
    return !bounds ? { x: 0, y: 0 } : { x: (clientX - bounds.left - viewport.x) / zoom, y: (clientY - bounds.top - viewport.y) / zoom };
  };

  const setViewport = (viewport: { x: number; y: number }, zoom = topologyRef.current.zoom ?? defaultZoom) => {
    topologyRef.current = { ...topologyRef.current, viewport, zoom };
    setTopology(topologyRef.current);
  };

  const focusPoint = (x: number, y: number) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const zoom = topologyRef.current.zoom ?? defaultZoom;
    if (!bounds) return;
    setViewport({ x: bounds.width / 2 - x * zoom, y: bounds.height / 2 - y * zoom }, zoom);
  };

  const focusNode = (nodeId: string) => {
    const node = topologyRef.current.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    focusPoint(node.x + nodeWidth / 2, node.y + nodeHeight / 2);
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeId(null);
    setInspectorTab("selection");
  };

  const fitView = () => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds || !topologyRef.current.nodes.length) {
      setViewport(defaultViewport, defaultZoom);
      return;
    }
    const b = boundsOf(topologyRef.current.nodes);
    const zoom = clamp(Math.min(bounds.width / (b.width + 120), bounds.height / (b.height + 120)), 0.25, 2.2);
    setViewport({ x: bounds.width / 2 - (b.x + b.width / 2) * zoom, y: bounds.height / 2 - (b.y + b.height / 2) * zoom }, zoom);
  };

  const resetView = () => setViewport(defaultViewport, defaultZoom);

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
    const current = topologyRef.current;
    const from = current.nodes.find((node) => node.id === fromId);
    const to = current.nodes.find((node) => node.id === toId);
    if (!from || !to) return;
    const duplicate = current.edges.some((edge) => (edge.from === fromId && edge.to === toId) || (edge.from === toId && edge.to === fromId));
    if (duplicate) {
      setMessage({ tone: "warning", text: "Такая связь уже существует." });
      return;
    }
    const edgeId = createId("edge");
    mutateCurrentTopology((document) => ({
      ...document,
      edges: [...document.edges, { id: edgeId, from: fromId, to: toId, label: "", style: "ethernet", bandwidth: "", latency: "", status: "healthy", network: "" }],
    }));
    setSelectedNodeIds([]);
    setSelectedEdgeId(edgeId);
    setToolMode("select");
    setPendingConnectId(null);
    commitUserAction();
    setMessage({ tone: "info", text: "Связь создана." });
  };

  const beginNodeInteraction = (event: ReactPointerEvent, nodeId: string) => {
    event.stopPropagation();
    if (toolMode === "connect") {
      if (pendingConnectId && pendingConnectId !== nodeId) createEdge(pendingConnectId, nodeId);
      else {
        setPendingConnectId(nodeId);
        const nodeName = topologyRef.current.nodes.find((node) => node.id === nodeId)?.name || "узел";
        setMessage({ tone: "info", text: pendingConnectId === nodeId ? "Выберите другой узел для создания связи." : `Источник связи выбран: ${nodeName}. Теперь выберите второй узел.` });
      }
      return;
    }
    if (toolMode === "pan" || event.button !== 0) {
      interactionRef.current = { type: "pan", startX: event.clientX, startY: event.clientY, viewport: topologyRef.current.viewport || defaultViewport, moved: false };
      return;
    }
    const selection = event.shiftKey ? (selectedNodeIds.includes(nodeId) ? selectedNodeIds.filter((id) => id !== nodeId) : [...selectedNodeIds, nodeId]) : (selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId]);
    setSelectedNodeIds(selection);
    setSelectedEdgeId(null);
    setInspectorTab("selection");
    if (readOnly) return;
    const nodeIds = selection.length ? selection : [nodeId];
    interactionRef.current = {
      type: "drag",
      startX: event.clientX,
      startY: event.clientY,
      nodeIds,
      snapshot: snapshotOfTopology(topologyRef.current),
      moved: false,
      positions: Object.fromEntries(topologyRef.current.nodes.filter((node) => nodeIds.includes(node.id)).map((node) => [node.id, { x: node.x, y: node.y }])),
    };
  };

  const beginCanvasInteraction = (event: ReactPointerEvent) => {
    if (toolMode === "pan" || event.button === 1) {
      interactionRef.current = { type: "pan", startX: event.clientX, startY: event.clientY, viewport: topologyRef.current.viewport || defaultViewport, moved: false };
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
        const next = { ...topologyRef.current, viewport: { x: interaction.viewport.x + dx, y: interaction.viewport.y + dy }, zoom: topologyRef.current.zoom ?? defaultZoom };
        topologyRef.current = next;
        setTopology(next);
      } else if (interaction.type === "drag") {
        const zoom = topologyRef.current.zoom ?? defaultZoom;
        const dx = (event.clientX - interaction.startX) / zoom;
        const dy = (event.clientY - interaction.startY) / zoom;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) interaction.moved = true;
        const next = { ...topologyRef.current, nodes: topologyRef.current.nodes.map((node) => !interaction.nodeIds.includes(node.id) ? node : ({ ...node, x: interaction.positions[node.id].x + dx, y: interaction.positions[node.id].y + dy })) };
        topologyRef.current = next;
        setTopology(next);
      } else {
        interactionRef.current = { ...interaction, endX: event.clientX, endY: event.clientY };
      }
    };

    const onUp = () => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.type === "drag" && interaction.moved) {
        pushSnapshot(interaction.snapshot);
        markDirty();
        commitUserAction();
      }
      if (interaction.type === "pan" && interaction.moved) {
        markDirty();
        commitUserAction();
      }
      if (interaction.type === "select") {
        const rect = rectOf(toLogical(interaction.startX, interaction.startY), toLogical(interaction.endX, interaction.endY));
        const ids = topologyRef.current.nodes.filter((node) => intersects(node, rect)).map((node) => node.id);
        setSelectedNodeIds(ids);
      }
      interactionRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [selectedNodeIds]);

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const zoomCurrent = topologyRef.current.zoom ?? defaultZoom;
    const viewport = topologyRef.current.viewport || defaultViewport;
    if (!bounds) return;
    const mx = event.clientX - bounds.left;
    const my = event.clientY - bounds.top;
    const zoom = clamp(zoomCurrent * (event.deltaY > 0 ? 0.88 : 1.14), 0.25, 2.4);
    const next = { x: mx - ((mx - viewport.x) / zoomCurrent) * zoom, y: my - ((my - viewport.y) / zoomCurrent) * zoom };
    setViewport(next, zoom);
  };

  const edgePath = (edge: NetworkEdge) => {
    const from = topology.nodes.find((item) => item.id === edge.from);
    const to = topology.nodes.find((item) => item.id === edge.to);
    if (!from || !to) return "";
    const a = centerOf(from);
    const b = centerOf(to);
    const dx = Math.abs(b.x - a.x) * 0.42;
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };

  const updateSelectedNode = (patch: Partial<NetworkNode>) => {
    if (!selectedNode || readOnly) return;
    mutateCurrentTopology((document) => updateNode(document, selectedNode.id, patch));
  };

  const updateSelectedEdge = (patch: Partial<NetworkEdge>) => {
    if (!selectedEdge || readOnly) return;
    mutateCurrentTopology((document) => updateEdge(document, selectedEdge.id, patch));
  };

  const updateNodeInterface = (index: number, patch: Partial<NodeInterface>) => {
    if (!selectedNode || readOnly) return;
    mutateCurrentTopology((document) => updateNode(document, selectedNode.id, { interfaces: selectedNode.interfaces.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  };

  const addNodeInterface = () => {
    if (!selectedNode || readOnly) return;
    mutateCurrentTopology((document) => updateNode(document, selectedNode.id, { interfaces: [...selectedNode.interfaces, createEmptyNodeInterface()] }));
    commitUserAction();
  };

  const removeNodeInterface = (index: number) => {
    if (!selectedNode || readOnly) return;
    mutateCurrentTopology((document) => updateNode(document, selectedNode.id, { interfaces: selectedNode.interfaces.filter((_, itemIndex) => itemIndex !== index) }));
    commitUserAction();
  };

  const updateRoute = (index: number, patch: Partial<RouteEntry>) => {
    if (!selectedNode || readOnly) return;
    mutateCurrentTopology((document) => updateNode(document, selectedNode.id, { routes: selectedNode.routes.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  };

  const addRoute = () => {
    if (!selectedNode || readOnly) return;
    mutateCurrentTopology((document) => updateNode(document, selectedNode.id, { routes: [...selectedNode.routes, createEmptyRouteEntry()] }));
    commitUserAction();
  };

  const removeRoute = (index: number) => {
    if (!selectedNode || readOnly) return;
    mutateCurrentTopology((document) => updateNode(document, selectedNode.id, { routes: selectedNode.routes.filter((_, itemIndex) => itemIndex !== index) }));
    commitUserAction();
  };

  const addPolicy = () => {
    if (readOnly) return;
    mutateCurrentTopology((document) => ({ ...document, policies: [...document.policies, createEmptyPolicy()] }));
    commitUserAction();
  };

  const updatePolicy = (policyId: string, patch: Partial<TopologyPolicy>) => {
    if (readOnly) return;
    mutateCurrentTopology((document) => ({ ...document, policies: document.policies.map((item) => item.id === policyId ? { ...item, ...patch } : item) }));
  };

  const removePolicy = (policyId: string) => {
    if (readOnly) return;
    mutateCurrentTopology((document) => ({ ...document, policies: document.policies.filter((item) => item.id !== policyId) }));
    commitUserAction();
  };

  const addManualNode = (type: NetworkNode["type"]) => {
    if (readOnly || activeId === null) return;
    mutateCurrentTopology((document) => ({ ...document, nodes: [...document.nodes, createManualNode(type, { x: mapBounds.x + 80 + document.nodes.length * 24, y: mapBounds.y + 80 + document.nodes.length * 16 })] }));
    commitUserAction();
  };

  const addInventoryNode = (item: NetworkTopologyEligibleEquipment) => {
    if (readOnly || activeId === null) return;
    mutateCurrentTopology((document) => ({
      ...document,
      nodes: [...document.nodes, createNodeFromEquipment(item, { x: mapBounds.x + 80 + document.nodes.length * 28, y: mapBounds.y + 90 + document.nodes.length * 18 })],
    }));
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
    const items = topology.nodes.filter((node) => selectedNodeIds.includes(node.id));
    if (!items.length) return;
    setClipboardNodes(structuredClone(items));
    setMessage({ tone: "info", text: `Скопировано узлов: ${items.length}.` });
  };

  const pasteSelection = () => {
    if (!clipboardNodes.length || readOnly || activeId === null) return;
    const clones = clipboardNodes.map((node, index) => ({ ...structuredClone(node), id: createId("node"), name: `${node.name} копия`, x: node.x + 48 + index * 12, y: node.y + 48 + index * 12 }));
    mutateCurrentTopology((document) => ({ ...document, nodes: [...document.nodes, ...clones] }));
    setSelectedNodeIds(clones.map((node) => node.id));
    setSelectedEdgeId(null);
    setInspectorTab("selection");
    commitUserAction();
  };

  const duplicateSelection = () => {
    if (!selectedNodeIds.length || readOnly) return;
    copySelection();
    pasteSelection();
  };

  const handleDeleteSelection = async () => {
    if (readOnly || (!selectedNodeIds.length && !selectedEdgeId)) return;
    if (!window.confirm("Удалить выделение?")) return;
    mutateCurrentTopology((document) => ({
      ...document,
      nodes: document.nodes.filter((node) => !selectedNodeIds.includes(node.id)),
      edges: document.edges.filter((edge) => edge.id !== selectedEdgeId && !selectedNodeIds.includes(edge.from) && !selectedNodeIds.includes(edge.to)),
    }));
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setPendingConnectId(null);
    commitUserAction();
  };

  const undo = () => {
    if (!history.past.length) return;
    const previous = history.past[history.past.length - 1];
    const currentSnapshot = snapshotOfTopology(topologyRef.current);
    const nextDocument = normalizeDocument({ nodes: structuredClone(previous.nodes), edges: structuredClone(previous.edges), policies: structuredClone(previous.policies), viewport: structuredClone(previous.viewport), zoom: previous.zoom });
    topologyRef.current = nextDocument;
    setTopology(nextDocument);
    setHistory((current) => ({ past: current.past.slice(0, -1), future: [currentSnapshot, ...current.future].slice(0, 100) }));
    markDirty();
    commitUserAction();
  };

  const redo = () => {
    if (!history.future.length) return;
    const next = history.future[0];
    const currentSnapshot = snapshotOfTopology(topologyRef.current);
    const nextDocument = normalizeDocument({ nodes: structuredClone(next.nodes), edges: structuredClone(next.edges), policies: structuredClone(next.policies), viewport: structuredClone(next.viewport), zoom: next.zoom });
    topologyRef.current = nextDocument;
    setTopology(nextDocument);
    setHistory((current) => ({ past: [...current.past, currentSnapshot].slice(-100), future: current.future.slice(1) }));
    markDirty();
    commitUserAction();
  };

  const openCreateDialog = () => {
    setCreateNameDraft(t("pages.networkMap.defaultName"));
    setCreateDescriptionDraft("");
    setIsCreateDialogOpen(true);
  };

  const createNewDocument = async (payload?: { name?: string; description?: string | null; document?: TopologyDocument }) => {
    if (readOnly) return;
    try {
      setSaveState("saving");
      const created = await createNetworkTopology({
        name: payload?.name || t("pages.networkMap.defaultName"),
        description: payload?.description || null,
        scope: "engineering",
        document: normalizeDocument(payload?.document || DEFAULT_DOCUMENT),
      });
      const normalized = normalizeDocument(created.document);
      hydratingRef.current = true;
      setSelectedDocumentId(created.id);
      setActiveId(created.id);
      setDocumentName(created.name);
      setDocumentDescription(created.description || "");
      topologyRef.current = normalized;
      setTopology(normalized);
      setHistory({ past: [], future: [] });
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setPendingConnectId(null);
      setToolMode("select");
      setPathStartId("");
      setPathEndId("");
      setSelectedSubnetId(null);
      setSelectedAddressOffset(null);
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
      queryClient.setQueryData(["network-topology", created.id], created);
      setTimeout(() => { hydratingRef.current = false; }, 0);
      setIsCreateDialogOpen(false);
      setIsSidebarDrawerOpen(false);
    } catch {
      setSaveState("error");
      setMessage({ tone: "warning", text: "Не удалось создать схему на сервере." });
    }
  };

  const handleCreateDocumentConfirm = async () => {
    const name = createNameDraft.trim();
    if (!name) return;
    await createNewDocument({ name, description: createDescriptionDraft.trim() || null });
  };

  const openSelectedDocument = () => {
    if (selectedDocumentId === null) return;
    setIsEditingSelectedDocument(false);
    setActiveId(selectedDocumentId);
    setIsSidebarDrawerOpen(false);
  };

  const handleSaveSelectedMetadata = async () => {
    if (selectedDocumentId === null || readOnly) return;
    try {
      const updated = await updateNetworkTopology(selectedDocumentId, {
        name: selectedDocumentName.trim() || t("pages.networkMap.defaultName"),
        description: selectedDocumentDescription.trim() || null,
      });
      queryClient.setQueryData(["network-topology", selectedDocumentId], updated);
      queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
      if (activeId === selectedDocumentId) {
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
    const remaining = allTopologies.filter((item) => item.id !== documentId);
    await deleteNetworkTopology(documentId);
    queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
    if (activeId === documentId) {
      setActiveId(null);
      const emptyDocument = normalizeDocument(DEFAULT_DOCUMENT);
      topologyRef.current = emptyDocument;
      setTopology(emptyDocument);
      setHistory({ past: [], future: [] });
      setDocumentName(t("pages.networkMap.defaultName"));
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

  const handleImportDocuments = async (items: Array<{ name: string; description: string | null; document: TopologyDocument }>) => {
    if (readOnly) return;
    let firstCreatedId: number | null = null;
    for (const item of items) {
      const created = await createNetworkTopology({ name: item.name, description: item.description, scope: "engineering", document: normalizeDocument(item.document) });
      if (firstCreatedId === null) firstCreatedId = created.id;
      queryClient.setQueryData(["network-topology", created.id], created);
    }
    await queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
    if (firstCreatedId !== null) {
      setSelectedDocumentId(firstCreatedId);
      setActiveId(firstCreatedId);
    }
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const document = await importDocumentFromFile(file);
      const baseName = file.name.replace(/\.[^.]+$/, "") || t("pages.networkMap.defaultName");
      await handleImportDocuments([{ name: baseName, description: null, document }]);
      setMessage({ tone: "info", text: "Схема импортирована на сервер." });
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
      const document = await importDocumentFromFile(file);
      const baseName = file.name.replace(/\.[^.]+$/, "") || t("pages.networkMap.defaultName");
      await handleImportDocuments([{ name: baseName, description: null, document }]);
      setMessage({ tone: "info", text: "Схема импортирована на сервер." });
    } catch {
      setMessage({ tone: "warning", text: "Не удалось импортировать JSON." });
    }
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && (selectedNodeIds.length || selectedEdgeId)) {
        event.preventDefault();
        void handleDeleteSelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedNodeIds.length) {
        event.preventDefault();
        duplicateSelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && selectedNodeIds.length) {
        event.preventDefault();
        copySelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && clipboardNodes.length) {
        event.preventDefault();
        pasteSelection();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [clipboardNodes.length, selectedEdgeId, selectedNodeIds]);

  const activeInteraction = interactionRef.current;
  const logicalSelectionRect = activeInteraction?.type === "select" ? rectOf(toLogical(activeInteraction.startX, activeInteraction.startY), toLogical(activeInteraction.endX, activeInteraction.endY)) : null;
  const canCopySelection = selectedNodeIds.length > 0;
  const canPasteSelection = clipboardNodes.length > 0 && !readOnly && hasOpenCanvas;
  const canDuplicateSelection = !readOnly && selectedNodeIds.length > 0;
  const canDeleteSelection = !readOnly && selectedCount > 0;
  const miniMapViewportRect = useMemo(() => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const zoom = topology.zoom ?? defaultZoom;
    const viewport = topology.viewport || defaultViewport;
    if (!bounds) return null;
    return {
      x: (-viewport.x) / zoom,
      y: (-viewport.y) / zoom,
      width: bounds.width / zoom,
      height: bounds.height / zoom,
    };
  }, [topology]);

  const renderSelectionPanel = () => {
    if (selectedNodeIds.length > 1) {
      return <div className="border border-slate-200 p-4 text-sm text-slate-600">{t("pages.networkMap.properties.multiSelection", { count: selectedNodeIds.length })}</div>;
    }
    if (selectedNode) {
      return (
        <div className="space-y-3">
          <Input value={selectedNode.name} onChange={(event) => updateSelectedNode({ name: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} disabled={readOnly} />
          <div className="grid grid-cols-2 gap-3">
            <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedNode.type} onChange={(event) => updateSelectedNode({ type: event.target.value as NetworkNode["type"] })} onBlur={handleSelectCommit} disabled={readOnly}>{NETWORK_NODE_TYPES.map((type) => <option key={type} value={type}>{getNodeTypeLabel(type)}</option>)}</select>
            <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedNode.layer} onChange={(event) => updateSelectedNode({ layer: event.target.value as NetworkNode["layer"] })} onBlur={handleSelectCommit} disabled={readOnly}>{NETWORK_LAYERS.map((layer) => <option key={layer} value={layer}>{layer}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              className="h-10 border border-slate-200 bg-white px-3 text-sm"
              value={selectedSubnetId ?? ""}
              onChange={(event) => {
                const nextSubnetId = event.target.value ? Number(event.target.value) : null;
                setSelectedSubnetId(nextSubnetId);
                setSelectedAddressOffset(null);
                if (!nextSubnetId) {
                  updateSelectedNode({ ip: "", vlan: "", interfaces: selectedNode.interfaces.map((item) => ({ ...item, ip: "", vlan: "" })) });
                  return;
                }
                const nextSubnet = availableSubnets.find((subnet) => subnet.id === nextSubnetId) || null;
                const ipPrefix = nextSubnet ? getSubnetIpPrefix(nextSubnet) : "";
                updateSelectedNode({
                  ip: ipPrefix,
                  vlan: nextSubnet?.vlan_number ? String(nextSubnet.vlan_number) : "",
                  interfaces: selectedNode.interfaces.map((item, index) => index === 0 ? { ...item, ip: ipPrefix, vlan: nextSubnet?.vlan_number ? String(nextSubnet.vlan_number) : item.vlan } : item),
                });
              }}
              onBlur={handleSelectCommit}
              disabled={readOnly}
            >
              <option value="">{t("pages.networkMap.fields.subnet")}</option>
              {availableSubnets.map((subnet) => <option key={subnet.id} value={subnet.id}>{subnet.name || subnet.cidr}</option>)}
            </select>
            <select
              className="h-10 border border-slate-200 bg-white px-3 text-sm"
              value={selectedAddressOffset ?? ""}
              onChange={(event) => {
                const offset = event.target.value ? Number(event.target.value) : null;
                setSelectedAddressOffset(offset);
                const address = selectableAddresses.find((item) => item.ip_offset === offset) || null;
                if (!address) return;
                updateSelectedNode({
                  ip: address.ip_address,
                  vlan: selectedSubnet?.vlan_number ? String(selectedSubnet.vlan_number) : "",
                  interfaces: selectedNode.interfaces.map((item, index) => index === 0 ? { ...item, ip: address.ip_address, vlan: selectedSubnet?.vlan_number ? String(selectedSubnet.vlan_number) : item.vlan } : item),
                });
              }}
              onBlur={handleSelectCommit}
              disabled={readOnly || !selectedSubnetId}
            >
              <option value="">{selectedSubnetId ? t("pages.networkMap.fields.address") : t("pages.networkMap.fields.selectSubnetFirst")}</option>
              {selectableAddresses.map((address) => <option key={`${address.subnet_id}-${address.ip_offset}`} value={address.ip_offset}>{address.ip_address}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={selectedNode.ip} onChange={(event) => updateSelectedNode({ ip: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.ip")} disabled={readOnly} />
            <Input value={selectedNode.vlan} onChange={(event) => updateSelectedNode({ vlan: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.vlan")} disabled={readOnly} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={selectedNode.zone} onChange={(event) => updateSelectedNode({ zone: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.zone")} disabled={readOnly} />
            <Input value={selectedNode.asn} onChange={(event) => updateSelectedNode({ asn: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.asn")} disabled={readOnly} />
          </div>
          {selectedSubnet ? <div className="border border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-600"><div className="font-medium text-slate-900">{selectedSubnet.name || selectedSubnet.cidr}</div><div className="mt-1">{selectedSubnet.network_address}</div><div className="mt-1">{selectedSubnet.vlan_number ? `VLAN ${selectedSubnet.vlan_number}` : "VLAN -"}{selectedAddress ? ` · ${selectedAddress.ip_address}` : selectedNode.ip ? ` · ${selectedNode.ip}` : ""}</div></div> : null}
          <div className="grid grid-cols-2 gap-3">
            <Input value={selectedNode.model} onChange={(event) => updateSelectedNode({ model: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.model")} disabled={readOnly} />
            <Input value={selectedNode.os} onChange={(event) => updateSelectedNode({ os: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.os")} disabled={readOnly} />
          </div>
          <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedNode.status} onChange={(event) => updateSelectedNode({ status: event.target.value as NetworkNode["status"] })} onBlur={handleSelectCommit} disabled={readOnly}>
            <option value="healthy">{t("pages.networkMap.health.healthy")}</option>
            <option value="warning">{t("pages.networkMap.health.warning")}</option>
            <option value="critical">{t("pages.networkMap.health.critical")}</option>
          </select>
        </div>
      );
    }

    if (selectedEdge) {
      return (
        <div className="space-y-3">
          <Input value={selectedEdge.label} onChange={(event) => updateSelectedEdge({ label: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.label")} disabled={readOnly} />
          <div className="grid grid-cols-2 gap-3">
            <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedEdge.style} onChange={(event) => updateSelectedEdge({ style: event.target.value as NetworkEdge["style"] })} onBlur={handleSelectCommit} disabled={readOnly}>{NETWORK_EDGE_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}</select>
            <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedEdge.status} onChange={(event) => updateSelectedEdge({ status: event.target.value as NetworkEdge["status"] })} onBlur={handleSelectCommit} disabled={readOnly}>
              <option value="healthy">{t("pages.networkMap.health.healthy")}</option>
              <option value="warning">{t("pages.networkMap.health.warning")}</option>
              <option value="critical">{t("pages.networkMap.health.critical")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={selectedEdge.bandwidth} onChange={(event) => updateSelectedEdge({ bandwidth: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.bandwidth")} disabled={readOnly} />
            <Input value={selectedEdge.latency} onChange={(event) => updateSelectedEdge({ latency: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.latency")} disabled={readOnly} />
          </div>
          <Input value={selectedEdge.network} onChange={(event) => updateSelectedEdge({ network: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.network")} disabled={readOnly} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Выберите узел или связь на холсте для редактирования.</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Узлы</div><div className="mt-1 text-lg font-semibold">{topology.nodes.length}</div></div>
          <div className="min-w-0 border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Связи</div><div className="mt-1 text-lg font-semibold">{topology.edges.length}</div></div>
          <div className="min-w-0 border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Предупреждения</div><div className="mt-1 text-lg font-semibold">{validation.length}</div></div>
          <div className="min-w-0 border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Выбор</div><div className="mt-1 text-lg font-semibold">{selectedCount}</div></div>
        </div>
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="text-sm font-semibold text-slate-900">Добавить оборудование</div>
          <Input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Поиск оборудования" />
          <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
            {equipmentItems.slice(0, 12).map((item) => {
              const alreadyAdded = equipmentPresence.get(`${item.equipment_source}:${item.equipment_item_id}`) === true;
              return (
                <div key={`${item.equipment_source}:${item.equipment_item_id}`} className="min-w-0 border border-slate-200 p-3">
                  <div className="truncate font-semibold text-slate-900">{item.display_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.primary_ip || item.equipment_type_name}</div>
                  <div className="mt-1 truncate text-xs text-slate-400">{item.location || item.manufacturer_name || "EQM"}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => addInventoryNode(item)} disabled={readOnly || !hasOpenCanvas || alreadyAdded}>Добавить</Button>
                    {alreadyAdded ? <Badge variant="secondary">На холсте</Badge> : null}
                  </div>
                </div>
              );
            })}
            {equipmentItems.length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Подходящее оборудование не найдено.</div> : null}
          </div>
        </div>
      </div>
    );
  };

  const renderDataPanel = () => selectedNode ? (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Интерфейсы</div><Button size="sm" onClick={addNodeInterface} disabled={readOnly}><Plus className="h-4 w-4" />Добавить</Button></div>
        {selectedNode.interfaces.map((item, index) => (
          <div key={`${selectedNode.id}-if-${index}`} className="space-y-2 border border-slate-200 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input value={item.name} onChange={(event) => updateNodeInterface(index, { name: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Интерфейс" disabled={readOnly} />
              <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={item.status} onChange={(event) => updateNodeInterface(index, { status: event.target.value as NodeInterface["status"] })} onBlur={handleSelectCommit} disabled={readOnly}>
                <option value="up">up</option>
                <option value="down">down</option>
                <option value="degraded">degraded</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={item.ip} onChange={(event) => updateNodeInterface(index, { ip: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="IP" disabled={readOnly} />
              <Input value={item.vlan} onChange={(event) => updateNodeInterface(index, { vlan: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="VLAN" disabled={readOnly} />
            </div>
            <Button size="sm" variant="destructive" onClick={() => removeNodeInterface(index)} disabled={readOnly}><Trash2 className="h-4 w-4" />Удалить</Button>
          </div>
        ))}
        {selectedNode.interfaces.length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Интерфейсы пока не добавлены.</div> : null}
      </div>
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Маршруты</div><Button size="sm" onClick={addRoute} disabled={readOnly}><Plus className="h-4 w-4" />Добавить</Button></div>
        {selectedNode.routes.map((route, index) => (
          <div key={`${selectedNode.id}-route-${index}`} className="space-y-2 border border-slate-200 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input value={route.prefix} onChange={(event) => updateRoute(index, { prefix: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Prefix" disabled={readOnly} />
              <Input value={route.nextHop} onChange={(event) => updateRoute(index, { nextHop: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Next hop" disabled={readOnly} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={route.protocol} onChange={(event) => updateRoute(index, { protocol: event.target.value })} onBlur={handleSelectCommit} disabled={readOnly}>{ROUTE_PROTOCOLS.map((protocol) => <option key={protocol} value={protocol}>{protocol}</option>)}</select>
              <Input value={String(route.metric)} onChange={(event) => updateRoute(index, { metric: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder="Metric" disabled={readOnly} />
            </div>
            <Button size="sm" variant="destructive" onClick={() => removeRoute(index)} disabled={readOnly}><Trash2 className="h-4 w-4" />Удалить</Button>
          </div>
        ))}
        {selectedNode.routes.length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Маршруты пока не добавлены.</div> : null}
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div className="text-sm font-semibold text-slate-900">Сервисы</div>
        <textarea
          className="min-h-[104px] w-full border border-slate-200 px-3 py-2 text-sm"
          value={selectedNode.services.join(", ")}
          onChange={(event) => updateSelectedNode({ services: event.target.value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) })}
          onBlur={handleFieldCommit}
          onKeyDown={handleFieldKeyDown}
          placeholder="dhcp, dns, nat"
          disabled={readOnly}
        />
      </div>
    </div>
  ) : <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">Выберите узел, чтобы редактировать интерфейсы, маршруты и сервисы.</div>;

  const renderGatewayPanel = () => (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-900">Трассировка пути</div>
        <div className="grid grid-cols-2 gap-2">
          <select className="h-10 w-full border border-slate-200 bg-white px-3 text-sm" value={pathStartId} onChange={(event) => setPathStartId(event.target.value)}>
            <option value="">{t("pages.networkMap.pathTracing.start")}</option>
            {topology.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </select>
          <select className="h-10 w-full border border-slate-200 bg-white px-3 text-sm" value={pathEndId} onChange={(event) => setPathEndId(event.target.value)}>
            <option value="">{t("pages.networkMap.pathTracing.end")}</option>
            {topology.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => selectedNode && setPathStartId(selectedNode.id)} disabled={!selectedNode}>Источник = выбор</Button>
          <Button variant="outline" size="sm" onClick={() => selectedNode && setPathEndId(selectedNode.id)} disabled={!selectedNode}>Назначение = выбор</Button>
          <Button variant="outline" size="sm" onClick={() => { setPathStartId(""); setPathEndId(""); }}>Очистить</Button>
        </div>
        <div className="border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600">
          {tracedPath.nodeIds.length > 0 ? `Путь найден: ${tracedPath.nodeIds.length} узл., ${tracedPath.edgeIds.length} связ.` : "Выберите начальный и конечный узлы, чтобы подсветить маршрут на холсте."}
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Политики</div><Button size="sm" onClick={addPolicy} disabled={readOnly}><Plus className="h-4 w-4" />Добавить</Button></div>
        {topology.policies.map((policy) => (
          <div key={policy.id} className="space-y-2 border border-slate-200 p-3">
            <Input value={policy.name} onChange={(event) => updatePolicy(policy.id, { name: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.name")} disabled={readOnly} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={policy.type} onChange={(event) => updatePolicy(policy.id, { type: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.type")} disabled={readOnly} />
              <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={policy.state} onChange={(event) => updatePolicy(policy.id, { state: event.target.value as TopologyPolicy["state"] })} onBlur={handleSelectCommit} disabled={readOnly}>
                <option value="active">{t("pages.networkMap.policyState.active")}</option>
                <option value="triggered">{t("pages.networkMap.policyState.triggered")}</option>
                <option value="disabled">{t("pages.networkMap.policyState.disabled")}</option>
              </select>
            </div>
            <Input value={policy.target} onChange={(event) => updatePolicy(policy.id, { target: event.target.value })} onBlur={handleFieldCommit} onKeyDown={handleFieldKeyDown} placeholder={t("pages.networkMap.fields.target")} disabled={readOnly} />
            <Button size="sm" variant="destructive" onClick={() => removePolicy(policy.id)} disabled={readOnly}><Trash2 className="h-4 w-4" />Удалить</Button>
          </div>
        ))}
        {topology.policies.length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("pages.networkMap.policies.empty")}</div> : null}
      </div>
    </div>
  );

  const renderDiagnosticsPanel = () => (
    <div className="space-y-3">
      {validation.length === 0 ? <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{t("pages.networkMap.validation.clear")}</div> : null}
      {validation.map((item) => <div key={item.id} className={cn("border p-3", item.severity === "critical" ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40")}><div className="text-sm font-semibold">{item.title}</div><div className="mt-1 text-xs text-slate-500">{item.detail}</div></div>)}
    </div>
  );

  const inspectorPanel = <Card className="h-full min-w-0 overflow-hidden border-slate-200 shadow-none"><CardHeader className="border-b border-slate-200"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><CardTitle>Свойства</CardTitle><CardDescription>{saveStateLabel}</CardDescription></div><Badge variant={saveState === "error" ? "destructive" : saveState === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2">{([["selection", "Свойства"], ["data", "Данные"], ["gateway", "Шлюз"], ["diagnostics", "Диагностика"]] as const).map(([tab, label]) => <button key={tab} type="button" className={cn("min-h-11 min-w-0 border px-2 py-2 text-xs font-medium leading-tight whitespace-normal [word-break:break-word]", inspectorTab === tab ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")} onClick={() => setInspectorTab(tab)}>{label}</button>)}</div></CardHeader><CardContent className="max-h-[calc(100vh-210px)] overflow-auto p-5">{inspectorTab === "selection" ? renderSelectionPanel() : inspectorTab === "data" ? renderDataPanel() : inspectorTab === "gateway" ? renderGatewayPanel() : renderDiagnosticsPanel()}</CardContent></Card>;

  const sidebarPanel = <Card className="h-full min-w-0 overflow-hidden border-slate-200 shadow-none"><CardHeader className="border-b border-slate-200"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-slate-500" />Контуры</CardTitle><CardDescription>Каждая схема хранится как отдельный серверный документ.</CardDescription></div>{activeId !== null ? <Badge variant="outline">{saveStateLabel}</Badge> : null}</div><div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" className={sidebarActionButtonClass} onClick={openCreateDialog} disabled={readOnly}><Plus className="h-4 w-4 shrink-0" />Новая схема</Button><Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={openSelectedDocument} disabled={selectedDocumentId === null}>Открыть</Button><Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={() => setIsEditingSelectedDocument(true)} disabled={selectedDocumentId === null || readOnly}>Редактировать</Button><Button size="sm" className={sidebarActionButtonClass} variant="destructive" onClick={() => { void handleDeleteSelectedDocument(); }} disabled={selectedDocumentId === null || readOnly}><Trash2 className="h-4 w-4 shrink-0" />Удалить</Button><Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={() => fileInputRef.current?.click()} disabled={readOnly}><Upload className="h-4 w-4 shrink-0" />Импорт</Button><Button size="sm" className={sidebarActionButtonClass} variant="outline" onClick={() => exportDocument(topology, `${documentName || "network-topology"}.json`)} disabled={!hasOpenCanvas}><Upload className="h-4 w-4 shrink-0" />Экспорт JSON</Button></div></CardHeader><CardContent className="grid gap-4 p-5"><Input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="Поиск по схемам" /><div className="space-y-2 min-w-0"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900">Список схем</div><div className="text-xs text-slate-500">{filteredTopologies.length} / {allTopologies.length}</div></div><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px_36px_48px_32px] items-center gap-1.5 border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"><div>Схема</div><div className="text-center">Узлы</div><div className="text-center">Связи</div><div className="text-center">Предупр.</div><div className="text-center">X</div></div><div className="max-h-[42vh] overflow-auto border-x border-b border-slate-200 bg-slate-50/30 pr-1"><div className="space-y-px bg-slate-200">{filteredTopologies.map((item) => <CompactDocumentRow key={item.id} item={item} selected={item.id === selectedDocumentId} active={item.id === activeId} onClick={() => { setSelectedDocumentId(item.id); setIsEditingSelectedDocument(false); }} onDelete={() => setPendingDeleteDocument({ id: item.id, name: item.name })} />)}{filteredTopologies.length === 0 ? <div className="border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">Сетевые схемы не найдены.</div> : null}</div></div></div><div className="space-y-3 border-t border-slate-200 pt-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Предпросмотр</div><div className="text-xs text-slate-500">{selectedDocumentId !== null && activeId === selectedDocumentId ? "Открыто на холсте" : "Выбрано в списке схем"}</div></div>{selectedDocumentId !== null && activeId === selectedDocumentId ? <Badge variant="success">Активен</Badge> : null}</div>{isEditingSelectedDocument ? <div className="space-y-3 border border-slate-200 p-3"><Input value={selectedDocumentName} onChange={(event) => setSelectedDocumentName(event.target.value)} onBlur={() => { void handleMetadataDraftCommit(); }} onKeyDown={handleMetadataDraftKeyDown} placeholder="Название схемы" disabled={readOnly} /><Input value={selectedDocumentDescription} onChange={(event) => setSelectedDocumentDescription(event.target.value)} onBlur={() => { void handleMetadataDraftCommit(); }} onKeyDown={handleMetadataDraftKeyDown} placeholder="Описание" disabled={readOnly} /><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { void handleSaveSelectedMetadata(); }} disabled={readOnly}><Save className="h-4 w-4" />Сохранить</Button><Button size="sm" variant="outline" onClick={() => setIsEditingSelectedDocument(false)}>Отмена</Button></div></div> : <DocumentPreviewCard active={activeId === selectedDocumentId} title={previewTitle} subtitle={previewDescription} updatedAt={previewUpdatedAt} stats={previewStats} />}</div></CardContent></Card>;

  return (
    <div className="space-y-4 text-slate-900">
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} />
      <Card className="border-slate-200 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-xl">{t("pages.networkMap.title")}</CardTitle>
              <CardDescription>{t("pages.networkMap.subtitle")}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Узлы: {topology.nodes.length}</Badge>
              <Badge variant="outline">Связи: {topology.edges.length}</Badge>
              <Badge variant="outline">Предупр.: {nodeWarnings}</Badge>
              <Badge variant="outline">Критич.: {nodeCritical}</Badge>
              <Badge variant="outline">Интерф.: {totalInterfaces}</Badge>
              <Badge variant="outline">Маршр.: {totalRoutes}</Badge>
              <Badge variant={saveState === "error" ? "destructive" : saveState === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:hidden">
            <Button size="sm" variant="outline" onClick={() => setIsSidebarDrawerOpen(true)}><PanelLeft className="h-4 w-4" />Контуры</Button>
            <Button size="sm" variant="outline" onClick={() => setIsInspectorDrawerOpen(true)}><PanelRight className="h-4 w-4" />Свойства</Button>
          </div>
        </CardHeader>
      </Card>

      {message ? <div className={cn("flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm", message.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800")}><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /><span>{message.text}</span></div></div> : null}

      <div ref={canvasShellRef} className={cn("grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]", isFullscreen && "grid-cols-[minmax(0,1fr)] bg-white p-4")}>
        {!isFullscreen ? <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start">{sidebarPanel}</div> : null}
        <Card className="overflow-hidden border-slate-200 shadow-none">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Menubar className="w-fit">
                  <MenubarMenu>
                    <MenubarTrigger>Правка</MenubarTrigger>
                    <MenubarContent>
                      <MenubarLabel>Выделение</MenubarLabel>
                      <MenubarItem onClick={copySelection} disabled={!canCopySelection}><span>Копировать</span><MenubarShortcut>Ctrl/Cmd+C</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={pasteSelection} disabled={!canPasteSelection}><span>Вставить</span><MenubarShortcut>Ctrl/Cmd+V</MenubarShortcut></MenubarItem>
                      <MenubarSeparator />
                      <MenubarLabel>Изменить</MenubarLabel>
                      <MenubarItem onClick={duplicateSelection} disabled={!canDuplicateSelection}><span>Дублировать</span><MenubarShortcut>Ctrl/Cmd+D</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={() => { setInspectorTab("selection"); if (!isInspectorDrawerOpen) setIsInspectorDrawerOpen(true); }} disabled={!selectedCount}><span>Редактировать</span></MenubarItem>
                      <MenubarItem className="text-red-600 hover:bg-red-50" onClick={() => { void handleDeleteSelection(); }} disabled={!canDeleteSelection}><span>Удалить</span><MenubarShortcut>Del</MenubarShortcut></MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Вид</MenubarTrigger>
                    <MenubarContent>
                      <MenubarCheckboxItem checked={showMiniMap} onClick={() => setShowMiniMap((value) => !value)}>Миникарта</MenubarCheckboxItem>
                      <MenubarCheckboxItem checked={showGrid} onClick={() => setShowGrid((value) => !value)}>Сетка</MenubarCheckboxItem>
                      <MenubarSeparator />
                      <MenubarItem onClick={resetView} disabled={!hasOpenCanvas}><span>Сбросить вид</span><MenubarShortcut>1:1</MenubarShortcut></MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>
                <Button size="icon" variant="outline" onClick={undo} disabled={!history.past.length} title="Отменить"><ArrowDownUp className="h-4 w-4 rotate-90" /></Button>
                <Button size="icon" variant="outline" onClick={redo} disabled={!history.future.length} title="Повторить"><ArrowDownUp className="h-4 w-4 -rotate-90" /></Button>
                <div className="mx-1 hidden h-6 w-px bg-slate-200 xl:block" />
                <Button size="icon" variant={toolMode === "select" ? "default" : "outline"} onClick={() => { setPendingConnectId(null); setToolMode("select"); }} disabled={!hasOpenCanvas} title="Курсор"><MousePointer2 className="h-4 w-4" /></Button>
                <Button size="icon" variant={toolMode === "pan" ? "default" : "outline"} onClick={() => { setPendingConnectId(null); setToolMode((value) => value === "pan" ? "select" : "pan"); }} disabled={!hasOpenCanvas} title="Рука"><Hand className="h-4 w-4" /></Button>
                <div className="mx-1 hidden h-6 w-px bg-slate-200 xl:block" />
                <Button size="icon" variant="outline" onClick={copySelection} disabled={!canCopySelection} title="Копировать"><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={pasteSelection} disabled={!canPasteSelection} title="Вставить"><ClipboardPaste className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={duplicateSelection} disabled={!canDuplicateSelection} title="Дублировать"><CopyPlus className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={() => { void handleDeleteSelection(); }} disabled={!canDeleteSelection} title="Удалить"><Trash2 className="h-4 w-4" /></Button>
                <div className="mx-1 hidden h-6 w-px bg-slate-200 xl:block" />
                <div ref={addNodeMenuRef} className="relative">
                  <Button size="icon" variant="outline" onClick={() => setIsAddNodeMenuOpen((value) => !value)} disabled={readOnly || !hasOpenCanvas} title="Добавить узел"><Plus className="h-4 w-4" /></Button>
                  {isAddNodeMenuOpen ? <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-48 overflow-auto border border-slate-200 bg-white p-1 shadow-lg">{NETWORK_NODE_TYPES.map((type) => <button key={type} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { addManualNode(type); setIsAddNodeMenuOpen(false); }}>{getNodeTypeLabel(type)}</button>)}</div> : null}
                </div>
                <Button size="icon" variant={toolMode === "connect" ? "default" : "outline"} onClick={() => setToolMode((value) => value === "connect" ? "select" : "connect")} disabled={readOnly || !hasOpenCanvas} title="Режим связи"><Link2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={() => { mutateCurrentTopology((document) => autoLayout(document)); commitUserAction(); }} disabled={!hasOpenCanvas} title="Автораскладка"><Rows3 className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={fitView} disabled={!hasOpenCanvas} title="Уместить"><Minimize2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={() => void toggleFullscreen()} disabled={!hasOpenCanvas} title={isFullscreen ? "Свернуть из полноэкранного режима" : "Развернуть на весь экран"}>{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                <div ref={searchPanelRef} className="relative min-w-0 xl:w-[280px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" value={canvasSearch} onChange={(event) => { setCanvasSearch(event.target.value); setIsSearchResultsOpen(event.target.value.trim().length > 0); }} onFocus={() => setIsSearchResultsOpen(canvasSearch.trim().length > 0)} placeholder="Поиск узлов по имени, IP, VLAN и зоне" />
                  {canvasSearch.trim() && isSearchResultsOpen ? <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-full overflow-auto border border-slate-200 bg-white shadow-lg">{searchResults.length ? searchResults.map((node) => <button key={node.id} type="button" className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0" onClick={() => focusSearchResult(node.id)}><div className="truncate text-sm font-semibold text-slate-900">{node.name}</div><div className="mt-1 text-xs text-slate-500">{getNodeTypeLabel(node.type)} · {node.ip || "IP не задан"}{node.vlan ? ` · VLAN ${node.vlan}` : ""}</div></button>) : <div className="px-3 py-3 text-sm text-slate-500">Совпадений не найдено.</div>}</div> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Выбор: {selectedCount}</Badge>
                  <Badge variant="outline">{Math.round((topology.zoom ?? defaultZoom) * 100)}%</Badge>
                  <Badge variant="outline">Политики: {totalPolicies}</Badge>
                  <Badge variant={saveState === "error" ? "destructive" : saveState === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge>
                </div>
              </div>
            </div>
          </div>

          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="min-w-0">
              <CardTitle>Холст сетевой топологии</CardTitle>
              <CardDescription>{visibleNodes.length} видимых узлов, {topology.edges.length} видимых связей</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div
              ref={wrapperRef}
              onWheel={handleWheel}
              onPointerDown={beginCanvasInteraction}
              onDrop={(event) => { void handleDropImport(event); }}
              onDragOver={(event) => event.preventDefault()}
              className={cn("relative h-[calc(100vh-260px)] min-h-[680px] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(239,246,255,0.95))]", isFullscreen && "h-screen min-h-screen bg-white")}
            >
              {!hasOpenCanvas ? <EmptyCanvasState title={allTopologies.length > 0 ? "Нет открытой схемы" : "Сетевые схемы не найдены"} description={allTopologies.length > 0 ? "Выберите схему в файловом sidebar и нажмите Открыть." : "Создайте новую схему или импортируйте JSON, чтобы начать."} primaryAction={allTopologies.length > 0 ? <Button size="sm" onClick={openSelectedDocument} disabled={selectedDocumentId === null}>Открыть</Button> : <Button size="sm" onClick={openCreateDialog} disabled={readOnly}><Plus className="h-4 w-4" />Новая схема</Button>} secondaryAction={<Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={readOnly}><Upload className="h-4 w-4" />Импорт</Button>} /> : null}
              <svg width="100%" height="100%" style={{ display: "block" }}>
                <defs><pattern id="network-grid" width={showGrid ? 32 : 99999} height={showGrid ? 32 : 99999} patternUnits="userSpaceOnUse"><path d={`M ${showGrid ? 32 : 99999} 0 L 0 0 0 ${showGrid ? 32 : 99999}`} fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.75" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#network-grid)" />
                <g transform={`translate(${topology.viewport?.x || 0} ${topology.viewport?.y || 0}) scale(${topology.zoom ?? defaultZoom})`}>
                  {topology.edges.map((edge) => {
                    const from = topology.nodes.find((node) => node.id === edge.from);
                    const to = topology.nodes.find((node) => node.id === edge.to);
                    if (!from || !to) return null;
                    const a = centerOf(from);
                    const b = centerOf(to);
                    const traced = tracedPath.edgeIds.includes(edge.id);
                    const selected = selectedEdgeId === edge.id;
                    const stroke = getEdgeStroke(edge, selected, traced);
                    return <g key={edge.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeIds([]); setInspectorTab("selection"); }}><path d={edgePath(edge)} fill="none" stroke={selected ? "rgba(37,99,235,0.18)" : "rgba(15,23,42,0.08)"} strokeWidth={stroke.width + 5} strokeLinecap="round" /><path d={edgePath(edge)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeDasharray={stroke.dash} strokeLinecap="round" /><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 10} fill={selected ? "#2563eb" : "#334155"} fontSize="11" fontWeight="700" textAnchor="middle">{edge.label || edge.network || edge.style}</text></g>;
                  })}
                  {topology.nodes.map((node) => {
                    const palette = getStatusPalette(node.status);
                    const selected = selectedNodeIds.includes(node.id);
                    const traced = tracedPath.nodeIds.includes(node.id);
                    const visible = visibleNodeIds.has(node.id);
                    const headerFill = traced ? "#dbeafe" : palette.soft;
                    const stroke = selected ? "#2563eb" : traced ? "#60a5fa" : palette.stroke;
                    return <g key={node.id} transform={`translate(${node.x} ${node.y})`} onPointerDown={(event) => beginNodeInteraction(event, node.id)} style={{ cursor: toolMode === "connect" ? "crosshair" : "grab", opacity: visible ? 1 : 0.35 }}><rect width={nodeWidth} height={nodeHeight} rx="4" fill="#ffffff" stroke={stroke} strokeWidth={selected ? 4 : 2.2} filter={selected ? "drop-shadow(0 12px 18px rgba(37,99,235,0.18))" : "drop-shadow(0 10px 18px rgba(15,23,42,0.10))"} /><rect width={nodeWidth} height="28" fill={headerFill} /><text x="14" y="19" fill="#0f172a" fontSize="12" fontWeight="800">{getNodeTypeLabel(node.type).toUpperCase()}</text><text x="14" y="50" fill="#0f172a" fontSize="16" fontWeight="800">{node.name}</text><text x="14" y="68" fill="#475569" fontSize="12" fontWeight="700">{node.ip || "IP не задан"}{node.vlan ? ` · VLAN ${node.vlan}` : ""}</text><text x="14" y="84" fill="#64748b" fontSize="11" fontWeight="700">{node.model || node.layer}</text><text x="14" y="98" fill="#94a3b8" fontSize="10" fontWeight="700">{node.zone || node.os || "Без зоны"}</text>{pendingConnectId === node.id ? <circle cx={nodeWidth - 18} cy={16} r={7} fill="#2563eb" /> : null}</g>;
                  })}
                  {logicalSelectionRect ? <rect x={logicalSelectionRect.x} y={logicalSelectionRect.y} width={logicalSelectionRect.width} height={logicalSelectionRect.height} fill="rgba(37,99,235,0.12)" stroke="#2563eb" strokeDasharray="8 6" /> : null}
                </g>
              </svg>
              {isFullscreen ? <div className="absolute right-4 top-4 z-20 w-[min(360px,calc(100vw-32px))]" onPointerDown={(event) => event.stopPropagation()}>{inspectorPanel}</div> : null}
              {showMiniMap ? <Card className="absolute bottom-4 right-4 w-[190px] rounded-none border-slate-200 bg-white/95 shadow-sm"><CardContent className="p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Миникарта</div><svg width="100%" height="120" viewBox={`${miniMapViewBox.x} ${miniMapViewBox.y} ${miniMapViewBox.width} ${miniMapViewBox.height}`} onPointerDown={handleMiniMapPointerDown} style={{ cursor: "pointer" }}>{topology.edges.map((edge) => <path key={edge.id} d={edgePath(edge)} fill="none" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />)}{topology.nodes.map((node) => <rect key={node.id} x={node.x} y={node.y} width={nodeWidth} height={nodeHeight} fill={selectedNodeIds.includes(node.id) ? "#93c5fd" : "#e2e8f0"} stroke="#64748b" strokeWidth="3" onPointerDown={(event) => { event.stopPropagation(); focusNode(node.id); }} style={{ cursor: "pointer" }} />)}{miniMapViewportRect ? <rect x={miniMapViewportRect.x} y={miniMapViewportRect.y} width={miniMapViewportRect.width} height={miniMapViewportRect.height} fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth="4" pointerEvents="none" /> : null}</svg></CardContent></Card> : null}
              <div className="pointer-events-none absolute bottom-4 left-4 border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-500 shadow-sm"><div className="flex items-center gap-2"><Grip className="h-3.5 w-3.5" /> Панорама: drag по пустому холсту или wheel</div><div className="mt-1 flex items-center gap-2"><ArrowDownUp className="h-3.5 w-3.5" /> Выбор: клик, Shift-мультивыбор или рамка</div><div className="mt-1 flex items-center gap-2"><Route className="h-3.5 w-3.5" /> Маршрут и диагностика управляются справа</div></div>
            </div>
          </CardContent>
        </Card>
        {!isFullscreen ? <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-24px)]">{inspectorPanel}</div> : null}
      </div>

      {isCreateDialogOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onClick={() => setIsCreateDialogOpen(false)}><div className="w-full max-w-md border border-slate-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="text-lg font-semibold text-slate-900">Новая схема</div><div className="mt-1 text-sm text-slate-500">Укажите имя новой сетевой схемы перед созданием серверного документа.</div><div className="mt-4 space-y-3"><div className="space-y-1.5"><div className="text-sm font-medium text-slate-900">Название</div><Input value={createNameDraft} onChange={(event) => setCreateNameDraft(event.target.value)} placeholder="Название схемы" autoFocus /></div><div className="space-y-1.5"><div className="text-sm font-medium text-slate-900">Описание</div><Input value={createDescriptionDraft} onChange={(event) => setCreateDescriptionDraft(event.target.value)} placeholder="Описание (необязательно)" /></div></div><div className="mt-5 flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button><Button size="sm" onClick={() => { void handleCreateDocumentConfirm(); }} disabled={!createNameDraft.trim() || readOnly}><Plus className="h-4 w-4" />Создать</Button></div></div></div> : null}
      {pendingDeleteDocument ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onClick={() => setPendingDeleteDocument(null)}><div className="w-full max-w-md border border-slate-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="text-lg font-semibold text-slate-900">Удалить схему?</div><div className="mt-2 text-sm text-slate-500">Схема <span className="font-semibold text-slate-900">"{pendingDeleteDocument.name}"</span> будет удалена с сервера. Это действие нельзя отменить.</div><div className="mt-5 flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setPendingDeleteDocument(null)}>Отмена</Button><Button size="sm" variant="destructive" onClick={() => { void handleDeleteDocument(pendingDeleteDocument.id); }} disabled={readOnly}><Trash2 className="h-4 w-4" />Удалить</Button></div></div></div> : null}
      {isSidebarDrawerOpen ? <div className="fixed inset-0 z-50 bg-slate-900/35 xl:hidden" onClick={() => setIsSidebarDrawerOpen(false)}><div className="h-full w-[min(92vw,360px)] bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Контуры</div><Button size="sm" variant="outline" onClick={() => setIsSidebarDrawerOpen(false)}>Закрыть</Button></div>{sidebarPanel}</div></div> : null}
      {isInspectorDrawerOpen ? <div className="fixed inset-0 z-50 bg-slate-900/35 xl:hidden" onClick={() => setIsInspectorDrawerOpen(false)}><div className="ml-auto h-full w-[min(94vw,420px)] bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Свойства</div><Button size="sm" variant="outline" onClick={() => setIsInspectorDrawerOpen(false)}>Закрыть</Button></div>{inspectorPanel}</div></div> : null}
    </div>
  );
}
