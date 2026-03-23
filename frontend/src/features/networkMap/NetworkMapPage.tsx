
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  MiniMap,
  type Connection,
  type NodeChange,
  type OnMoveEnd,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  AlertCircle,
  ArrowDownUp,
  Grip,
  Layers3,
  Link2,
  Plus,
  Route,
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
import { cn } from "../../lib/utils";
import {
  createNetworkTopology,
  deleteNetworkTopology,
  getNetworkTopology,
  listNetworkTopologies,
  listNetworkTopologyEligibleEquipment,
  updateNetworkTopology,
} from "./api";
import { NetworkMapEdge } from "./NetworkMapEdge";
import { NetworkMapNode } from "./NetworkMapNode";
import type {
  NetworkEdge,
  NetworkNode,
  NetworkTopologyDocumentRecord,
  SaveState,
  TopologyDocument,
  TopologyPolicy,
} from "./types";
import {
  DEFAULT_DOCUMENT,
  NETWORK_EDGE_STYLES,
  NETWORK_LAYERS,
  NETWORK_NODE_TYPES,
  addEdgeFromConnection,
  applyNodePositionChanges,
  autoLayout,
  computeShortestPath,
  computeTopologyValidation,
  createEmptyPolicy,
  createId,
  createManualNode,
  createNodeFromEquipment,
  deleteEdge,
  deleteNodes,
  duplicateNodes,
  exportDocument,
  importDocumentFromFile,
  isEquipmentAlreadyOnCanvas,
  toFlowEdge,
  toFlowNode,
  updateEdge,
  updateNode,
} from "./utils";

const nodeTypes = { networkNode: NetworkMapNode };
const edgeTypes = { networkEdge: NetworkMapEdge };

type LinkCreationMode = "idle" | "picking";
type InspectorTab = "selection" | "inventory" | "path" | "validation";

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
  const { t } = useTranslation();
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
        {active ? <Badge className="bg-white text-slate-900">{t("pages.networkMap.documents.active")}</Badge> : null}
      </div>
      <div className="mt-3 grid grid-cols-[92px_minmax(0,1fr)] gap-3">
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
        <div className="grid grid-cols-3 gap-2">
          <div className={cn("px-2 py-1.5", active ? "bg-white/8" : "bg-slate-50")}><div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>{t("pages.networkMap.stats.devices")}</div><div className="mt-1 text-sm font-semibold">{stats.nodes}</div></div>
          <div className={cn("px-2 py-1.5", active ? "bg-white/8" : "bg-slate-50")}><div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>{t("pages.networkMap.stats.links")}</div><div className="mt-1 text-sm font-semibold">{stats.edges}</div></div>
          <div className={cn("px-2 py-1.5", active ? "bg-white/8" : "bg-slate-50")}><div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>{t("pages.networkMap.stats.warnings")}</div><div className="mt-1 text-sm font-semibold">{stats.warnings}</div></div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span>{updatedAt}</span><span>{stats.nodes + stats.edges > 0 ? `${Math.round((stats.edges / Math.max(stats.nodes, 1)) * 100)}%` : "--"}</span></div>
    </div>
  );
}

