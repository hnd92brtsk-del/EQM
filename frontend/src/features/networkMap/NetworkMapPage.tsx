import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  MiniMap,
  type Connection,
  type EdgeMouseHandler,
  type NodeChange,
  type NodeMouseHandler,
  type OnMoveEnd,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowDownUp,
  Copy,
  Download,
  Focus,
  GitBranch,
  Grip,
  Layers3,
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getSubnetAddresses, listSubnets } from "../ipam/api/ipam";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import {
  createNetworkTopology,
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
  NodeInterface,
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
  addEdgeFromConnection,
  applyNodePositionChanges,
  autoLayout,
  computeShortestPath,
  computeTopologyValidation,
  createEmptyNodeInterface,
  createEmptyPolicy,
  createEmptyRouteEntry,
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

type ContextMenuState =
  | { kind: "node"; id: string; x: number; y: number }
  | { kind: "edge"; id: string; x: number; y: number }
  | null;

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="rounded-[24px] shadow-none">
      <CardContent className="p-4">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      </CardContent>
    </Card>
  );
}

function DocumentPreviewCard({
  active,
  title,
  subtitle,
  updatedAt,
  stats,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  updatedAt: string;
  stats: { nodes: number; edges: number; warnings: number };
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const previewNodes = Array.from({ length: Math.min(stats.nodes, 5) }, (_, index) => ({
    left: 16 + (index % 3) * 18 + (index > 2 ? 10 : 0),
    top: index < 3 ? 14 : 34,
  }));

  return (
    <button
      className={cn(
        "w-full rounded-[26px] border p-3.5 text-left transition",
        active
          ? "border-slate-900 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
          : "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] hover:border-slate-300 hover:bg-slate-50"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className={cn("mt-1 line-clamp-2 text-[11px]", active ? "text-slate-300" : "text-slate-500")}>{subtitle}</div>
        </div>
        {active ? <Badge className="bg-white text-slate-900">{t("pages.networkMap.documents.active")}</Badge> : null}
      </div>
      <div className="mt-3 grid grid-cols-[108px_minmax(0,1fr)] gap-3">
        <div
          className={cn(
            "relative h-[74px] overflow-hidden rounded-[20px] border",
            active ? "border-white/15 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),rgba(255,255,255,0.04))]" : "border-slate-200 bg-slate-50"
          )}
        >
          <div className={cn("absolute inset-x-0 top-0 h-8", active ? "bg-white/5" : "bg-white")} />
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
          <div className={cn("rounded-2xl px-2 py-2", active ? "bg-white/8" : "bg-slate-50")}>
            <div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>{t("pages.networkMap.stats.devices")}</div>
            <div className="mt-1 text-sm font-semibold">{stats.nodes}</div>
          </div>
          <div className={cn("rounded-2xl px-2 py-2", active ? "bg-white/8" : "bg-slate-50")}>
            <div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>{t("pages.networkMap.stats.links")}</div>
            <div className="mt-1 text-sm font-semibold">{stats.edges}</div>
          </div>
          <div className={cn("rounded-2xl px-2 py-2", active ? "bg-white/8" : "bg-slate-50")}>
            <div className={cn("text-[10px]", active ? "text-slate-300" : "text-slate-500")}>{t("pages.networkMap.stats.warnings")}</div>
            <div className="mt-1 text-sm font-semibold">{stats.warnings}</div>
          </div>
        </div>
      </div>
      <div className={cn("mt-3 flex items-center justify-between text-[10px]", active ? "text-slate-400" : "text-slate-400")}>
        <span>{updatedAt}</span>
        <span>{stats.nodes + stats.edges > 0 ? `${Math.round((stats.edges / Math.max(stats.nodes, 1)) * 100)}%` : "--"}</span>
      </div>
    </button>
  );
}

export default function NetworkMapPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const readOnly = !canWrite;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const hydratingRef = useRef(false);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [topology, setTopology] = useState<TopologyDocument>(DEFAULT_DOCUMENT);
  const [isDraftDocument, setIsDraftDocument] = useState(false);
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [selectedSubnetId, setSelectedSubnetId] = useState<number | null>(null);
  const [selectedAddressOffset, setSelectedAddressOffset] = useState<number | null>(null);

  const topologiesQuery = useQuery({
    queryKey: ["network-topologies"],
    queryFn: () => listNetworkTopologies({ page: 1, page_size: 100 }),
  });

  const detailQuery = useQuery({
    queryKey: ["network-topology", activeId],
    queryFn: () => getNetworkTopology(activeId as number),
    enabled: activeId !== null,
  });

  const inventoryQuery = useQuery({
    queryKey: ["network-topology-eligible-equipment"],
    queryFn: () => listNetworkTopologyEligibleEquipment({}),
  });

  const subnetsQuery = useQuery({
    queryKey: ["network-map-subnets"],
    queryFn: () => listSubnets({ page: 1, page_size: 200, sort: "network_address" }),
  });

  const subnetAddressesQuery = useQuery({
    queryKey: ["network-map-subnet-addresses", selectedSubnetId],
    enabled: selectedSubnetId !== null,
    queryFn: () =>
      getSubnetAddresses(selectedSubnetId as number, {
        mode: "list",
        include_service: false,
        page: 1,
        page_size: 512,
        sort: "ip_address",
      }),
  });

  useEffect(() => {
    if (topologiesQuery.data?.items.length && activeId === null && !isDraftDocument) {
      setActiveId(topologiesQuery.data.items[0].id);
    }
    if (!topologiesQuery.data?.items.length && activeId === null && !isDraftDocument) {
      hydratingRef.current = true;
      setDocumentName(t("pages.networkMap.defaultName"));
      setDocumentDescription("");
      setTopology(DEFAULT_DOCUMENT);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSaveState("idle");
      setTimeout(() => {
        hydratingRef.current = false;
      }, 0);
    }
  }, [activeId, isDraftDocument, t, topologiesQuery.data?.items]);

  useEffect(() => {
    if (!detailQuery.data) return;
    hydratingRef.current = true;
    setIsDraftDocument(false);
    setDocumentName(detailQuery.data.name);
    setDocumentDescription(detailQuery.data.description || "");
    setTopology(detailQuery.data.document || DEFAULT_DOCUMENT);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSaveState("saved");
    setTimeout(() => {
      hydratingRef.current = false;
    }, 0);
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
    if (dirtyVersion === 0 || readOnly) return;
    const timer = window.setTimeout(async () => {
      try {
        setSaveState("saving");
        if (activeId === null) {
          const created = await createNetworkTopology({
            name: documentName || t("pages.networkMap.defaultName"),
            description: documentDescription || null,
            scope: "engineering",
            document: topology,
          });
          setIsDraftDocument(false);
          setActiveId(created.id);
          queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
          queryClient.setQueryData(["network-topology", created.id], created);
        } else {
          const updated = await updateNetworkTopology(activeId, {
            name: documentName || t("pages.networkMap.defaultName"),
            description: documentDescription || null,
            scope: "engineering",
            document: topology,
          });
          queryClient.setQueryData(["network-topology", activeId], updated);
          queryClient.invalidateQueries({ queryKey: ["network-topologies"] });
        }
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [activeId, dirtyVersion, documentDescription, documentName, queryClient, readOnly, t, topology]);

  const tracedPath = useMemo(() => computeShortestPath(topology, pathStartId, pathEndId), [pathEndId, pathStartId, topology]);
  const validation = useMemo(() => computeTopologyValidation(topology), [topology]);
  const rfNodes = useMemo(
    () => topology.nodes.map((node) => ({ ...toFlowNode(node), data: { node, traced: tracedPath.nodeIds.includes(node.id) } })),
    [topology.nodes, tracedPath.nodeIds]
  );
  const rfEdges = useMemo(
    () => topology.edges.map((edge) => ({ ...toFlowEdge(edge), data: { edge, traced: tracedPath.edgeIds.includes(edge.id) } })),
    [topology.edges, tracedPath.edgeIds]
  );

  const selectedNode = selectedNodeIds.length === 1 ? topology.nodes.find((node) => node.id === selectedNodeIds[0]) || null : null;
  const selectedEdge = selectedEdgeId ? topology.edges.find((edge) => edge.id === selectedEdgeId) || null : null;

  const inventoryItems = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const items = inventoryQuery.data || [];
    if (!q) return items;
    return items.filter((item) =>
      [item.display_name, item.equipment_type_name, item.manufacturer_name || "", item.location || "", item.primary_ip || ""].join(" ").toLowerCase().includes(q)
    );
  }, [inventoryQuery.data, inventorySearch]);

  const inventoryPresence = useMemo(
    () =>
      new Map(
        inventoryItems.map((item) => [
          `${item.equipment_source}:${item.equipment_item_id}`,
          isEquipmentAlreadyOnCanvas(topology, item),
        ])
      ),
    [inventoryItems, topology]
  );

  const filteredTopologies = useMemo(() => {
    const q = documentSearch.trim().toLowerCase();
    const items = topologiesQuery.data?.items || [];
    if (!q) return items;
    return items.filter((item) => [item.name, item.description || ""].join(" ").toLowerCase().includes(q));
  }, [documentSearch, topologiesQuery.data?.items]);

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
  const activeDocumentWarnings =
    topology.nodes.filter((node) => node.status !== "healthy").length + topology.edges.filter((edge) => edge.status !== "healthy").length;
  const availableSubnets = subnetsQuery.data?.items || [];
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
    const subnets = subnetsQuery.data?.items || [];
    const vlanMatch = selectedNode.vlan
      ? subnets.find((subnet) => subnet.vlan_number !== null && String(subnet.vlan_number || "") === selectedNode.vlan) || null
      : null;
    setSelectedSubnetId(vlanMatch ? vlanMatch.id : null);
  }, [selectedNode, subnetsQuery.data?.items]);

  useEffect(() => {
    if (!selectedNode || !selectedSubnetId) {
      setSelectedAddressOffset(null);
      return;
    }
    const currentAddress = (subnetAddressesQuery.data?.items || []).find((item) => item.ip_address === selectedNode.ip);
    setSelectedAddressOffset(currentAddress?.ip_offset || null);
  }, [selectedNode, selectedSubnetId, subnetAddressesQuery.data?.items]);

  const setSaveButtonState =
    saveState === "saving"
      ? t("pages.networkMap.states.saving")
      : saveState === "error"
        ? t("pages.networkMap.states.error")
        : saveState === "saved"
          ? t("pages.networkMap.states.saved")
          : t("pages.networkMap.states.unsaved");

  const placeAtCanvasCenter = () => {
    const instance = flowRef.current;
    const wrapper = wrapperRef.current;
    if (!instance || !wrapper) return { x: 240, y: 180 };
    const bounds = wrapper.getBoundingClientRect();
    return instance.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
  };

  const handleStartNewDocument = () => {
    hydratingRef.current = true;
    setIsDraftDocument(true);
    setActiveId(null);
    setDocumentName(t("pages.networkMap.defaultName"));
    setDocumentDescription("");
    setTopology(DEFAULT_DOCUMENT);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSaveState("idle");
    setTimeout(() => {
      hydratingRef.current = false;
    }, 0);
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
    if (readOnly) return;
    const node = createManualNode(newNodeType, placeAtCanvasCenter());
    mutateTopology((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    requestAnimationFrame(() => {
      flowRef.current?.setCenter(node.x + 42, node.y + 42, { zoom: Math.max(flowRef.current?.getZoom() || 1, 0.92), duration: 260 });
    });
  };

  const handleAddInventoryNode = (index: number) => {
    if (readOnly) return;
    const item = inventoryItems[index];
    if (!item) return;
    if (isEquipmentAlreadyOnCanvas(topology, item)) return;
    const center = placeAtCanvasCenter();
    const node = createNodeFromEquipment(item, { x: center.x + (index % 3) * 28, y: center.y + (index % 2) * 24 });
    mutateTopology((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    requestAnimationFrame(() => {
      flowRef.current?.setCenter(node.x + 42, node.y + 42, { zoom: Math.max(flowRef.current?.getZoom() || 1, 0.92), duration: 260 });
    });
  };

  const handleNodesChange = (changes: NodeChange[]) => {
    mutateTopology((current) => applyNodePositionChanges(current, changes));
  };

  const handleConnect = (connection: Connection) => {
    if (readOnly) return;
    mutateTopology((current) => addEdgeFromConnection(current, connection, newEdgeStyle));
  };

  const handleMoveEnd: OnMoveEnd = (_event, viewport) => {
    mutateTopology((current) => ({ ...current, viewport: { x: viewport.x, y: viewport.y }, zoom: viewport.zoom }));
  };

  const duplicateSelection = () => {
    if (readOnly || selectedNodeIds.length === 0) return;
    const result = duplicateNodes(topology, selectedNodeIds);
    mutateTopology(result.document);
    setSelectedNodeIds(result.newIds);
    setSelectedEdgeId(null);
  };

  const deleteSelection = () => {
    if (readOnly) return;
    if (selectedNodeIds.length) {
      mutateTopology((current) => deleteNodes(current, selectedNodeIds));
      setSelectedNodeIds([]);
    } else if (selectedEdgeId) {
      mutateTopology((current) => deleteEdge(current, selectedEdgeId));
      setSelectedEdgeId(null);
    }
    setContextMenu(null);
  };

  const onNodeContextMenu: NodeMouseHandler = (event, node) => {
    event.preventDefault();
    setContextMenu({ kind: "node", id: node.id, x: event.clientX, y: event.clientY });
  };

  const onEdgeContextMenu: EdgeMouseHandler = (event, edge) => {
    event.preventDefault();
    setContextMenu({ kind: "edge", id: edge.id, x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedNodeIds.length || selectedEdgeId) {
          event.preventDefault();
          deleteSelection();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedNodeIds.length) {
        event.preventDefault();
        duplicateSelection();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [selectedEdgeId, selectedNodeIds]);

  return (
    <div className="space-y-4 text-slate-900">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void importDocumentFromFile(file).then((imported) => {
            mutateTopology(imported);
            setSelectedNodeIds([]);
            setSelectedEdgeId(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          });
        }}
      />

      <Card className="rounded-[30px]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{t("pages.networkMap.title")}</h1>
                  <p className="text-sm text-slate-500">{t("pages.networkMap.subtitle")}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <div className="grid gap-3 xl:grid-cols-[390px_minmax(0,1fr)]">
                <Card className="rounded-[26px] border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-none">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Layers3 className="h-4 w-4 text-slate-500" />
                        {t("pages.networkMap.documents.title")}
                      </div>
                      <Button size="sm" variant="outline" onClick={handleStartNewDocument} disabled={readOnly && activeId === null}>
                        <Plus className="h-3.5 w-3.5" />
                        {t("pages.networkMap.documents.newDocument")}
                      </Button>
                    </div>
                    <Input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder={t("pages.networkMap.documents.search")} />
                    <div className="mt-3 max-h-[256px] space-y-3 overflow-auto pr-1">
                      {filteredTopologies.map((item) => (
                        <DocumentPreviewCard
                          key={item.id}
                          active={item.id === activeId}
                          title={item.name}
                          subtitle={item.description || t("pages.networkMap.documents.noDescription")}
                          updatedAt={new Date(item.updated_at).toLocaleString()}
                          stats={{
                            nodes: item.document.nodes.length,
                            edges: item.document.edges.length,
                            warnings:
                              item.document.nodes.filter((node) => node.status !== "healthy").length +
                              item.document.edges.filter((edge) => edge.status !== "healthy").length,
                          }}
                          onClick={() => setActiveId(item.id)}
                        />
                      ))}
                      {filteredTopologies.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                          {t("pages.networkMap.documents.empty")}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-[26px] border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_156px]">
                      <Input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder={t("pages.networkMap.defaultName")} disabled={readOnly} />
                      <div className="flex h-10 items-center justify-between rounded-2xl border border-slate-200 bg-white px-3">
                        <span className="text-xs font-medium text-slate-500">{t("pages.networkMap.documents.active")}</span>
                        <Badge variant={saveState === "error" ? "destructive" : saveState === "saved" ? "success" : "secondary"}>{setSaveButtonState}</Badge>
                      </div>
                    </div>
                    <Input value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} placeholder={t("pages.networkMap.fields.description")} disabled={readOnly} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[20px] border border-slate-200 bg-white px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{t("pages.networkMap.stats.devices")}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{topology.nodes.length}</div>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-white px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{t("pages.networkMap.stats.links")}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{topology.edges.length}</div>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-white px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{t("pages.networkMap.stats.selection")}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{selectedCount}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <StatCard label={t("pages.networkMap.stats.devices")} value={topology.nodes.length} />
            <StatCard label={t("pages.networkMap.stats.links")} value={topology.edges.length} />
            <StatCard label={t("pages.networkMap.stats.interfaces")} value={totalInterfaces} />
            <StatCard label={t("pages.networkMap.stats.routes")} value={totalRoutes} />
            <StatCard label={t("pages.networkMap.stats.warnings")} value={nodeWarnings} />
            <StatCard label={t("pages.networkMap.stats.critical")} value={nodeCritical} />
            <StatCard label={t("pages.networkMap.stats.zoom")} value={`${Math.round((topology.zoom || 1) * 100)}%`} />
            <StatCard label={t("pages.networkMap.stats.selection")} value={selectedNodeIds.length + (selectedEdgeId ? 1 : 0)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden rounded-[30px]">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>{t("pages.networkMap.canvas.title")}</CardTitle>
              <CardDescription>{t("pages.networkMap.canvas.subtitle", { visibleNodes: visibleNodeCount, visibleLinks: topology.edges.length })}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{visibleNodeCount}</Badge>
              <Badge variant="outline">{topology.edges.length}</Badge>
              <Badge>{Math.round((topology.zoom || 1) * 100)}%</Badge>
            </div>
          </CardHeader>
          <div className="border-y border-slate-200 bg-slate-50/70 px-5 py-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div className="relative min-w-0">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" value={canvasSearch} onChange={(event) => setCanvasSearch(event.target.value)} placeholder={t("pages.networkMap.toolbar.searchPlaceholder")} />
                </div>
                <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={newEdgeStyle} onChange={(event) => setNewEdgeStyle(event.target.value as NetworkEdge["style"])} disabled={readOnly}>
                  {NETWORK_EDGE_STYLES.map((style) => (
                    <option key={style} value={style}>{t(`pages.networkMap.edgeStyles.${style}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => mutateTopology((current) => ({ ...current }))} disabled={readOnly}>
                  <Save className="h-4 w-4" />
                  {t("actions.save")}
                </Button>
                <Button size="sm" variant="outline" onClick={handleStartNewDocument}>
                  <Plus className="h-4 w-4" />
                  {t("pages.networkMap.documents.newDocument")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {t("actions.import")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportDocument(topology, `${documentName || "network-topology"}.json`)}>
                  <Download className="h-4 w-4" />
                  {t("pages.networkMap.toolbar.exportJson")}
                </Button>
                <select className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={newNodeType} onChange={(event) => setNewNodeType(event.target.value as NetworkNode["type"])} disabled={readOnly}>
                  {NETWORK_NODE_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`pages.networkMap.nodeTypes.${type}`)}</option>
                  ))}
                </select>
                <Button size="sm" onClick={handleCreateManualNode} disabled={readOnly}>
                  <Plus className="h-4 w-4" />
                  {t("pages.networkMap.toolbar.addDevice")}
                </Button>
                <Button size="sm" variant="outline" onClick={duplicateSelection} disabled={readOnly || selectedNodeIds.length === 0}>
                  <Copy className="h-4 w-4" />
                  {t("pages.networkMap.toolbar.duplicate")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => mutateTopology((current) => autoLayout(current))}>
                  <RefreshCw className="h-4 w-4" />
                  {t("pages.networkMap.toolbar.autoLayout")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => flowRef.current?.fitView({ duration: 250, padding: 0.18 })}>
                  <Focus className="h-4 w-4" />
                  {t("pages.networkMap.toolbar.fitView")}
                </Button>
                <Button size="sm" variant="destructive" onClick={deleteSelection} disabled={readOnly || (!selectedNodeIds.length && !selectedEdgeId)}>
                  <Trash2 className="h-4 w-4" />
                  {t("actions.delete")}
                </Button>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            <div ref={wrapperRef} className="relative h-[860px] bg-[linear-gradient(rgba(203,213,225,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(203,213,225,0.18)_1px,transparent_1px)] bg-[size:24px_24px]">
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultViewport={{ x: topology.viewport?.x || 0, y: topology.viewport?.y || 0, zoom: topology.zoom || 1 }}
                onInit={(instance) => {
                  flowRef.current = instance;
                  if (topology.viewport) {
                    instance.setViewport({ x: topology.viewport.x, y: topology.viewport.y, zoom: topology.zoom || 1 });
                  }
                }}
                onNodesChange={handleNodesChange}
                onConnect={handleConnect}
                onSelectionChange={({ nodes, edges }) => {
                  setSelectedNodeIds(nodes.map((node) => node.id));
                  setSelectedEdgeId(edges[0]?.id || null);
                }}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onNodeClick={(_, node) => {
                  setSelectedNodeIds([node.id]);
                  setSelectedEdgeId(null);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedNodeIds([]);
                  setSelectedEdgeId(edge.id);
                }}
                onPaneClick={() => {
                  setSelectedNodeIds([]);
                  setSelectedEdgeId(null);
                  setContextMenu(null);
                }}
                onEdgesDelete={(edges) => {
                  if (readOnly) return;
                  mutateTopology((current) => ({ ...current, edges: current.edges.filter((edge) => !edges.some((removed) => removed.id === edge.id)) }));
                }}
                onNodesDelete={(nodes) => {
                  if (readOnly) return;
                  mutateTopology((current) => deleteNodes(current, nodes.map((node) => node.id)));
                }}
                onMoveEnd={handleMoveEnd}
                fitView
                selectionOnDrag
                multiSelectionKeyCode={["Meta", "Control"]}
                deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                panOnScroll
                minZoom={0.35}
                maxZoom={1.8}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="rgba(148, 163, 184, 0.18)" gap={24} />
                <MiniMap pannable zoomable className="!bottom-6 !right-6 !h-[120px] !w-[170px] !rounded-2xl !border !border-slate-200 !bg-white" />
              </ReactFlow>

              <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-500 shadow-sm">
                <div className="flex items-center gap-2"><Grip className="h-3.5 w-3.5" /> {t("pages.networkMap.canvas.hints.pan")}</div>
                <div className="mt-1 flex items-center gap-2"><ArrowDownUp className="h-3.5 w-3.5" /> {t("pages.networkMap.canvas.hints.select")}</div>
              </div>

              <AnimatePresence>
                {contextMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute z-20 min-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                  >
                    {contextMenu.kind === "node" ? (
                      <div className="space-y-1 text-sm">
                        <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50" onClick={() => {
                          const node = topology.nodes.find((item) => item.id === contextMenu.id);
                          if (node) flowRef.current?.setCenter(node.x, node.y, { zoom: 1.15, duration: 220 });
                          setContextMenu(null);
                        }}>{t("pages.networkMap.context.centerNode")}</button>
                        <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50" onClick={() => {
                          setPathStartId(contextMenu.id);
                          setContextMenu(null);
                        }}>{t("pages.networkMap.context.setPathStart")}</button>
                        <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50" onClick={() => {
                          setPathEndId(contextMenu.id);
                          setContextMenu(null);
                        }}>{t("pages.networkMap.context.setPathEnd")}</button>
                        <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50" disabled={readOnly} onClick={() => {
                          setSelectedNodeIds([contextMenu.id]);
                          duplicateSelection();
                          setContextMenu(null);
                        }}>{t("pages.networkMap.context.duplicateNode")}</button>
                        <button className="w-full rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={readOnly} onClick={() => {
                          setSelectedNodeIds([contextMenu.id]);
                          setSelectedEdgeId(null);
                          deleteSelection();
                        }}>{t("pages.networkMap.context.deleteNode")}</button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50" disabled={readOnly} onClick={() => {
                          const edge = topology.edges.find((item) => item.id === contextMenu.id);
                          if (edge) {
                            mutateTopology((current) => updateEdge(current, edge.id, { status: edge.status === "healthy" ? "warning" : "healthy" }));
                          }
                          setContextMenu(null);
                        }}>{t("pages.networkMap.context.toggleEdgeHealth")}</button>
                        <button className="w-full rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={readOnly} onClick={() => {
                          setSelectedNodeIds([]);
                          setSelectedEdgeId(contextMenu.id);
                          deleteSelection();
                        }}>{t("pages.networkMap.context.deleteEdge")}</button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-24px)] xl:overflow-y-auto xl:pr-1">
          <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-2 shadow-network-panel">
            <div className="space-y-4 rounded-[24px] bg-white p-2">
          <Card className="overflow-hidden rounded-[26px] border-slate-200 bg-[linear-gradient(180deg,#0f172a_0%,#182234_100%)] text-white shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t("pages.networkMap.documents.title")}</div>
                  <div className="mt-1 text-lg font-semibold">{documentName || t("pages.networkMap.defaultName")}</div>
                  <div className="mt-1 text-xs text-slate-400">{documentDescription || t("pages.networkMap.documents.noDescription")}</div>
                </div>
                <Badge className="bg-white text-slate-900">{setSaveButtonState}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-[110px_minmax(0,1fr)] gap-3">
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-2">
                  <svg viewBox="0 0 108 68" className="h-[68px] w-full">
                    {topology.nodes.slice(0, 6).map((node, index, items) => {
                      const left = 18 + (index % 3) * 28 + (index > 2 ? 8 : 0);
                      const top = index < 3 ? 16 : 42;
                      const prev = items[index - 1];
                      const prevLeft = prev ? 18 + ((index - 1) % 3) * 28 + (index - 1 > 2 ? 8 : 0) : 0;
                      const prevTop = prev ? (index - 1 < 3 ? 16 : 42) : 0;
                      return (
                        <g key={node.id}>
                          {index > 0 ? <path d={`M${prevLeft} ${prevTop} L${left} ${top}`} stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" /> : null}
                          <circle cx={left} cy={top} r="5.4" fill="rgba(255,255,255,0.12)" />
                          <circle cx={left} cy={top} r="3.2" fill="#ffffff" />
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/8 px-3 py-2">
                    <div className="text-[10px] text-slate-300">{t("pages.networkMap.stats.devices")}</div>
                    <div className="mt-1 text-sm font-semibold">{topology.nodes.length}</div>
                  </div>
                  <div className="rounded-2xl bg-white/8 px-3 py-2">
                    <div className="text-[10px] text-slate-300">{t("pages.networkMap.stats.links")}</div>
                    <div className="mt-1 text-sm font-semibold">{topology.edges.length}</div>
                  </div>
                  <div className="rounded-2xl bg-white/8 px-3 py-2">
                    <div className="text-[10px] text-slate-300">{t("pages.networkMap.stats.warnings")}</div>
                    <div className="mt-1 text-sm font-semibold">{activeDocumentWarnings}</div>
                  </div>
                  <div className="rounded-2xl bg-white/8 px-3 py-2">
                    <div className="text-[10px] text-slate-300">{t("pages.networkMap.stats.selection")}</div>
                    <div className="mt-1 text-sm font-semibold">{selectedCount}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-slate-500" />{t("pages.networkMap.inventory.title")}</CardTitle>
              <CardDescription>{t("pages.networkMap.inventory.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder={t("pages.networkMap.inventory.search")} />
              <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                {inventoryItems.map((item, index) => {
                  const alreadyAdded = inventoryPresence.get(`${item.equipment_source}:${item.equipment_item_id}`) === true;
                  return (
                  <button
                    key={`${item.equipment_source}:${item.equipment_item_id}`}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[20px] border px-3 py-3 text-left transition",
                      alreadyAdded ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-70" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                    onClick={() => handleAddInventoryNode(index)}
                    disabled={readOnly || alreadyAdded}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.display_name}</div>
                      <div className="text-[11px] text-slate-500">{item.primary_ip || item.location || item.equipment_type_name}</div>
                    </div>
                    {alreadyAdded ? <Badge variant="secondary">{t("pages.networkMap.inventory.added")}</Badge> : <Badge variant="secondary">{item.network_interfaces.length}</Badge>}
                  </button>
                  );
                })}
                {inventoryItems.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-5 text-sm text-slate-500">{t("pages.networkMap.inventory.empty")}</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Route className="h-4 w-4 text-slate-500" />{t("pages.networkMap.pathTracing.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={pathStartId} onChange={(event) => setPathStartId(event.target.value)}>
                <option value="">{t("pages.networkMap.pathTracing.start")}</option>
                {topology.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
              <select className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={pathEndId} onChange={(event) => setPathEndId(event.target.value)}>
                <option value="">{t("pages.networkMap.pathTracing.end")}</option>
                {topology.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setPathStartId(selectedNodeIds[0] || "");
                  setPathEndId(selectedNodeIds[1] || "");
                }} disabled={selectedNodeIds.length < 2}>
                  <Route className="h-4 w-4" />
                  {t("pages.networkMap.pathTracing.useSelection")}
                </Button>
                <Button variant="outline" onClick={() => { setPathStartId(""); setPathEndId(""); }}>
                  {t("pages.networkMap.pathTracing.clear")}
                </Button>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600">
                {pathStartId && pathEndId ? (
                  tracedPath.nodeIds.length ? (
                    <>
                      <div className="font-semibold text-slate-900">{t("pages.networkMap.pathTracing.hops", { count: tracedPath.edgeIds.length })}</div>
                      <div className="mt-1 text-xs text-slate-500">{tracedPath.nodeIds.map((id) => topology.nodes.find((node) => node.id === id)?.name || id).join(" -> ")}</div>
                    </>
                  ) : (
                    <div>{t("pages.networkMap.pathTracing.noPath")}</div>
                  )
                ) : (
                  <div>{t("pages.networkMap.pathTracing.placeholder")}</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-slate-500" />{t("pages.networkMap.properties.title")}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[620px] space-y-3 overflow-auto pr-1">
              {selectedNodeIds.length > 1 && (
                <div className="rounded-2xl border border-slate-200 p-3 text-sm text-slate-600">
                  {t("pages.networkMap.properties.multiSelection", { count: selectedNodeIds.length })}
                </div>
              )}
              {selectedNode && (
                <>
                  <Input value={selectedNode.name} onChange={(event) => updateSelectedNode({ name: event.target.value })} disabled={readOnly} />
                  <div className="grid grid-cols-2 gap-3">
                    <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={selectedNode.type} onChange={(event) => updateSelectedNode({ type: event.target.value as NetworkNode["type"] })} disabled={readOnly}>
                      {NETWORK_NODE_TYPES.map((type) => <option key={type} value={type}>{t(`pages.networkMap.nodeTypes.${type}`)}</option>)}
                    </select>
                    <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={selectedNode.layer} onChange={(event) => updateSelectedNode({ layer: event.target.value as NetworkNode["layer"] })} disabled={readOnly}>
                      {NETWORK_LAYERS.map((layer) => <option key={layer} value={layer}>{t(`pages.networkMap.layers.${layer}`)}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                      value={selectedSubnetId ?? ""}
                      onChange={(event) => {
                        const nextSubnetId = event.target.value ? Number(event.target.value) : null;
                        setSelectedSubnetId(nextSubnetId);
                        setSelectedAddressOffset(null);
                        if (!nextSubnetId) {
                          updateSelectedNode({ ip: "", vlan: "", interfaces: selectedNode.interfaces.map((item) => ({ ...item, ip: "", vlan: "" })) });
                        }
                      }}
                      disabled={readOnly}
                    >
                      <option value="">{t("pages.networkMap.fields.subnet")}</option>
                      {availableSubnets.map((subnet) => (
                        <option key={subnet.id} value={subnet.id}>
                          {subnet.name || subnet.cidr}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                      value={selectedAddressOffset ?? ""}
                      onChange={(event) => {
                        const offset = event.target.value ? Number(event.target.value) : null;
                        setSelectedAddressOffset(offset);
                        const address = selectableAddresses.find((item) => item.ip_offset === offset) || null;
                        if (!address) return;
                        updateSelectedNode({
                          ip: address.ip_address,
                          vlan: selectedSubnet?.vlan_number ? String(selectedSubnet.vlan_number) : "",
                          interfaces: selectedNode.interfaces.map((item, index) =>
                            index === 0
                              ? {
                                  ...item,
                                  ip: address.ip_address,
                                  vlan: selectedSubnet?.vlan_number ? String(selectedSubnet.vlan_number) : item.vlan,
                                }
                              : item
                          ),
                        });
                      }}
                      disabled={readOnly || !selectedSubnetId}
                    >
                      <option value="">{selectedSubnetId ? t("pages.networkMap.fields.address") : t("pages.networkMap.fields.selectSubnetFirst")}</option>
                      {selectableAddresses.map((address) => (
                        <option key={`${address.subnet_id}-${address.ip_offset}`} value={address.ip_offset}>
                          {address.ip_address}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={selectedNode.ip} onChange={(event) => updateSelectedNode({ ip: event.target.value })} placeholder={t("pages.networkMap.fields.ip")} disabled={readOnly} />
                    <Input value={selectedNode.vlan} onChange={(event) => updateSelectedNode({ vlan: event.target.value })} placeholder={t("pages.networkMap.fields.vlan")} disabled={readOnly} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={selectedNode.zone} onChange={(event) => updateSelectedNode({ zone: event.target.value })} placeholder={t("pages.networkMap.fields.zone")} disabled={readOnly} />
                    <Input value={selectedNode.asn} onChange={(event) => updateSelectedNode({ asn: event.target.value })} placeholder={t("pages.networkMap.fields.asn")} disabled={readOnly} />
                  </div>
                  {selectedSubnet ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
                      <span className="font-medium text-slate-900">{selectedSubnet.name || selectedSubnet.cidr}</span>
                      {selectedSubnet.vlan_number ? ` · VLAN ${selectedSubnet.vlan_number}` : ""}
                      {selectedAddress ? ` · ${selectedAddress.ip_address}` : ""}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={selectedNode.model} onChange={(event) => updateSelectedNode({ model: event.target.value })} placeholder={t("pages.networkMap.fields.model")} disabled={readOnly} />
                    <Input value={selectedNode.os} onChange={(event) => updateSelectedNode({ os: event.target.value })} placeholder={t("pages.networkMap.fields.os")} disabled={readOnly} />
                  </div>
                  <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={selectedNode.status} onChange={(event) => updateSelectedNode({ status: event.target.value as NetworkNode["status"] })} disabled={readOnly}>
                    <option value="healthy">{t("pages.networkMap.health.healthy")}</option>
                    <option value="warning">{t("pages.networkMap.health.warning")}</option>
                    <option value="critical">{t("pages.networkMap.health.critical")}</option>
                  </select>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{t("pages.networkMap.properties.interfaces")}</span>
                      <Button size="sm" variant="outline" disabled={readOnly} onClick={() => updateSelectedNode({ interfaces: [...selectedNode.interfaces, createEmptyNodeInterface()] })}>
                        <Plus className="h-3.5 w-3.5" />
                        {t("actions.add")}
                      </Button>
                    </div>
                    {selectedNode.interfaces.map((item, index) => (
                      <div key={`${selectedNode.id}-if-${index}`} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                        <Input
                          value={item.name}
                          onChange={(event) =>
                            updateSelectedNode({
                              interfaces: selectedNode.interfaces.map((current, currentIndex) => currentIndex === index ? { ...current, name: event.target.value } : current),
                            })
                          }
                          placeholder={t("pages.networkMap.fields.interfaceName")}
                          disabled={readOnly}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={item.ip}
                            onChange={(event) =>
                              updateSelectedNode({
                                interfaces: selectedNode.interfaces.map((current, currentIndex) => currentIndex === index ? { ...current, ip: event.target.value } : current),
                              })
                            }
                            placeholder={t("pages.networkMap.fields.ip")}
                            disabled={readOnly}
                          />
                          <Input
                            value={item.vlan}
                            onChange={(event) =>
                              updateSelectedNode({
                                interfaces: selectedNode.interfaces.map((current, currentIndex) => currentIndex === index ? { ...current, vlan: event.target.value } : current),
                              })
                            }
                            placeholder={t("pages.networkMap.fields.vlan")}
                            disabled={readOnly}
                          />
                        </div>
                        <select
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                          value={item.status}
                          onChange={(event) =>
                            updateSelectedNode({
                              interfaces: selectedNode.interfaces.map((current, currentIndex) =>
                                currentIndex === index ? { ...current, status: event.target.value as NodeInterface["status"] } : current
                              ),
                            })
                          }
                          disabled={readOnly}
                        >
                          <option value="up">{t("pages.networkMap.interfaceStatus.up")}</option>
                          <option value="down">{t("pages.networkMap.interfaceStatus.down")}</option>
                          <option value="degraded">{t("pages.networkMap.interfaceStatus.degraded")}</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{t("pages.networkMap.properties.routes")}</span>
                      <Button size="sm" variant="outline" disabled={readOnly} onClick={() => updateSelectedNode({ routes: [...selectedNode.routes, createEmptyRouteEntry()] })}>
                        <Plus className="h-3.5 w-3.5" />
                        {t("actions.add")}
                      </Button>
                    </div>
                    {selectedNode.routes.map((route, index) => (
                      <div key={`${selectedNode.id}-route-${index}`} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                        <Input
                          value={route.prefix}
                          onChange={(event) =>
                            updateSelectedNode({
                              routes: selectedNode.routes.map((current, currentIndex) => currentIndex === index ? { ...current, prefix: event.target.value } : current),
                            })
                          }
                          placeholder={t("pages.networkMap.fields.prefix")}
                          disabled={readOnly}
                        />
                        <Input
                          value={route.nextHop}
                          onChange={(event) =>
                            updateSelectedNode({
                              routes: selectedNode.routes.map((current, currentIndex) => currentIndex === index ? { ...current, nextHop: event.target.value } : current),
                            })
                          }
                          placeholder={t("pages.networkMap.fields.nextHop")}
                          disabled={readOnly}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                            value={route.protocol}
                            onChange={(event) =>
                              updateSelectedNode({
                                routes: selectedNode.routes.map((current, currentIndex) => currentIndex === index ? { ...current, protocol: event.target.value } : current),
                              })
                            }
                            disabled={readOnly}
                          >
                            {ROUTE_PROTOCOLS.map((protocol) => <option key={protocol} value={protocol}>{protocol}</option>)}
                          </select>
                          <Input
                            value={String(route.metric)}
                            onChange={(event) =>
                              updateSelectedNode({
                                routes: selectedNode.routes.map((current, currentIndex) => currentIndex === index ? { ...current, metric: event.target.value } : current),
                              })
                            }
                            placeholder={t("pages.networkMap.fields.metric")}
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {selectedEdge && (
                <>
                  <Input value={selectedEdge.label} onChange={(event) => updateSelectedEdge({ label: event.target.value })} placeholder={t("pages.networkMap.fields.label")} disabled={readOnly} />
                  <div className="grid grid-cols-2 gap-3">
                    <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={selectedEdge.style} onChange={(event) => updateSelectedEdge({ style: event.target.value as NetworkEdge["style"] })} disabled={readOnly}>
                      {NETWORK_EDGE_STYLES.map((style) => <option key={style} value={style}>{t(`pages.networkMap.edgeStyles.${style}`)}</option>)}
                    </select>
                    <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={selectedEdge.status} onChange={(event) => updateSelectedEdge({ status: event.target.value as NetworkEdge["status"] })} disabled={readOnly}>
                      <option value="healthy">{t("pages.networkMap.health.healthy")}</option>
                      <option value="warning">{t("pages.networkMap.health.warning")}</option>
                      <option value="critical">{t("pages.networkMap.health.critical")}</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={selectedEdge.bandwidth} onChange={(event) => updateSelectedEdge({ bandwidth: event.target.value })} placeholder={t("pages.networkMap.fields.bandwidth")} disabled={readOnly} />
                    <Input value={selectedEdge.latency} onChange={(event) => updateSelectedEdge({ latency: event.target.value })} placeholder={t("pages.networkMap.fields.latency")} disabled={readOnly} />
                  </div>
                  <Input value={selectedEdge.network} onChange={(event) => updateSelectedEdge({ network: event.target.value })} placeholder={t("pages.networkMap.fields.network")} disabled={readOnly} />
                </>
              )}
              {!selectedNode && !selectedEdge && selectedNodeIds.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("pages.networkMap.properties.empty")}</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{t("pages.networkMap.policies.title")}</CardTitle>
              <Button size="sm" variant="outline" disabled={readOnly} onClick={() => mutateTopology((current) => ({ ...current, policies: [...current.policies, createEmptyPolicy()] }))}>
                <Plus className="h-3.5 w-3.5" />
                {t("actions.add")}
              </Button>
            </CardHeader>
            <CardContent className="max-h-[320px] space-y-3 overflow-auto pr-1">
              {topology.policies.map((policy) => (
                <div key={policy.id} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                  <Input value={policy.name} onChange={(event) => mutateTopology((current) => ({ ...current, policies: current.policies.map((item) => item.id === policy.id ? { ...item, name: event.target.value } : item) }))} disabled={readOnly} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={policy.type} onChange={(event) => mutateTopology((current) => ({ ...current, policies: current.policies.map((item) => item.id === policy.id ? { ...item, type: event.target.value } : item) }))} placeholder={t("pages.networkMap.fields.type")} disabled={readOnly} />
                    <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={policy.state} onChange={(event) => mutateTopology((current) => ({ ...current, policies: current.policies.map((item) => item.id === policy.id ? { ...item, state: event.target.value as TopologyPolicy["state"] } : item) }))} disabled={readOnly}>
                      <option value="active">{t("pages.networkMap.policyState.active")}</option>
                      <option value="triggered">{t("pages.networkMap.policyState.triggered")}</option>
                      <option value="disabled">{t("pages.networkMap.policyState.disabled")}</option>
                    </select>
                  </div>
                  <Input value={policy.target} onChange={(event) => mutateTopology((current) => ({ ...current, policies: current.policies.map((item) => item.id === policy.id ? { ...item, target: event.target.value } : item) }))} placeholder={t("pages.networkMap.fields.target")} disabled={readOnly} />
                </div>
              ))}
              {topology.policies.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("pages.networkMap.policies.empty")}</div>}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle>{t("pages.networkMap.validation.title")}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[320px] space-y-3 overflow-auto pr-1">
              {validation.length === 0 && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{t("pages.networkMap.validation.clear")}</div>}
              {validation.map((item) => (
                <div key={item.id} className={cn("rounded-2xl border p-3", item.severity === "critical" ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40")}>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                </div>
              ))}
            </CardContent>
          </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