function CompactDocumentRow({ item, selected, active, onClick }: { item: NetworkTopologyDocumentRecord; selected: boolean; active: boolean; onClick: () => void }) {
  const warningCount =
    item.document.nodes.filter((node) => node.status !== "healthy").length +
    item.document.edges.filter((edge) => edge.status !== "healthy").length;

  return (
    <button
      type="button"
      className={cn(
        "grid w-full grid-cols-[minmax(0,1.7fr)_56px_56px_72px] items-center gap-2 border-l-2 px-3 py-2.5 text-left text-[12px] transition",
        selected
          ? "border-l-slate-900 border-y-slate-900 border-r-slate-900 bg-slate-900 text-white"
          : "border-l-slate-300 border-y-slate-200 border-r-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      )}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold">{item.name}</div>
          {active ? <Badge variant="secondary" className="shrink-0 px-2 py-0 text-[10px]">LIVE</Badge> : null}
        </div>
        <div className={cn("mt-1 truncate text-[11px]", selected ? "text-slate-300" : "text-slate-500")}>{item.description || "Без описания"}</div>
      </div>
      <div className={cn("text-center font-semibold", selected ? "text-white" : "text-slate-700")}>{item.document.nodes.length}</div>
      <div className={cn("text-center font-semibold", selected ? "text-white" : "text-slate-700")}>{item.document.edges.length}</div>
      <div className={cn("text-center font-semibold", selected ? "text-white" : warningCount > 0 ? "text-amber-600" : "text-slate-500")}>{warningCount}</div>
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
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const readOnly = !canWrite;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const hydratingRef = useRef(false);

  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [topology, setTopology] = useState<TopologyDocument>(DEFAULT_DOCUMENT);
  const [isDraftDocument, setIsDraftDocument] = useState(false);
  const [isEditingSelectedDocument, setIsEditingSelectedDocument] = useState(false);
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [selectedDocumentDescription, setSelectedDocumentDescription] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [canvasSearch, setCanvasSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [newNodeType, setNewNodeType] = useState<NetworkNode["type"]>("router");
  const [newEdgeStyle, setNewEdgeStyle] = useState<NetworkEdge["style"]>("ethernet");
  const [pathStartId, setPathStartId] = useState("");
  const [pathEndId, setPathEndId] = useState("");
  const [selectedSubnetId, setSelectedSubnetId] = useState<number | null>(null);
  const [selectedAddressOffset, setSelectedAddressOffset] = useState<number | null>(null);
  const [linkCreationMode, setLinkCreationMode] = useState<LinkCreationMode>("idle");
  const [pendingLinkStartId, setPendingLinkStartId] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("selection");
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [isInspectorDrawerOpen, setIsInspectorDrawerOpen] = useState(false);
  const [clipboardNodes, setClipboardNodes] = useState<NetworkNode[]>([]);

  const topologiesQuery = useQuery({ queryKey: ["network-topologies"], queryFn: () => listNetworkTopologies({ page: 1, page_size: 100 }) });
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

  useEffect(() => {
    if (allTopologies.length === 0) {
      if (!isDraftDocument) {
        hydratingRef.current = true;
        setSelectedDocumentId(null);
        setDocumentName(t("pages.networkMap.defaultName"));
        setDocumentDescription("");
        setTopology(DEFAULT_DOCUMENT);
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setSaveState("idle");
        setTimeout(() => { hydratingRef.current = false; }, 0);
      }
      return;
    }
    if (selectedDocumentId === null && !isDraftDocument) setSelectedDocumentId(allTopologies[0].id);
    if (selectedDocumentId !== null && !allTopologies.some((item) => item.id === selectedDocumentId)) setSelectedDocumentId(allTopologies[0]?.id ?? null);
    if (activeId !== null && !allTopologies.some((item) => item.id === activeId)) setActiveId(null);
  }, [activeId, allTopologies, isDraftDocument, selectedDocumentId, t]);

  useEffect(() => {
    if (selectedDocument) {
      setSelectedDocumentName(selectedDocument.name);
      setSelectedDocumentDescription(selectedDocument.description || "");
    } else if (isDraftDocument) {
      setSelectedDocumentName(documentName);
      setSelectedDocumentDescription(documentDescription);
    } else {
      setSelectedDocumentName("");
      setSelectedDocumentDescription("");
    }
  }, [documentDescription, documentName, isDraftDocument, selectedDocument]);

  useEffect(() => {
    if (!detailQuery.data) return;
    hydratingRef.current = true;
    setIsDraftDocument(false);
    setSelectedDocumentId(detailQuery.data.id);
    setDocumentName(detailQuery.data.name);
    setDocumentDescription(detailQuery.data.description || "");
    setTopology(detailQuery.data.document || DEFAULT_DOCUMENT);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedSubnetId(null);
    setSelectedAddressOffset(null);
    setSaveState("saved");
    setTimeout(() => { hydratingRef.current = false; }, 0);
  }, [detailQuery.data]);

  const mutateTopology = (updater: TopologyDocument | ((current: TopologyDocument) => TopologyDocument)) => {
    let changed = false;
    setTopology((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      changed = next !== current;
      return next;
    });
    if (!hydratingRef.current && changed) {
      setSaveState("idle");
      setDirtyVersion((value) => value + 1);
    }
  };

  useEffect(() => {
    if (dirtyVersion === 0 || readOnly || (!isDraftDocument && activeId === null)) return;
    const timer = window.setTimeout(async () => {
      try {
        setSaveState("saving");
        if (activeId === null) {
          const created = await createNetworkTopology({ name: documentName || t("pages.networkMap.defaultName"), description: documentDescription || null, scope: "engineering", document: topology });
          setIsDraftDocument(false);
          setActiveId(created.id);
          setSelectedDocumentId(created.id);
          queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
          queryClient.setQueryData(["network-topology", created.id], created);
        } else {
          const updated = await updateNetworkTopology(activeId, { name: documentName || t("pages.networkMap.defaultName"), description: documentDescription || null, scope: "engineering", document: topology });
          queryClient.setQueryData(["network-topology", activeId], updated);
          queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
        }
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [activeId, dirtyVersion, documentDescription, documentName, isDraftDocument, queryClient, readOnly, t, topology]);

  const tracedPath = useMemo(() => computeShortestPath(topology, pathStartId, pathEndId), [pathEndId, pathStartId, topology]);
  const validation = useMemo(() => computeTopologyValidation(topology), [topology]);
  const rfNodes = useMemo(() => topology.nodes.map((node) => ({ ...toFlowNode(node), data: { node, traced: tracedPath.nodeIds.includes(node.id) } })), [topology.nodes, tracedPath.nodeIds]);
  const rfEdges = useMemo(() => topology.edges.map((edge) => ({ ...toFlowEdge(edge), data: { edge, traced: tracedPath.edgeIds.includes(edge.id) } })), [topology.edges, tracedPath.edgeIds]);

  const selectedNode = selectedNodeIds.length === 1 ? topology.nodes.find((node) => node.id === selectedNodeIds[0]) || null : null;
  const selectedEdge = selectedEdgeId ? topology.edges.find((edge) => edge.id === selectedEdgeId) || null : null;
  const inventoryItems = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const items = inventoryQuery.data || [];
    if (!q) return items;
    return items.filter((item) => [item.display_name, item.equipment_type_name, item.manufacturer_name || "", item.location || "", item.primary_ip || ""].join(" ").toLowerCase().includes(q));
  }, [inventoryQuery.data, inventorySearch]);
  const inventoryPresence = useMemo(() => new Map(inventoryItems.map((item) => [`${item.equipment_source}:${item.equipment_item_id}`, isEquipmentAlreadyOnCanvas(topology, item)])), [inventoryItems, topology]);
  const filteredTopologies = useMemo(() => {
    const q = documentSearch.trim().toLowerCase();
    if (!q) return allTopologies;
    return allTopologies.filter((item) => [item.name, item.description || ""].join(" ").toLowerCase().includes(q));
  }, [allTopologies, documentSearch]);
  const visibleNodeCount = useMemo(() => {
    const q = canvasSearch.trim().toLowerCase();
    if (!q) return topology.nodes.length;
    return topology.nodes.filter((node) => [node.name, node.model, node.ip, node.vlan, node.zone].join(" ").toLowerCase().includes(q)).length;
  }, [canvasSearch, topology.nodes]);

  const nodeWarnings = validation.filter((item) => item.severity === "warning").length;
  const nodeCritical = validation.filter((item) => item.severity === "critical").length;
  const totalInterfaces = topology.nodes.reduce((sum, node) => sum + node.interfaces.length, 0);
  const totalRoutes = topology.nodes.reduce((sum, node) => sum + node.routes.length, 0);
  const selectedCount = selectedNodeIds.length + (selectedEdgeId ? 1 : 0);
  const availableSubnets = subnetsQuery.data?.items || [];
  const selectedSubnet = availableSubnets.find((item) => item.id === selectedSubnetId) || null;
  const selectableAddresses = useMemo(() => {
    const items = subnetAddressesQuery.data?.items || [];
    return items.filter((item) => item.status === "free" || (selectedNode?.ip && item.ip_address === selectedNode.ip));
  }, [selectedNode?.ip, subnetAddressesQuery.data?.items]);
  const selectedAddress = selectableAddresses.find((item) => item.ip_offset === selectedAddressOffset) || null;

  const saveStateLabel = saveState === "saving" ? t("pages.networkMap.states.saving") : saveState === "error" ? t("pages.networkMap.states.error") : saveState === "saved" ? t("pages.networkMap.states.saved") : t("pages.networkMap.states.unsaved");
  const previewTitle = isDraftDocument && selectedDocumentId === null ? documentName || t("pages.networkMap.defaultName") : selectedDocument?.name || "";
  const previewDescription = isDraftDocument && selectedDocumentId === null ? documentDescription || t("pages.networkMap.documents.noDescription") : selectedDocument?.description || t("pages.networkMap.documents.noDescription");
  const previewDocument = isDraftDocument && selectedDocumentId === null ? topology : selectedDocument?.document || null;
  const previewUpdatedAt = isDraftDocument && selectedDocumentId === null ? saveStateLabel : selectedDocument ? new Date(selectedDocument.updated_at).toLocaleString(i18n.language) : "";
  const previewStats = previewDocument ? { nodes: previewDocument.nodes.length, edges: previewDocument.edges.length, warnings: previewDocument.nodes.filter((node) => node.status !== "healthy").length + previewDocument.edges.filter((edge) => edge.status !== "healthy").length } : null;

  useEffect(() => {
    if (!interactionMessage) return;
    const timer = window.setTimeout(() => setInteractionMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [interactionMessage]);

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

  const placeAtCanvasCenter = () => {
    const instance = flowRef.current;
    const wrapper = wrapperRef.current;
    if (!instance || !wrapper) return { x: 240, y: 180 };
    const bounds = wrapper.getBoundingClientRect();
    return instance.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
  };

  const resetCanvasState = () => {
    hydratingRef.current = true;
    setDocumentName(t("pages.networkMap.defaultName"));
    setDocumentDescription("");
    setTopology(DEFAULT_DOCUMENT);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedSubnetId(null);
    setSelectedAddressOffset(null);
    setLinkCreationMode("idle");
    setPendingLinkStartId(null);
    setPathStartId("");
    setPathEndId("");
    setSaveState("idle");
    setTimeout(() => { hydratingRef.current = false; }, 0);
  };

  const handleStartNewDocument = async () => {
    if (readOnly) return;
    try {
      setSaveState("saving");
      const created = await createNetworkTopology({
        name: t("pages.networkMap.defaultName"),
        description: null,
        scope: "engineering",
        document: DEFAULT_DOCUMENT,
      });
      hydratingRef.current = true;
      setSelectedDocumentId(created.id);
      setActiveId(created.id);
      setIsDraftDocument(false);
      setIsEditingSelectedDocument(false);
      setDocumentName(created.name);
      setDocumentDescription(created.description || "");
      setTopology(created.document || DEFAULT_DOCUMENT);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedSubnetId(null);
      setSelectedAddressOffset(null);
      setLinkCreationMode("idle");
      setPendingLinkStartId(null);
      setPathStartId("");
      setPathEndId("");
      setSaveState("saved");
      queryClient.setQueryData(["network-topology", created.id], created);
      queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
      setTimeout(() => { hydratingRef.current = false; }, 0);
    } catch {
      setSaveState("error");
      setInteractionMessage({ tone: "warning", text: "Не удалось создать схему на сервере." });
    }
  };

  const openSelectedDocument = () => {
    if (selectedDocumentId === null) return;
    setIsEditingSelectedDocument(false);
    setActiveId(selectedDocumentId);
    setIsSidebarDrawerOpen(false);
  };

  const handleImportDocument = async (file: File) => {
    const imported = await importDocumentFromFile(file);
    hydratingRef.current = true;
    setSelectedDocumentId(null);
    setActiveId(null);
    setIsDraftDocument(true);
    setIsEditingSelectedDocument(false);
    setDocumentName(t("pages.networkMap.defaultName"));
    setDocumentDescription("");
    setTopology(imported);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedSubnetId(null);
    setSelectedAddressOffset(null);
    setLinkCreationMode("idle");
    setPendingLinkStartId(null);
    setSaveState("idle");
    setTimeout(() => { hydratingRef.current = false; }, 0);
  };

  const handleSaveSelectedMetadata = async () => {
    if (selectedDocumentId === null) {
      setDocumentName(selectedDocumentName || t("pages.networkMap.defaultName"));
      setDocumentDescription(selectedDocumentDescription);
      setIsEditingSelectedDocument(false);
      return;
    }
    const updated = await updateNetworkTopology(selectedDocumentId, { name: selectedDocumentName || t("pages.networkMap.defaultName"), description: selectedDocumentDescription || null });
    queryClient.setQueryData(["network-topology", selectedDocumentId], updated);
    queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
    if (activeId === selectedDocumentId) {
      hydratingRef.current = true;
      setDocumentName(updated.name);
      setDocumentDescription(updated.description || "");
      setTimeout(() => { hydratingRef.current = false; }, 0);
    }
    setIsEditingSelectedDocument(false);
  };

  const handleDeleteSelectedDocument = async () => {
    if (selectedDocumentId === null || readOnly) return;
    if (!window.confirm(`${t("actions.delete")}: ${selectedDocument?.name || "#"}`)) return;
    const remaining = allTopologies.filter((item) => item.id !== selectedDocumentId);
    await deleteNetworkTopology(selectedDocumentId);
    queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
    if (activeId === selectedDocumentId) {
      setActiveId(null);
      if (remaining.length === 0) {
        handleStartNewDocument();
        return;
      }
      resetCanvasState();
      setIsDraftDocument(false);
    }
    setSelectedDocumentId(remaining[0]?.id ?? null);
    setIsEditingSelectedDocument(false);
  };

  const updateSelectedNode = (patch: Partial<NetworkNode>) => {
    if (!selectedNode || readOnly) return;
    mutateTopology((current) => updateNode(current, selectedNode.id, patch));
  };
  const updateSelectedEdge = (patch: Partial<NetworkEdge>) => {
    if (!selectedEdge || readOnly) return;
    mutateTopology((current) => updateEdge(current, selectedEdge.id, patch));
  };

  const handleCreateManualNode = () => {
    if (readOnly || (activeId === null && !isDraftDocument)) return;
    const node = createManualNode(newNodeType, placeAtCanvasCenter());
    mutateTopology((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    setInspectorTab("selection");
  };

  const handleAddInventoryNode = (index: number) => {
    if (readOnly || (activeId === null && !isDraftDocument)) return;
    const item = inventoryItems[index];
    if (!item || isEquipmentAlreadyOnCanvas(topology, item)) return;
    const center = placeAtCanvasCenter();
    const node = createNodeFromEquipment(item, { x: center.x + (index % 3) * 28, y: center.y + (index % 2) * 24 });
    mutateTopology((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    setInspectorTab("selection");
  };

  const handleNodesChange = (changes: NodeChange[]) => mutateTopology((current) => applyNodePositionChanges(current, changes));
  const handleConnect = (connection: Connection) => {
    if (readOnly || (activeId === null && !isDraftDocument)) return;
    mutateTopology((current) => addEdgeFromConnection(current, connection, newEdgeStyle));
  };

  const createLinkBetweenNodes = (sourceId: string, targetId: string) => {
    if (readOnly || (activeId === null && !isDraftDocument)) return false;
    if (!sourceId || !targetId) {
      setInteractionMessage({ tone: "warning", text: t("pages.networkMap.linkCreation.selectTwoNodes") });
      return false;
    }
    if (sourceId === targetId) {
      setInteractionMessage({ tone: "warning", text: t("pages.networkMap.linkCreation.sameNode") });
      return false;
    }
    const exists = topology.edges.some((edge) => (edge.from === sourceId && edge.to === targetId) || (edge.from === targetId && edge.to === sourceId));
    if (exists) {
      setInteractionMessage({ tone: "warning", text: t("pages.networkMap.linkCreation.duplicate") });
      return false;
    }
    let createdEdgeId: string | null = null;
    mutateTopology((current) => {
      const next = addEdgeFromConnection(current, { source: sourceId, target: targetId, sourceHandle: null, targetHandle: null }, newEdgeStyle);
      if (next !== current) createdEdgeId = next.edges[next.edges.length - 1]?.id || null;
      return next;
    });
    setSelectedNodeIds([]);
    setSelectedEdgeId(createdEdgeId);
    setInspectorTab("selection");
    setInteractionMessage({ tone: "info", text: t("pages.networkMap.linkCreation.created") });
    return true;
  };

  const handleNodeLinkPick = (nodeId: string) => {
    if (readOnly || linkCreationMode !== "picking") return false;
    if (!pendingLinkStartId) {
      setPendingLinkStartId(nodeId);
      setSelectedNodeIds([nodeId]);
      setSelectedEdgeId(null);
      setInspectorTab("selection");
      setInteractionMessage({ tone: "info", text: t("pages.networkMap.linkCreation.pickSecond") });
      return true;
    }
    const created = createLinkBetweenNodes(pendingLinkStartId, nodeId);
    setPendingLinkStartId(null);
    if (created) setLinkCreationMode("idle");
    return true;
  };

  const toggleLinkCreationMode = () => {
    if (readOnly) return;
    setLinkCreationMode((current) => {
      const next = current === "picking" ? "idle" : "picking";
      if (next === "idle") setPendingLinkStartId(null); else setInteractionMessage({ tone: "info", text: t("pages.networkMap.linkCreation.pickFirst") });
      return next;
    });
  };

  const handleMoveEnd: OnMoveEnd = (_event, viewport) => mutateTopology((current) => ({ ...current, viewport: { x: viewport.x, y: viewport.y }, zoom: viewport.zoom }));
  const duplicateSelection = () => {
    if (readOnly || selectedNodeIds.length === 0) return;
    const result = duplicateNodes(topology, selectedNodeIds);
    mutateTopology(result.document);
    setSelectedNodeIds(result.newIds);
    setSelectedEdgeId(null);
  };
  const copySelection = () => {
    if (selectedNodeIds.length === 0) return;
    setClipboardNodes(topology.nodes.filter((node) => selectedNodeIds.includes(node.id)).map((node) => structuredClone(node)));
  };
  const pasteSelection = () => {
    if (clipboardNodes.length === 0 || readOnly || (activeId === null && !isDraftDocument)) return;
    const center = placeAtCanvasCenter();
    const nextNodes = clipboardNodes.map((node, index) => ({ ...structuredClone(node), id: createId("node"), x: center.x + (index % 4) * 36, y: center.y + Math.floor(index / 4) * 36, name: `${node.name} ${t("pages.serialMap.actions.copySuffix")}` }));
    mutateTopology((current) => ({ ...current, nodes: [...current.nodes, ...nextNodes] }));
    setSelectedNodeIds(nextNodes.map((node) => node.id));
    setSelectedEdgeId(null);
    setInspectorTab("selection");
  };
  const handleDeleteSelection = async () => {
    if (readOnly || (!selectedNodeIds.length && !selectedEdgeId)) return;
    if (!window.confirm(t("pages.networkMap.validation.title"))) return;
    if (selectedNodeIds.length) {
      mutateTopology((current) => deleteNodes(current, selectedNodeIds));
      setSelectedNodeIds([]);
    } else if (selectedEdgeId) {
      mutateTopology((current) => deleteEdge(current, selectedEdgeId));
      setSelectedEdgeId(null);
    }
  };
  const resetViewport = () => {
    flowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
    mutateTopology((current) => ({ ...current, viewport: { x: 0, y: 0 }, zoom: 1 }));
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

  const renderPropertiesPanel = () => {
    if (selectedNodeIds.length > 1) return <div className="border border-slate-200 p-4 text-sm text-slate-600">{t("pages.networkMap.properties.multiSelection", { count: selectedNodeIds.length })}</div>;
    if (!selectedNode && !selectedEdge) {
      return <div className="space-y-4"><div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("pages.networkMap.properties.empty")}</div><div className="grid grid-cols-2 gap-3"><div className="border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{t("pages.networkMap.stats.interfaces")}</div><div className="mt-1 text-lg font-semibold">{totalInterfaces}</div></div><div className="border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{t("pages.networkMap.stats.routes")}</div><div className="mt-1 text-lg font-semibold">{totalRoutes}</div></div><div className="border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{t("pages.networkMap.stats.warnings")}</div><div className="mt-1 text-lg font-semibold">{nodeWarnings}</div></div><div className="border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{t("pages.networkMap.stats.selection")}</div><div className="mt-1 text-lg font-semibold">{selectedCount}</div></div></div></div>;
    }
    if (selectedNode) {
      return (
        <>
          <Input value={selectedNode.name} onChange={(event) => updateSelectedNode({ name: event.target.value })} disabled={readOnly} />
          <div className="grid grid-cols-2 gap-3"><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedNode.type} onChange={(event) => updateSelectedNode({ type: event.target.value as NetworkNode["type"] })} disabled={readOnly}>{NETWORK_NODE_TYPES.map((type) => <option key={type} value={type}>{t(`pages.networkMap.nodeTypes.${type}`)}</option>)}</select><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedNode.layer} onChange={(event) => updateSelectedNode({ layer: event.target.value as NetworkNode["layer"] })} disabled={readOnly}>{NETWORK_LAYERS.map((layer) => <option key={layer} value={layer}>{t(`pages.networkMap.layers.${layer}`)}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3"><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedSubnetId ?? ""} onChange={(event) => { const nextSubnetId = event.target.value ? Number(event.target.value) : null; setSelectedSubnetId(nextSubnetId); setSelectedAddressOffset(null); if (!nextSubnetId) { updateSelectedNode({ ip: "", vlan: "", interfaces: selectedNode.interfaces.map((item) => ({ ...item, ip: "", vlan: "" })) }); return; } const nextSubnet = availableSubnets.find((subnet) => subnet.id === nextSubnetId) || null; const ipPrefix = nextSubnet ? getSubnetIpPrefix(nextSubnet) : ""; updateSelectedNode({ ip: ipPrefix, vlan: nextSubnet?.vlan_number ? String(nextSubnet.vlan_number) : "", interfaces: selectedNode.interfaces.map((item, index) => index === 0 ? { ...item, ip: ipPrefix, vlan: nextSubnet?.vlan_number ? String(nextSubnet.vlan_number) : item.vlan } : item) }); }} disabled={readOnly}><option value="">{t("pages.networkMap.fields.subnet")}</option>{availableSubnets.map((subnet) => <option key={subnet.id} value={subnet.id}>{subnet.name || subnet.cidr}</option>)}</select><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedAddressOffset ?? ""} onChange={(event) => { const offset = event.target.value ? Number(event.target.value) : null; setSelectedAddressOffset(offset); const address = selectableAddresses.find((item) => item.ip_offset === offset) || null; if (!address) return; updateSelectedNode({ ip: address.ip_address, vlan: selectedSubnet?.vlan_number ? String(selectedSubnet.vlan_number) : "", interfaces: selectedNode.interfaces.map((item, index) => index === 0 ? { ...item, ip: address.ip_address, vlan: selectedSubnet?.vlan_number ? String(selectedSubnet.vlan_number) : item.vlan } : item) }); }} disabled={readOnly || !selectedSubnetId}><option value="">{selectedSubnetId ? t("pages.networkMap.fields.address") : t("pages.networkMap.fields.selectSubnetFirst")}</option>{selectableAddresses.map((address) => <option key={`${address.subnet_id}-${address.ip_offset}`} value={address.ip_offset}>{address.ip_address}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3"><Input value={selectedNode.ip} onChange={(event) => updateSelectedNode({ ip: event.target.value })} placeholder={t("pages.networkMap.fields.ip")} disabled={readOnly} /><Input value={selectedNode.vlan} onChange={(event) => updateSelectedNode({ vlan: event.target.value })} placeholder={t("pages.networkMap.fields.vlan")} disabled={readOnly} /></div>
          <div className="grid grid-cols-2 gap-3"><Input value={selectedNode.zone} onChange={(event) => updateSelectedNode({ zone: event.target.value })} placeholder={t("pages.networkMap.fields.zone")} disabled={readOnly} /><Input value={selectedNode.asn} onChange={(event) => updateSelectedNode({ asn: event.target.value })} placeholder={t("pages.networkMap.fields.asn")} disabled={readOnly} /></div>
          {selectedSubnet ? <div className="border border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-600"><div className="font-medium text-slate-900">{selectedSubnet.name || selectedSubnet.cidr}</div><div className="mt-1">{selectedSubnet.network_address}</div><div className="mt-1">{selectedSubnet.vlan_number ? `VLAN ${selectedSubnet.vlan_number}` : "VLAN -"}{selectedAddress ? ` · ${selectedAddress.ip_address}` : selectedNode.ip ? ` · ${selectedNode.ip}` : ""}</div></div> : null}
          <div className="grid grid-cols-2 gap-3"><Input value={selectedNode.model} onChange={(event) => updateSelectedNode({ model: event.target.value })} placeholder={t("pages.networkMap.fields.model")} disabled={readOnly} /><Input value={selectedNode.os} onChange={(event) => updateSelectedNode({ os: event.target.value })} placeholder={t("pages.networkMap.fields.os")} disabled={readOnly} /></div>
          <select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedNode.status} onChange={(event) => updateSelectedNode({ status: event.target.value as NetworkNode["status"] })} disabled={readOnly}><option value="healthy">{t("pages.networkMap.health.healthy")}</option><option value="warning">{t("pages.networkMap.health.warning")}</option><option value="critical">{t("pages.networkMap.health.critical")}</option></select>
        </>
      );
    }
    return <><Input value={selectedEdge!.label} onChange={(event) => updateSelectedEdge({ label: event.target.value })} placeholder={t("pages.networkMap.fields.label")} disabled={readOnly} /><div className="grid grid-cols-2 gap-3"><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedEdge!.style} onChange={(event) => updateSelectedEdge({ style: event.target.value as NetworkEdge["style"] })} disabled={readOnly}>{NETWORK_EDGE_STYLES.map((style) => <option key={style} value={style}>{t(`pages.networkMap.edgeStyles.${style}`)}</option>)}</select><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={selectedEdge!.status} onChange={(event) => updateSelectedEdge({ status: event.target.value as NetworkEdge["status"] })} disabled={readOnly}><option value="healthy">{t("pages.networkMap.health.healthy")}</option><option value="warning">{t("pages.networkMap.health.warning")}</option><option value="critical">{t("pages.networkMap.health.critical")}</option></select></div><div className="grid grid-cols-2 gap-3"><Input value={selectedEdge!.bandwidth} onChange={(event) => updateSelectedEdge({ bandwidth: event.target.value })} placeholder={t("pages.networkMap.fields.bandwidth")} disabled={readOnly} /><Input value={selectedEdge!.latency} onChange={(event) => updateSelectedEdge({ latency: event.target.value })} placeholder={t("pages.networkMap.fields.latency")} disabled={readOnly} /></div><Input value={selectedEdge!.network} onChange={(event) => updateSelectedEdge({ network: event.target.value })} placeholder={t("pages.networkMap.fields.network")} disabled={readOnly} /></>;
  };

  const renderInventoryPanel = () => (
    <div className="space-y-3">
      <Input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder={t("pages.networkMap.inventory.search")} />
      <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">{inventoryItems.map((item, index) => { const alreadyAdded = inventoryPresence.get(`${item.equipment_source}:${item.equipment_item_id}`) === true; return <button key={`${item.equipment_source}:${item.equipment_item_id}`} type="button" className={cn("flex w-full items-center justify-between border px-3 py-3 text-left transition", alreadyAdded ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-70" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")} onClick={() => handleAddInventoryNode(index)} disabled={readOnly || alreadyAdded}><div><div className="text-sm font-semibold text-slate-900">{item.display_name}</div><div className="text-[11px] text-slate-500">{item.primary_ip || item.location || item.equipment_type_name}</div></div>{alreadyAdded ? <Badge variant="secondary">{t("pages.networkMap.inventory.added")}</Badge> : <Badge variant="secondary">{item.network_interfaces.length}</Badge>}</button>; })}{inventoryItems.length === 0 ? <div className="border border-dashed border-slate-200 px-3 py-5 text-sm text-slate-500">{t("pages.networkMap.inventory.empty")}</div> : null}</div>
    </div>
  );

  const renderPathPanel = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2"><select className="h-10 w-full border border-slate-200 bg-white px-3 text-sm" value={pathStartId} onChange={(event) => setPathStartId(event.target.value)}><option value="">{t("pages.networkMap.pathTracing.start")}</option>{topology.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select><select className="h-10 w-full border border-slate-200 bg-white px-3 text-sm" value={pathEndId} onChange={(event) => setPathEndId(event.target.value)}><option value="">{t("pages.networkMap.pathTracing.end")}</option>{topology.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="flex-1" onClick={() => { setPathStartId(selectedNodeIds[0] || ""); setPathEndId(selectedNodeIds[1] || ""); }} disabled={selectedNodeIds.length < 2}><Route className="h-4 w-4" />{t("pages.networkMap.pathTracing.useSelection")}</Button><Button variant="default" className="flex-1" onClick={() => createLinkBetweenNodes(pathStartId, pathEndId)} disabled={readOnly || !pathStartId || !pathEndId}><Link2 className="h-4 w-4" />{t("pages.networkMap.pathTracing.createLink")}</Button><Button variant="outline" onClick={() => { setPathStartId(""); setPathEndId(""); setPendingLinkStartId(null); }}>{t("pages.networkMap.pathTracing.clear")}</Button></div>
      <div className="border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600">{pathStartId && pathEndId ? tracedPath.nodeIds.length ? <><div className="font-semibold text-slate-900">{t("pages.networkMap.pathTracing.hops", { count: tracedPath.edgeIds.length })}</div><div className="mt-1 text-xs text-slate-500">{tracedPath.nodeIds.map((id) => topology.nodes.find((node) => node.id === id)?.name || id).join(" -> ")}</div></> : <div>{t("pages.networkMap.pathTracing.noPath")}</div> : <div>{t("pages.networkMap.pathTracing.placeholder")}</div>}</div>
    </div>
  );

  const renderValidationPanel = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-slate-900">{t("pages.networkMap.policies.title")}</div><div className="text-xs text-slate-500">{t("pages.networkMap.validation.title")}</div></div><Button size="sm" variant="outline" disabled={readOnly} onClick={() => mutateTopology((current) => ({ ...current, policies: [...current.policies, createEmptyPolicy()] }))}><Plus className="h-3.5 w-3.5" />{t("actions.add")}</Button></div>
      <div className="space-y-3">{topology.policies.map((policy) => <div key={policy.id} className="space-y-2 border border-slate-200 p-3"><Input value={policy.name} onChange={(event) => mutateTopology((current) => ({ ...current, policies: current.policies.map((item) => item.id === policy.id ? { ...item, name: event.target.value } : item) }))} disabled={readOnly} /><div className="grid grid-cols-2 gap-2"><Input value={policy.type} onChange={(event) => mutateTopology((current) => ({ ...current, policies: current.policies.map((item) => item.id === policy.id ? { ...item, type: event.target.value } : item) }))} placeholder={t("pages.networkMap.fields.type")} disabled={readOnly} /><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={policy.state} onChange={(event) => mutateTopology((current) => ({ ...current, policies: current.policies.map((item) => item.id === policy.id ? { ...item, state: event.target.value as TopologyPolicy["state"] } : item) }))} disabled={readOnly}><option value="active">{t("pages.networkMap.policyState.active")}</option><option value="triggered">{t("pages.networkMap.policyState.triggered")}</option><option value="disabled">{t("pages.networkMap.policyState.disabled")}</option></select></div><Input value={policy.target} onChange={(event) => mutateTopology((current) => ({ ...current, policies: current.policies.map((item) => item.id === policy.id ? { ...item, target: event.target.value } : item) }))} placeholder={t("pages.networkMap.fields.target")} disabled={readOnly} /></div>)}{topology.policies.length === 0 ? <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("pages.networkMap.policies.empty")}</div> : null}</div>
      <div className="space-y-3">{validation.length === 0 ? <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{t("pages.networkMap.validation.clear")}</div> : null}{validation.map((item) => <div key={item.id} className={cn("border p-3", item.severity === "critical" ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40")}><div className="text-sm font-semibold">{item.title}</div><div className="mt-1 text-xs text-slate-500">{item.detail}</div></div>)}</div>
    </div>
  );

  const inspectorPanel = <Card className="h-full border-slate-200 shadow-none"><CardHeader className="border-b border-slate-200"><div className="flex items-center justify-between gap-3"><div><CardTitle>{t("pages.networkMap.properties.title")}</CardTitle><CardDescription>{saveStateLabel}</CardDescription></div><Badge variant={saveState === "error" ? "destructive" : saveState === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">{([ ["selection", t("pages.networkMap.properties.title")], ["inventory", t("pages.networkMap.inventory.title")], ["path", t("pages.networkMap.pathTracing.title")], ["validation", t("pages.networkMap.validation.title")] ] as const).map(([tab, label]) => <button key={tab} type="button" className={cn("border px-3 py-2 text-sm font-medium", inspectorTab === tab ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")} onClick={() => setInspectorTab(tab)}>{label}</button>)}</div></CardHeader><CardContent className="max-h-[calc(100vh-210px)] overflow-auto p-5">{inspectorTab === "selection" ? renderPropertiesPanel() : inspectorTab === "inventory" ? renderInventoryPanel() : inspectorTab === "path" ? renderPathPanel() : renderValidationPanel()}</CardContent></Card>;

  const sidebarPanel = <Card className="h-full border-slate-200 shadow-none"><CardHeader className="border-b border-slate-200"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-slate-500" />{t("pages.networkMap.documents.title")}</CardTitle><CardDescription>{t("pages.networkMap.documents.subtitle")}</CardDescription></div>{activeId !== null || isDraftDocument ? <Badge variant="outline">{saveStateLabel}</Badge> : null}</div><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-2"><Button size="sm" className="h-auto min-h-10 justify-center px-3 py-2 text-center text-[13px] leading-tight whitespace-normal" onClick={handleStartNewDocument} disabled={readOnly}><Plus className="h-4 w-4 shrink-0" />{t("pages.networkMap.documents.newDocument")}</Button><Button size="sm" className="h-auto min-h-10 justify-center px-3 py-2 text-center text-[13px] leading-tight whitespace-normal" variant="outline" onClick={openSelectedDocument} disabled={selectedDocumentId === null && !isDraftDocument}>{t("pages.serialMap.actions.open")}</Button><Button size="sm" className="h-auto min-h-10 justify-center px-3 py-2 text-center text-[13px] leading-tight whitespace-normal" variant="outline" onClick={() => setIsEditingSelectedDocument(true)} disabled={(selectedDocumentId === null && !isDraftDocument) || readOnly}>{t("actions.edit")}</Button><Button size="sm" className="h-auto min-h-10 justify-center px-3 py-2 text-center text-[13px] leading-tight whitespace-normal" variant="destructive" onClick={() => { void handleDeleteSelectedDocument(); }} disabled={selectedDocumentId === null || readOnly}><Trash2 className="h-4 w-4 shrink-0" />{t("actions.delete")}</Button><Button size="sm" className="h-auto min-h-10 justify-center px-3 py-2 text-center text-[13px] leading-tight whitespace-normal" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={readOnly}><Upload className="h-4 w-4 shrink-0" />{t("actions.import")}</Button><Button size="sm" className="h-auto min-h-10 justify-center px-3 py-2 text-center text-[13px] leading-tight whitespace-normal" variant="outline" onClick={() => exportDocument(topology, `${documentName || "network-topology"}.json`)} disabled={activeId === null && !isDraftDocument}><Upload className="h-4 w-4 shrink-0" />{t("pages.networkMap.toolbar.exportJson")}</Button></div></CardHeader><CardContent className="grid gap-4 p-5"><Input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder={t("pages.networkMap.documents.search")} /><div className="space-y-2"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900">Список схем</div><div className="text-xs text-slate-500">{filteredTopologies.length} / {allTopologies.length}</div></div><div className="grid grid-cols-[minmax(0,1.7fr)_56px_56px_72px] items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"><div>Схема</div><div className="text-center">Узлы</div><div className="text-center">Связи</div><div className="text-center">Предупр.</div></div><div className="max-h-[46vh] overflow-auto border-x border-b border-slate-200 bg-slate-50/30 pr-1"><div className="space-y-px bg-slate-200">{filteredTopologies.map((item) => <CompactDocumentRow key={item.id} item={item} selected={item.id === selectedDocumentId} active={item.id === activeId} onClick={() => { setSelectedDocumentId(item.id); setIsEditingSelectedDocument(false); }} />)}{filteredTopologies.length === 0 ? <div className="border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">{t("pages.networkMap.documents.empty")}</div> : null}</div></div></div><div className="space-y-3 border-t border-slate-200 pt-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Предпросмотр</div><div className="text-xs text-slate-500">{selectedDocumentId === null && isDraftDocument ? "Черновик" : activeId === selectedDocumentId && activeId !== null ? "Открыто на холсте" : "Выбрано в списке схем"}</div></div>{selectedDocumentId !== null && activeId === selectedDocumentId ? <Badge variant="success">{t("pages.networkMap.documents.active")}</Badge> : null}</div>{isEditingSelectedDocument ? <div className="space-y-3 border border-slate-200 p-3"><Input value={selectedDocumentName} onChange={(event) => setSelectedDocumentName(event.target.value)} placeholder={t("pages.networkMap.defaultName")} disabled={readOnly} /><Input value={selectedDocumentDescription} onChange={(event) => setSelectedDocumentDescription(event.target.value)} placeholder={t("pages.networkMap.fields.description")} disabled={readOnly} /><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { void handleSaveSelectedMetadata(); }} disabled={readOnly}><Save className="h-4 w-4" />{t("actions.save")}</Button><Button size="sm" variant="outline" onClick={() => setIsEditingSelectedDocument(false)}>{t("actions.cancel")}</Button></div></div> : previewDocument && previewStats ? <DocumentPreviewCard active={activeId === selectedDocumentId || (selectedDocumentId === null && isDraftDocument)} title={previewTitle} subtitle={previewDescription} updatedAt={previewUpdatedAt} stats={previewStats} /> : <div className="border border-dashed border-slate-200 p-4 text-sm text-slate-500">{allTopologies.length === 0 ? t("pages.networkMap.documents.empty") : "Выберите схему, чтобы увидеть предпросмотр."}</div>}</div></CardContent></Card>;

  const hasOpenCanvas = activeId !== null || isDraftDocument;

  return (
    <div className="space-y-4 text-slate-900">
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void handleImportDocument(file).finally(() => { if (fileInputRef.current) fileInputRef.current.value = ""; }); }} />
      <Card className="border-slate-200 shadow-none"><CardHeader className="pb-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><CardTitle className="text-xl">{t("pages.networkMap.title")}</CardTitle><CardDescription>{t("pages.networkMap.subtitle")}</CardDescription></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{t("pages.networkMap.stats.devices")}: {topology.nodes.length}</Badge><Badge variant="outline">{t("pages.networkMap.stats.links")}: {topology.edges.length}</Badge><Badge variant="outline">{t("pages.networkMap.stats.warnings")}: {nodeWarnings}</Badge><Badge variant="outline">{t("pages.networkMap.stats.critical")}: {nodeCritical}</Badge><Badge variant={saveState === "error" ? "destructive" : saveState === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge></div></div><div className="flex flex-wrap gap-2 xl:hidden"><Button size="sm" variant="outline" onClick={() => setIsSidebarDrawerOpen(true)}>{t("pages.networkMap.documents.title")}</Button><Button size="sm" variant="outline" onClick={() => setIsInspectorDrawerOpen(true)}>{t("pages.networkMap.properties.title")}</Button></div></CardHeader></Card>
      {(interactionMessage || linkCreationMode === "picking") ? <div className={cn("flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm", interactionMessage?.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800")}><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /><span>{interactionMessage?.text || t("pages.networkMap.linkCreation.pickFirst")}</span></div>{linkCreationMode === "picking" ? <div className="flex items-center gap-2 text-xs font-medium"><span>{pendingLinkStartId ? t("pages.networkMap.linkCreation.pendingSecond") : t("pages.networkMap.linkCreation.pendingFirst")}</span><Button size="sm" variant="outline" onClick={toggleLinkCreationMode}>{t("pages.networkMap.pathTracing.clear")}</Button></div> : null}</div> : null}
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start">{sidebarPanel}</div>
        <Card className="overflow-hidden border-slate-200 shadow-none">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><Menubar className="w-fit"><MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent><MenubarLabel>Selection</MenubarLabel><MenubarItem onClick={copySelection} disabled={selectedNodeIds.length === 0}><span>Copy</span><MenubarShortcut>Ctrl/Cmd+C</MenubarShortcut></MenubarItem><MenubarItem onClick={pasteSelection} disabled={clipboardNodes.length === 0 || readOnly || !hasOpenCanvas}><span>Paste</span><MenubarShortcut>Ctrl/Cmd+V</MenubarShortcut></MenubarItem><MenubarSeparator /><MenubarLabel>Modify</MenubarLabel><MenubarItem onClick={duplicateSelection} disabled={readOnly || selectedNodeIds.length === 0}><span>{t("pages.networkMap.toolbar.duplicate")}</span><MenubarShortcut>Ctrl/Cmd+D</MenubarShortcut></MenubarItem><MenubarItem onClick={() => setInspectorTab("selection")} disabled={!selectedCount}><span>{t("actions.edit")}</span></MenubarItem><MenubarItem className="text-red-600 hover:bg-red-50" onClick={() => { void handleDeleteSelection(); }} disabled={readOnly || !selectedCount}><span>{t("actions.delete")}</span><MenubarShortcut>Del</MenubarShortcut></MenubarItem></MenubarContent></MenubarMenu><MenubarMenu><MenubarTrigger>Canvas</MenubarTrigger><MenubarContent><MenubarItem onClick={handleCreateManualNode} disabled={readOnly || !hasOpenCanvas}><span>{t("pages.networkMap.toolbar.addDevice")}</span></MenubarItem><MenubarItem onClick={toggleLinkCreationMode} disabled={readOnly || !hasOpenCanvas}><span>{t("pages.networkMap.toolbar.linkMode")}</span></MenubarItem><MenubarSeparator /><MenubarItem onClick={() => mutateTopology((current) => autoLayout(current))} disabled={!hasOpenCanvas}><span>{t("pages.networkMap.toolbar.autoLayout")}</span></MenubarItem><MenubarItem onClick={() => flowRef.current?.fitView({ duration: 250, padding: 0.18 })} disabled={!hasOpenCanvas}><span>{t("pages.networkMap.toolbar.fitView")}</span></MenubarItem></MenubarContent></MenubarMenu><MenubarMenu><MenubarTrigger>View</MenubarTrigger><MenubarContent><MenubarCheckboxItem checked={showMiniMap} onClick={() => setShowMiniMap((value) => !value)}>MiniMap</MenubarCheckboxItem><MenubarCheckboxItem checked={showGrid} onClick={() => setShowGrid((value) => !value)}>Grid</MenubarCheckboxItem><MenubarSeparator /><MenubarItem onClick={resetViewport} disabled={!hasOpenCanvas}><span>Reset view</span><MenubarShortcut>1:1</MenubarShortcut></MenubarItem></MenubarContent></MenubarMenu></Menubar><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative min-w-0 xl:w-[320px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={canvasSearch} onChange={(event) => setCanvasSearch(event.target.value)} placeholder={t("pages.networkMap.toolbar.searchPlaceholder")} /></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{t("pages.networkMap.stats.selection")}: {selectedCount}</Badge><Badge variant="outline">{Math.round((topology.zoom || 1) * 100)}%</Badge><Badge variant={saveState === "error" ? "destructive" : saveState === "saved" ? "success" : "secondary"}>{saveStateLabel}</Badge></div></div></div></div>
          <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>{t("pages.networkMap.canvas.title")}</CardTitle><CardDescription>{t("pages.networkMap.canvas.subtitle", { visibleNodes: visibleNodeCount, visibleLinks: topology.edges.length })}</CardDescription></div><div className="hidden items-center gap-2 xl:flex"><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={newEdgeStyle} onChange={(event) => setNewEdgeStyle(event.target.value as NetworkEdge["style"])} disabled={readOnly}>{NETWORK_EDGE_STYLES.map((style) => <option key={style} value={style}>{t(`pages.networkMap.edgeStyles.${style}`)}</option>)}</select><select className="h-10 border border-slate-200 bg-white px-3 text-sm" value={newNodeType} onChange={(event) => setNewNodeType(event.target.value as NetworkNode["type"])} disabled={readOnly}>{NETWORK_NODE_TYPES.map((type) => <option key={type} value={type}>{t(`pages.networkMap.nodeTypes.${type}`)}</option>)}</select></div></CardHeader>
          <CardContent className="p-0"><div ref={wrapperRef} className="relative h-[calc(100vh-260px)] min-h-[680px] bg-white">{!hasOpenCanvas ? <EmptyCanvasState title={allTopologies.length > 0 ? "No diagram opened" : t("pages.networkMap.documents.empty")} description={allTopologies.length > 0 ? "Select a diagram in the file browser and click Open to load it on the canvas." : "Create a new diagram or import JSON to begin."} primaryAction={allTopologies.length > 0 ? <Button size="sm" onClick={openSelectedDocument} disabled={selectedDocumentId === null}>{t("pages.serialMap.actions.open")}</Button> : <Button size="sm" onClick={handleStartNewDocument} disabled={readOnly}><Plus className="h-4 w-4" />{t("pages.networkMap.documents.newDocument")}</Button>} secondaryAction={<Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={readOnly}><Upload className="h-4 w-4" />{t("actions.import")}</Button>} /> : null}<ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultViewport={{ x: topology.viewport?.x || 0, y: topology.viewport?.y || 0, zoom: topology.zoom || 1 }} onInit={(instance) => { flowRef.current = instance; if (topology.viewport) instance.setViewport({ x: topology.viewport.x, y: topology.viewport.y, zoom: topology.zoom || 1 }); }} onNodesChange={handleNodesChange} onConnect={handleConnect} onSelectionChange={({ nodes, edges }) => { setSelectedNodeIds(nodes.map((node) => node.id)); setSelectedEdgeId(edges[0]?.id || null); }} onNodeClick={(_, node) => { if (handleNodeLinkPick(node.id)) return; setSelectedNodeIds([node.id]); setSelectedEdgeId(null); setInspectorTab("selection"); }} onEdgeClick={(_, edge) => { setSelectedNodeIds([]); setSelectedEdgeId(edge.id); setInspectorTab("selection"); }} onPaneClick={() => { setSelectedNodeIds([]); setSelectedEdgeId(null); if (linkCreationMode === "picking") setPendingLinkStartId(null); }} onEdgesDelete={(edges) => { if (readOnly) return; mutateTopology((current) => ({ ...current, edges: current.edges.filter((edge) => !edges.some((removed) => removed.id === edge.id)) })); }} onNodesDelete={(nodes) => { if (readOnly) return; mutateTopology((current) => deleteNodes(current, nodes.map((node) => node.id))); }} onMoveEnd={handleMoveEnd} fitView selectionOnDrag multiSelectionKeyCode={["Meta", "Control"]} deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]} nodesDraggable={!readOnly && hasOpenCanvas} nodesConnectable={!readOnly && hasOpenCanvas} panOnScroll minZoom={0.35} maxZoom={1.8} proOptions={{ hideAttribution: true }}>{showGrid ? <Background color="rgba(148, 163, 184, 0.18)" gap={24} /> : null}{showMiniMap ? <MiniMap pannable zoomable className="!bottom-6 !right-6 !h-[120px] !w-[170px] !border !border-slate-200 !bg-white" /> : null}</ReactFlow><div className="pointer-events-none absolute bottom-4 left-4 border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-500 shadow-sm"><div className="flex items-center gap-2"><Grip className="h-3.5 w-3.5" /> {t("pages.networkMap.canvas.hints.pan")}</div><div className="mt-1 flex items-center gap-2"><ArrowDownUp className="h-3.5 w-3.5" /> {t("pages.networkMap.canvas.hints.select")}</div></div></div></CardContent>
        </Card>
        <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-24px)]">{inspectorPanel}</div>
      </div>
      {isSidebarDrawerOpen ? <div className="fixed inset-0 z-50 bg-slate-900/35 xl:hidden" onClick={() => setIsSidebarDrawerOpen(false)}><div className="h-full w-[min(92vw,360px)] bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">{t("pages.networkMap.documents.title")}</div><Button size="sm" variant="outline" onClick={() => setIsSidebarDrawerOpen(false)}>{t("actions.close")}</Button></div>{sidebarPanel}</div></div> : null}
      {isInspectorDrawerOpen ? <div className="fixed inset-0 z-50 bg-slate-900/35 xl:hidden" onClick={() => setIsInspectorDrawerOpen(false)}><div className="ml-auto h-full w-[min(94vw,420px)] bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">{t("pages.networkMap.properties.title")}</div><Button size="sm" variant="outline" onClick={() => setIsInspectorDrawerOpen(false)}>{t("actions.close")}</Button></div>{inspectorPanel}</div></div> : null}
    </div>
  );
}
