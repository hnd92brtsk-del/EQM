
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import BackupTableRoundedIcon from "@mui/icons-material/BackupTableRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FilterCenterFocusRoundedIcon from "@mui/icons-material/FilterCenterFocusRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import OpenWithRoundedIcon from "@mui/icons-material/OpenWithRounded";
import PanToolRoundedIcon from "@mui/icons-material/PanToolRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import RouteRoundedIcon from "@mui/icons-material/RouteRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import { alpha } from "@mui/material/styles";

import { AppButton } from "../components/ui/AppButton";
import { useAuth } from "../context/AuthContext";
import { createSerialMapDocument, deleteSerialMapDocument, duplicateSerialMapDocument, getSerialMapDocument, listSerialMapDocuments, listSerialMapEligibleEquipment, updateSerialMapDocument } from "../features/serialMap/api";
import { autoLayoutScheme, computeConflicts, computeDiagnostics, createDefaultProjectDraft, createDemoProjectDraft, createEmptyDataPoolEntry, createEmptyGatewayMapping, createNodeFromEquipment, createNodeFromPreset, createScheme, getProtocolMeta, resolveNodeName, snapshotOfScheme, validateImportedProject, withSchemeMutation } from "../features/serialMap/model";
import { clearSerialMapDraft, loadSerialMapDraft, saveSerialMapDraft } from "../features/serialMap/storage";
import type { SerialMapDataPoolEntry, SerialMapDiagnostic, SerialMapEdge, SerialMapNode, SerialMapNodeKind, SerialMapProjectDraft, SerialMapProtocol, SerialMapSaveStatus, SerialMapScheme, SerialMapSnapshot } from "../features/serialMap/types";

type ToolMode = "select" | "connect" | "pan";
type RightTab = "props" | "data" | "gateway";
type Interaction = { type: "pan"; startX: number; startY: number; viewport: SerialMapScheme["viewport"] } | { type: "drag"; startX: number; startY: number; nodeIds: string[]; positions: Record<string, { x: number; y: number }>; snapshot: SerialMapSnapshot; moved: boolean } | { type: "select"; startX: number; startY: number; endX: number; endY: number } | null;

const defaultViewport = { x: 0, y: 0, zoom: 1 };
const presetKindOrder: Exclude<SerialMapNodeKind, "equipment">[] = ["master", "slave", "sensor", "bus", "repeater", "gateway"];
const palette: Record<SerialMapNodeKind, { stroke: string; fill: string; head: string }> = {
  equipment: { stroke: "#2563eb", fill: "#ffffff", head: "#dbeafe" },
  master: { stroke: "#2563eb", fill: "#ffffff", head: "#dbeafe" },
  slave: { stroke: "#15803d", fill: "#ffffff", head: "#dcfce7" },
  sensor: { stroke: "#c2410c", fill: "#ffffff", head: "#ffedd5" },
  bus: { stroke: "#475569", fill: "#f8fafc", head: "#e2e8f0" },
  repeater: { stroke: "#7c3aed", fill: "#ffffff", head: "#ede9fe" },
  gateway: { stroke: "#dc2626", fill: "#ffffff", head: "#fee2e2" },
};

const activeSchemeOf = (project: SerialMapProjectDraft) => project.schemes.find((item) => item.id === project.activeSchemeId) || project.schemes[0];
const centerOf = (node: SerialMapNode) => ({ x: node.position.x + node.width / 2, y: node.position.y + node.height / 2 });
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rectOf = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) });
const intersects = (node: SerialMapNode, rect: { x: number; y: number; width: number; height: number }) => !(node.position.x + node.width < rect.x || node.position.x > rect.x + rect.width || node.position.y + node.height < rect.y || node.position.y > rect.y + rect.height);
const boundsOf = (nodes: SerialMapNode[]) => !nodes.length ? { x: 0, y: 0, width: 800, height: 500 } : { x: Math.min(...nodes.map((n) => n.position.x)), y: Math.min(...nodes.map((n) => n.position.y)), width: Math.max(...nodes.map((n) => n.position.x + n.width)) - Math.min(...nodes.map((n) => n.position.x)), height: Math.max(...nodes.map((n) => n.position.y + n.height)) - Math.min(...nodes.map((n) => n.position.y)) };
const replaceScheme = (project: SerialMapProjectDraft, schemeId: string, nextScheme: SerialMapScheme) => ({ ...project, updatedAt: new Date().toISOString(), schemes: project.schemes.map((item) => item.id === schemeId ? nextScheme : item) });
const addHistory = (project: SerialMapProjectDraft, schemeId: string, snapshot: SerialMapSnapshot) => { const scheme = project.schemes.find((item) => item.id === schemeId) || activeSchemeOf(project); return replaceScheme(project, schemeId, { ...scheme, history: { past: [...scheme.history.past, snapshot].slice(-100), future: [] } }); };
const xmlSafe = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const exportXml = (project: SerialMapProjectDraft) => `<?xml version="1.0" encoding="UTF-8"?><NetMap>${project.schemes.map((scheme) => `<Scheme id="${xmlSafe(scheme.id)}" name="${xmlSafe(scheme.name)}"><Nodes>${scheme.nodes.map((node) => `<Node id="${xmlSafe(node.id)}" type="${xmlSafe(node.kind)}" name="${xmlSafe(node.name)}" address="${node.address ?? ""}" protocol="${xmlSafe(node.protocol)}" baudRate="${node.baudRate}" parity="${xmlSafe(node.parity)}" dataBits="${node.dataBits}" stopBits="${node.stopBits}" segment="${node.segment}"><Note>${xmlSafe(node.note)}</Note></Node>`).join("")}</Nodes><Edges>${scheme.edges.map((edge) => `<Edge id="${xmlSafe(edge.id)}" from="${xmlSafe(edge.fromNodeId)}" to="${xmlSafe(edge.toNodeId)}" protocol="${xmlSafe(edge.protocol)}" baudRate="${edge.baudRate}" label="${xmlSafe(edge.label)}" />`).join("")}</Edges></Scheme>`).join("")}</NetMap>`;
const exportCsv = (project: SerialMapProjectDraft) => `\uFEFF${["Схема,ID,Тип,Имя,Адрес,Протокол,Бод,Чётность,Биты данных,Стоп-биты,Сегмент,Примечание,Мост", ...project.schemes.flatMap((scheme) => scheme.nodes.map((node) => [scheme.name, node.id, node.kind, node.name, node.address ?? "", node.protocol, node.baudRate, node.parity, node.dataBits, node.stopBits, node.segment, node.note, node.bridgeProtocol || ""].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")))].join("\n")}`;
function download(name: string, text: string, type: string) { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

export default function SerialMapPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const readOnly = !canWrite;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const interactionRef = useRef<Interaction>(null);

  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);
  const [isDraftDocument, setIsDraftDocument] = useState(false);
  const [documentName, setDocumentName] = useState("Карта последовательных протоколов");
  const [documentDescription, setDocumentDescription] = useState("");
  const [project, setProject] = useState<SerialMapProjectDraft>(() => loadSerialMapDraft() || createDefaultProjectDraft());
  const [saveStatus, setSaveStatus] = useState<SerialMapSaveStatus>("saved");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [rightTab, setRightTab] = useState<RightTab>("props");
  const [snapGrid, setSnapGrid] = useState(false);
  const [pendingConnectId, setPendingConnectId] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [storageMode, setStorageMode] = useState<"backend" | "fallback">("backend");
  const [message, setMessage] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [importDialog, setImportDialog] = useState<{ open: boolean; diagnostics: SerialMapDiagnostic[] }>({ open: false, diagnostics: [] });
  const [restoredFromFallback, setRestoredFromFallback] = useState(false);

  const documentsQuery = useQuery({ queryKey: ["serial-map-documents"], queryFn: () => listSerialMapDocuments({ page: 1, page_size: 100, scope: "engineering" }) });
  const detailQuery = useQuery({ queryKey: ["serial-map-document", activeDocumentId], queryFn: () => getSerialMapDocument(activeDocumentId as number), enabled: activeDocumentId !== null });
  const equipmentQuery = useQuery({ queryKey: ["serial-map-eligible-equipment"], queryFn: () => listSerialMapEligibleEquipment({}) });
  const protocolOptions: SerialMapProtocol[] = ["Modbus RTU", "Profibus DP", "CAN Bus", "RS-485", "RS-232", "Custom"];
  const nodeKindLabels: Record<SerialMapNodeKind, string> = {
    equipment: t("pages.serialMap.nodeKinds.equipment"),
    master: t("pages.serialMap.nodeKinds.master"),
    slave: t("pages.serialMap.nodeKinds.slave"),
    sensor: t("pages.serialMap.nodeKinds.sensor"),
    bus: t("pages.serialMap.nodeKinds.bus"),
    repeater: t("pages.serialMap.nodeKinds.repeater"),
    gateway: t("pages.serialMap.nodeKinds.gateway"),
  };
  const presetKinds = presetKindOrder.map((kind) => ({ kind, label: nodeKindLabels[kind] }));
  const parityOptions = ["None", "Even", "Odd", "Mark", "Space"] as const;

  useEffect(() => {
    if (documentsQuery.data?.items.length && activeDocumentId === null && !isDraftDocument) return void setActiveDocumentId(documentsQuery.data.items[0].id);
    if (!documentsQuery.data?.items.length && activeDocumentId === null && !isDraftDocument) {
      const fallback = loadSerialMapDraft();
      if (fallback) { setProject(fallback); setIsDraftDocument(true); setStorageMode("fallback"); setRestoredFromFallback(true); setMessage({ tone: "info", text: t("pages.serialMap.storage.recovered") }); }
      else { setProject(createDefaultProjectDraft()); setIsDraftDocument(true); }
    }
  }, [activeDocumentId, documentsQuery.data?.items, isDraftDocument, t]);

  useEffect(() => {
    if (!detailQuery.data) return;
    setProject(detailQuery.data.document || createDefaultProjectDraft());
    setDocumentName(detailQuery.data.name);
    setDocumentDescription(detailQuery.data.description || "");
    setIsDraftDocument(false);
    setStorageMode("backend");
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setPendingConnectId(null);
    setSaveStatus("saved");
    setRestoredFromFallback(false);
  }, [detailQuery.data]);
  useEffect(() => {
    if (!restoredFromFallback || readOnly || activeDocumentId !== null) return;
    setDirtyVersion((value) => value + 1);
    setRestoredFromFallback(false);
  }, [activeDocumentId, readOnly, restoredFromFallback]);
  useEffect(() => {
    if (dirtyVersion === 0 || readOnly) return;
    const timer = window.setTimeout(async () => {
      try {
        setSaveStatus("saving");
        if (activeDocumentId === null) {
          const created = await createSerialMapDocument({ name: documentName || t("pages.serialMap.title"), description: documentDescription || null, scope: "engineering", document: project });
          setActiveDocumentId(created.id);
          setIsDraftDocument(false);
          queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
          queryClient.setQueryData(["serial-map-document", created.id], created);
        } else {
          const updated = await updateSerialMapDocument(activeDocumentId, { name: documentName || t("pages.serialMap.title"), description: documentDescription || null, scope: "engineering", document: project });
          queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
          queryClient.setQueryData(["serial-map-document", activeDocumentId], updated);
        }
        clearSerialMapDraft();
        setStorageMode("backend");
        setSaveStatus("saved");
      } catch {
        saveSerialMapDraft(project);
        setStorageMode("fallback");
        setSaveStatus("error");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeDocumentId, dirtyVersion, documentDescription, documentName, project, queryClient, readOnly]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  const equipmentMap = useMemo(() => new Map((equipmentQuery.data || []).map((item) => [item.key, item])), [equipmentQuery.data]);
  const activeScheme = activeSchemeOf(project);
  const selectedNode = selectedNodeIds.length === 1 ? activeScheme.nodes.find((node) => node.id === selectedNodeIds[0]) || null : null;
  const selectedEdge = selectedEdgeId ? activeScheme.edges.find((edge) => edge.id === selectedEdgeId) || null : null;
  const conflicts = useMemo(() => computeConflicts(project).filter((item) => item.schemeId === activeScheme.id), [activeScheme.id, project]);
  const diagnostics = useMemo(() => computeDiagnostics(activeScheme), [activeScheme]);
  const visibleNodes = useMemo(() => { const q = nodeSearch.trim().toLowerCase(); return !q ? activeScheme.nodes : activeScheme.nodes.filter((node) => [resolveNodeName(node, equipmentMap), String(node.address ?? ""), node.protocol].join(" ").toLowerCase().includes(q)); }, [activeScheme.nodes, equipmentMap, nodeSearch]);
  const visibleEquipment = useMemo(() => { const q = equipmentSearch.trim().toLowerCase(); const items = equipmentQuery.data || []; return !q ? items : items.filter((item) => [item.displayName, item.manufacturerName || "", item.locationFullPath || ""].join(" ").toLowerCase().includes(q)); }, [equipmentQuery.data, equipmentSearch]);
  const mapBounds = useMemo(() => boundsOf(activeScheme.nodes), [activeScheme.nodes]);
  const storageText = storageMode === "fallback"
    ? t("pages.serialMap.storage.fallback", { keyName: "serial-map-editor:v1" })
    : t("pages.serialMap.storage.backend", { keyName: "serial-map-editor:v1" });

  const markDirty = () => setDirtyVersion((value) => value + 1);
  const mutateProject = (fn: (current: SerialMapProjectDraft) => SerialMapProjectDraft) => { setProject((current) => fn(current)); markDirty(); };
  const mutateScheme = (fn: (scheme: SerialMapScheme) => SerialMapScheme, recordHistory = true) => { setProject((current) => withSchemeMutation(current, activeSchemeOf(current).id, fn, { recordHistory })); markDirty(); };
  const toLogical = (clientX: number, clientY: number) => { const bounds = wrapperRef.current?.getBoundingClientRect(); return !bounds ? { x: 0, y: 0 } : { x: (clientX - bounds.left - activeScheme.viewport.x) / activeScheme.viewport.zoom, y: (clientY - bounds.top - activeScheme.viewport.y) / activeScheme.viewport.zoom }; };
  const setViewport = (viewport: SerialMapScheme["viewport"]) => mutateScheme((scheme) => ({ ...scheme, viewport }), false);
  const commitSnapshot = (snapshot: SerialMapSnapshot) => { setProject((current) => addHistory(current, activeSchemeOf(current).id, snapshot)); markDirty(); };
  const focusNode = (nodeId: string) => { const bounds = wrapperRef.current?.getBoundingClientRect(); const node = activeScheme.nodes.find((item) => item.id === nodeId); if (!bounds || !node) return; setViewport({ x: bounds.width / 2 - (node.position.x + node.width / 2) * activeScheme.viewport.zoom, y: bounds.height / 2 - (node.position.y + node.height / 2) * activeScheme.viewport.zoom, zoom: activeScheme.viewport.zoom }); setSelectedNodeIds([nodeId]); setSelectedEdgeId(null); };
  const fitView = () => { const bounds = wrapperRef.current?.getBoundingClientRect(); if (!bounds || !activeScheme.nodes.length) return setViewport(defaultViewport); const b = boundsOf(activeScheme.nodes); const zoom = clamp(Math.min(bounds.width / (b.width + 120), bounds.height / (b.height + 120)), 0.2, 2.5); setViewport({ x: bounds.width / 2 - (b.x + b.width / 2) * zoom, y: bounds.height / 2 - (b.y + b.height / 2) * zoom, zoom }); };
  const createEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = activeScheme.nodes.find((node) => node.id === fromId);
    const to = activeScheme.nodes.find((node) => node.id === toId);
    if (!from || !to) return;
    const duplicate = activeScheme.edges.some((edge) => (edge.fromNodeId === fromId && edge.toNodeId === toId) || (edge.fromNodeId === toId && edge.toNodeId === fromId));
    if (duplicate) return setMessage({ tone: "warning", text: t("pages.serialMap.messages.duplicateEdge") });
    if ([from, to].some((node) => node.protocol === "RS-232" && activeScheme.edges.some((edge) => edge.fromNodeId === node.id || edge.toNodeId === node.id))) return setMessage({ tone: "warning", text: t("pages.serialMap.messages.rs232Limit") });
    mutateScheme((scheme) => ({ ...scheme, edges: [...scheme.edges, { id: `edge_${Math.random().toString(36).slice(2, 10)}`, fromNodeId: fromId, toNodeId: toId, protocol: from.protocol, baudRate: from.baudRate, label: "", meta: {} }] }));
    setMessage({ tone: "info", text: t("pages.serialMap.messages.edgeCreated") });
  };
  const beginNodeInteraction = (event: ReactPointerEvent, nodeId: string) => {
    event.stopPropagation();
    if (toolMode === "connect") { if (pendingConnectId && pendingConnectId !== nodeId) { createEdge(pendingConnectId, nodeId); setPendingConnectId(null); } else { setPendingConnectId(nodeId); setMessage({ tone: "info", text: t("pages.serialMap.messages.pickSecondNode") }); } return; }
    if (toolMode === "pan" || event.button !== 0) return void (interactionRef.current = { type: "pan", startX: event.clientX, startY: event.clientY, viewport: activeScheme.viewport });
    const selection = event.shiftKey ? (selectedNodeIds.includes(nodeId) ? selectedNodeIds.filter((id) => id !== nodeId) : [...selectedNodeIds, nodeId]) : (selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId]);
    setSelectedNodeIds(selection); setSelectedEdgeId(null); if (readOnly) return;
    const nodeIds = selection.length ? selection : [nodeId];
    interactionRef.current = { type: "drag", startX: event.clientX, startY: event.clientY, nodeIds, snapshot: snapshotOfScheme(activeScheme), moved: false, positions: Object.fromEntries(activeScheme.nodes.filter((node) => nodeIds.includes(node.id)).map((node) => [node.id, { ...node.position }])) };
  };
  const beginCanvasInteraction = (event: ReactPointerEvent) => {
    if (toolMode === "pan" || event.button === 1) return void (interactionRef.current = { type: "pan", startX: event.clientX, startY: event.clientY, viewport: activeScheme.viewport });
    if (toolMode === "connect") { setPendingConnectId(null); setMessage({ tone: "info", text: t("pages.serialMap.messages.pickFirstNode") }); return; }
    interactionRef.current = { type: "select", startX: event.clientX, startY: event.clientY, endX: event.clientX, endY: event.clientY };
    if (!event.shiftKey) setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  };
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const interaction = interactionRef.current; if (!interaction) return;
      if (interaction.type === "pan") setViewport({ ...interaction.viewport, x: interaction.viewport.x + event.clientX - interaction.startX, y: interaction.viewport.y + event.clientY - interaction.startY });
      else if (interaction.type === "drag") {
        const dx = (event.clientX - interaction.startX) / activeScheme.viewport.zoom; const dy = (event.clientY - interaction.startY) / activeScheme.viewport.zoom; if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) interaction.moved = true;
        mutateScheme((scheme) => ({ ...scheme, nodes: scheme.nodes.map((node) => !interaction.nodeIds.includes(node.id) ? node : ({ ...node, position: { x: snapGrid ? Math.round((interaction.positions[node.id].x + dx) / 20) * 20 : interaction.positions[node.id].x + dx, y: snapGrid ? Math.round((interaction.positions[node.id].y + dy) / 20) * 20 : interaction.positions[node.id].y + dy } })) }), false);
      } else interactionRef.current = { ...interaction, endX: event.clientX, endY: event.clientY };
    };
    const onUp = () => { const interaction = interactionRef.current; if (!interaction) return; if (interaction.type === "drag" && interaction.moved) commitSnapshot(interaction.snapshot); if (interaction.type === "select") setSelectedNodeIds(activeScheme.nodes.filter((node) => intersects(node, rectOf(toLogical(interaction.startX, interaction.startY), toLogical(interaction.endX, interaction.endY)))).map((node) => node.id)); interactionRef.current = null; };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [activeScheme, snapGrid]);
  const handleWheel = (event: React.WheelEvent) => { event.preventDefault(); const bounds = wrapperRef.current?.getBoundingClientRect(); if (!bounds) return; const mx = event.clientX - bounds.left; const my = event.clientY - bounds.top; const zoom = clamp(activeScheme.viewport.zoom * (event.deltaY > 0 ? 0.88 : 1.14), 0.2, 3); setViewport({ x: mx - ((mx - activeScheme.viewport.x) / activeScheme.viewport.zoom) * zoom, y: my - ((my - activeScheme.viewport.y) / activeScheme.viewport.zoom) * zoom, zoom }); };
  const updateSelectedNode = (patch: Partial<SerialMapNode>) => selectedNode && mutateScheme((scheme) => ({ ...scheme, nodes: scheme.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node) }));
  const updateSelectedEdge = (patch: Partial<SerialMapEdge>) => selectedEdge && mutateScheme((scheme) => ({ ...scheme, edges: scheme.edges.map((edge) => edge.id === selectedEdge.id ? { ...edge, ...patch } : edge) }));
  const updateDataPool = (entryId: string, patch: Partial<SerialMapDataPoolEntry>) => selectedNode && mutateScheme((scheme) => ({ ...scheme, nodes: scheme.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, dataPool: node.dataPool.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry) })) }));
  const addDataPoolEntry = () => selectedNode && mutateScheme((scheme) => ({ ...scheme, nodes: scheme.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, dataPool: [...node.dataPool, { ...createEmptyDataPoolEntry(node.protocol), sortOrder: node.dataPool.length + 1 }] })) }));
  const removeDataPoolEntry = (entryId: string) => selectedNode && mutateScheme((scheme) => ({ ...scheme, nodes: scheme.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, dataPool: node.dataPool.filter((entry) => entry.id !== entryId) })) }));
  const updateGatewayMapping = (mappingId: string, patch: Record<string, string>) => selectedNode && mutateScheme((scheme) => ({ ...scheme, nodes: scheme.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, converterMappings: (node.converterMappings || []).map((item) => item.id === mappingId ? { ...item, ...patch } : item) })) }));
  const addGatewayMapping = () => selectedNode && mutateScheme((scheme) => ({ ...scheme, nodes: scheme.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, converterMappings: [...(node.converterMappings || []), createEmptyGatewayMapping()] })) }));
  const removeGatewayMapping = (mappingId: string) => selectedNode && mutateScheme((scheme) => ({ ...scheme, nodes: scheme.nodes.map((node) => node.id !== selectedNode.id ? node : ({ ...node, converterMappings: (node.converterMappings || []).filter((item) => item.id !== mappingId) })) }));
  const deleteSelection = () => {
    if (readOnly) return;
    if (!selectedNodeIds.length && !selectedEdgeId) return;
    mutateScheme((scheme) => ({
      ...scheme,
      nodes: scheme.nodes.filter((node) => !selectedNodeIds.includes(node.id)),
      edges: scheme.edges.filter((edge) => edge.id !== selectedEdgeId && !selectedNodeIds.includes(edge.fromNodeId) && !selectedNodeIds.includes(edge.toNodeId)),
    }));
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setPendingConnectId(null);
  };
  const undo = () => {
    if (!activeScheme.history.past.length) return;
    const previous = activeScheme.history.past[activeScheme.history.past.length - 1];
    mutateProject((current) => replaceScheme(current, activeScheme.id, {
      ...activeScheme,
      nodes: structuredClone(previous.nodes),
      edges: structuredClone(previous.edges),
      viewport: structuredClone(previous.viewport),
      history: {
        past: activeScheme.history.past.slice(0, -1),
        future: [snapshotOfScheme(activeScheme), ...activeScheme.history.future].slice(0, 100),
      },
    }));
  };
  const redo = () => {
    if (!activeScheme.history.future.length) return;
    const next = activeScheme.history.future[0];
    mutateProject((current) => replaceScheme(current, activeScheme.id, {
      ...activeScheme,
      nodes: structuredClone(next.nodes),
      edges: structuredClone(next.edges),
      viewport: structuredClone(next.viewport),
      history: {
        past: [...activeScheme.history.past, snapshotOfScheme(activeScheme)].slice(-100),
        future: activeScheme.history.future.slice(1),
      },
    }));
  };
  const addPresetNode = (kind: Exclude<SerialMapNodeKind, "equipment">) => {
    if (readOnly) return;
    mutateScheme((scheme) => {
      const nextNode = createNodeFromPreset(kind, { x: mapBounds.x + 80 + scheme.nodes.length * 24, y: mapBounds.y + 80 + scheme.nodes.length * 16 }, scheme.nodes.length + 1);
      return { ...scheme, nodes: [...scheme.nodes, nextNode] };
    });
  };
  const addEquipmentNode = (equipmentKey: string) => {
    const item = equipmentMap.get(equipmentKey);
    if (!item || readOnly) return;
    mutateScheme((scheme) => ({ ...scheme, nodes: [...scheme.nodes, createNodeFromEquipment(item, { x: mapBounds.x + 80 + scheme.nodes.length * 28, y: mapBounds.y + 90 + scheme.nodes.length * 18 })] }));
  };
  const addScheme = () => mutateProject((current) => { const next = createScheme(`${t("pages.serialMap.labels.scheme")} ${current.schemes.length + 1}`); return { ...current, activeSchemeId: next.id, schemes: [...current.schemes, next] }; });
  const removeScheme = () => {
    if (readOnly || project.schemes.length <= 1) return;
    mutateProject((current) => {
      const remaining = current.schemes.filter((scheme) => scheme.id !== activeScheme.id);
      return { ...current, activeSchemeId: remaining[0].id, schemes: remaining };
    });
  };
  const autoLayout = () => mutateScheme((scheme) => autoLayoutScheme(scheme));
  const resetView = () => setViewport(defaultViewport);
  const switchScheme = (schemeId: string) => { setProject((current) => ({ ...current, activeSchemeId: schemeId })); setSelectedNodeIds([]); setSelectedEdgeId(null); setPendingConnectId(null); };
  const loadDemo = () => { if (readOnly) return; const demo = createDemoProjectDraft(); setProject(demo); setDocumentName(t("pages.serialMap.title")); setDocumentDescription(t("pages.serialMap.messages.demoDescription")); setIsDraftDocument(true); setActiveDocumentId(null); setSelectedNodeIds([]); setSelectedEdgeId(null); setPendingConnectId(null); markDirty(); fitView(); };
  const duplicateDocument = async () => {
    if (activeDocumentId === null) return;
    const cloned = await duplicateSerialMapDocument(activeDocumentId, `${documentName} ${t("pages.serialMap.actions.copySuffix")}`);
    queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
    setActiveDocumentId(cloned.id);
  };
  const removeDocument = async () => {
    if (activeDocumentId === null || readOnly) return;
    await deleteSerialMapDocument(activeDocumentId);
    queryClient.invalidateQueries({ queryKey: ["serial-map-documents"] });
    setActiveDocumentId(null);
    setProject(createDefaultProjectDraft());
    setIsDraftDocument(true);
  };
  const exportProject = (format: "json" | "xml" | "csv") => {
    if (format === "json") download(`${documentName || "serial-map"}.json`, JSON.stringify(project, null, 2), "application/json;charset=utf-8");
    if (format === "xml") download(`${documentName || "serial-map"}.xml`, exportXml(project), "application/xml;charset=utf-8");
    if (format === "csv") download(`${documentName || "serial-map"}.csv`, exportCsv(project), "text/csv;charset=utf-8");
  };
  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const result = validateImportedProject(parsed);
      if (result.project) {
        setProject(result.project);
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setPendingConnectId(null);
        markDirty();
      }
      setImportDialog({ open: true, diagnostics: result.diagnostics });
    } catch {
      setImportDialog({ open: true, diagnostics: [{ level: "error", message: t("pages.serialMap.messages.importJsonError") }] });
    }
    event.target.value = "";
  };
  const handleDropImport = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropHover(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const result = validateImportedProject(parsed);
      if (result.project) { setProject(result.project); markDirty(); }
      setImportDialog({ open: true, diagnostics: result.diagnostics });
    } catch {
      setImportDialog({ open: true, diagnostics: [{ level: "error", message: t("pages.serialMap.messages.importJsonError") }] });
    }
  };
  const activeInteraction = interactionRef.current;
  const logicalSelectionRect = activeInteraction?.type === "select" ? rectOf(toLogical(activeInteraction.startX, activeInteraction.startY), toLogical(activeInteraction.endX, activeInteraction.endY)) : null;
  const edgePath = (edge: SerialMapEdge) => {
    const from = activeScheme.nodes.find((item) => item.id === edge.fromNodeId);
    const to = activeScheme.nodes.find((item) => item.id === edge.toNodeId);
    if (!from || !to) return "";
    const a = centerOf(from);
    const b = centerOf(to);
    const dx = Math.abs(b.x - a.x) * 0.42;
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };
  const activeProtocolMeta = selectedNode ? getProtocolMeta(selectedNode.protocol) : null;

  return (
    <Box
      onDragEnter={(event) => { event.preventDefault(); setDropHover(true); }}
      onDragOver={(event) => { event.preventDefault(); setDropHover(true); }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDropHover(false); }}
      onDrop={handleDropImport}
      sx={{ p: 2.5, display: "grid", gap: 2, minHeight: "100%", bgcolor: "#eef4fb" }}
    >
      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={onImportFile} />
      <Alert severity={storageMode === "fallback" ? "warning" : "info"}>{storageText}</Alert>
      {message ? <Alert severity={message.tone === "warning" ? "warning" : "info"}>{message.text}</Alert> : null}
      <Card sx={{ borderRadius: 4, border: "1px solid", borderColor: "divider", boxShadow: "0 18px 40px rgba(15,23,42,0.08)" }}>
        <CardContent sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
          <TextField label={t("pages.serialMap.fields.document")} value={documentName} onChange={(event) => { setDocumentName(event.target.value); markDirty(); }} size="small" sx={{ minWidth: 260, flex: "1 1 260px" }} />
          <TextField label={t("pages.serialMap.fields.description")} value={documentDescription} onChange={(event) => { setDocumentDescription(event.target.value); markDirty(); }} size="small" sx={{ minWidth: 260, flex: "1 1 320px" }} />
          <Chip label={saveStatus === "saving" ? t("pages.serialMap.status.saving") : saveStatus === "error" ? t("pages.serialMap.status.localOnly") : activeDocumentId ? t("pages.serialMap.status.documentId", { id: activeDocumentId }) : t("pages.serialMap.status.newDraft")} color={saveStatus === "error" ? "warning" : "primary"} variant={saveStatus === "saved" ? "outlined" : "filled"} />
          <Tooltip title={t("pages.serialMap.toolbar.undo")}><span><IconButton onClick={undo} disabled={!activeScheme.history.past.length}><UndoRoundedIcon /></IconButton></span></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.redo")}><span><IconButton onClick={redo} disabled={!activeScheme.history.future.length}><RedoRoundedIcon /></IconButton></span></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.select")}><IconButton color={toolMode === "select" ? "primary" : "default"} onClick={() => setToolMode("select")}><OpenWithRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.connect")}><IconButton color={toolMode === "connect" ? "primary" : "default"} onClick={() => setToolMode("connect")}><RouteRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.pan")}><IconButton color={toolMode === "pan" ? "primary" : "default"} onClick={() => setToolMode("pan")}><PanToolRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.autoLayout")}><span><IconButton onClick={autoLayout} disabled={readOnly}><AutoFixHighRoundedIcon /></IconButton></span></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.fitView")}><IconButton onClick={fitView}><FilterCenterFocusRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.resetView")}><IconButton onClick={resetView}><RestartAltRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.grid")}><IconButton color={snapGrid ? "primary" : "default"} onClick={() => setSnapGrid((value) => !value)}><GridOnRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.addressTable")}><IconButton onClick={() => setAddressDialogOpen(true)}><BackupTableRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.importJson")}><span><IconButton onClick={() => fileInputRef.current?.click()} disabled={readOnly}><UploadRoundedIcon /></IconButton></span></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.exportJson")}><IconButton onClick={() => exportProject("json")}><DownloadRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.exportXml")}><IconButton onClick={() => exportProject("xml")}><ContentCopyRoundedIcon /></IconButton></Tooltip>
          <Tooltip title={t("pages.serialMap.toolbar.deleteSelection")}><span><IconButton onClick={deleteSelection} disabled={readOnly || (!selectedNodeIds.length && !selectedEdgeId)}><DeleteOutlineRoundedIcon /></IconButton></span></Tooltip>
          <Typography sx={{ ml: "auto", fontWeight: 700, color: "#0f172a" }}>{Math.round(activeScheme.viewport.zoom * 100)}%</Typography>
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "320px minmax(0,1fr) 360px" } }}>
        <Card sx={{ borderRadius: 4, minHeight: 720, border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>{t("pages.serialMap.sections.library")}</Typography>
            <Box sx={{ display: "grid", gap: 1 }}>
              {(documentsQuery.data?.items || []).map((item) => (
                <Card key={item.id} variant={activeDocumentId === item.id ? "elevation" : "outlined"} sx={{ borderRadius: 3, borderColor: activeDocumentId === item.id ? "primary.main" : "divider", bgcolor: activeDocumentId === item.id ? alpha("#2563eb", 0.08) : "background.paper" }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>{item.name}</Typography>
                    <Typography variant="body2" sx={{ color: "#475569" }}>{item.description || t("pages.serialMap.messages.noDescription")}</Typography>
                    <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                      <AppButton size="small" variant="contained" onClick={() => setActiveDocumentId(item.id)}>{t("pages.serialMap.actions.open")}</AppButton>
                      <AppButton size="small" variant="text" onClick={duplicateDocument} disabled={activeDocumentId !== item.id}>{t("pages.serialMap.actions.copy")}</AppButton>
                    </Box>
                  </CardContent>
                </Card>
              ))}
              <Box sx={{ display: "flex", gap: 1 }}>
                <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setProject(createDefaultProjectDraft()); setActiveDocumentId(null); setIsDraftDocument(true); setSelectedNodeIds([]); setSelectedEdgeId(null); setDocumentName(t("pages.serialMap.title")); setDocumentDescription(""); }}>{t("pages.serialMap.actions.new")}</AppButton>
                <AppButton variant="text" onClick={loadDemo} disabled={readOnly}>{t("pages.serialMap.actions.demo")}</AppButton>
                <AppButton variant="text" color="error" onClick={removeDocument} disabled={activeDocumentId === null || readOnly}>{t("actions.delete")}</AppButton>
              </Box>
            </Box>
            <Divider />
            <TextField label={t("pages.serialMap.fields.searchNodes")} value={nodeSearch} onChange={(event) => setNodeSearch(event.target.value)} size="small" />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {project.schemes.map((scheme) => (
                <Chip key={scheme.id} label={scheme.name} color={scheme.id === activeScheme.id ? "primary" : "default"} onClick={() => switchScheme(scheme.id)} onDelete={project.schemes.length > 1 && scheme.id === activeScheme.id && !readOnly ? removeScheme : undefined} sx={{ fontWeight: 700 }} />
              ))}
              <Chip label={t("pages.serialMap.actions.addScheme")} icon={<AddRoundedIcon />} onClick={addScheme} color="secondary" variant="outlined" />
            </Box>
            <Box sx={{ display: "grid", gap: 1, maxHeight: 240, overflow: "auto", pr: 0.5 }}>
              {visibleNodes.map((node) => (
                <Card key={node.id} variant="outlined" sx={{ borderRadius: 3, borderColor: selectedNodeIds.includes(node.id) ? "primary.main" : "divider", bgcolor: selectedNodeIds.includes(node.id) ? alpha("#2563eb", 0.06) : "#fffdf8" }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>{resolveNodeName(node, equipmentMap)}</Typography>
                    <Typography variant="body2" sx={{ color: "#475569" }}>{nodeKindLabels[node.kind]} • {node.protocol}{node.address !== null ? ` • ${t("pages.serialMap.labels.addressShort")} ${node.address}` : ""}</Typography>
                    <AppButton size="small" onClick={() => focusNode(node.id)}>{t("pages.serialMap.actions.focusNode")}</AppButton>
                  </CardContent>
                </Card>
              ))}
            </Box>
            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0f172a" }}>Быстрые узлы</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {presetKinds.map((item) => <Chip key={item.kind} label={item.label} onClick={() => addPresetNode(item.kind)} variant="outlined" />)}
            </Box>
            <TextField label="Поиск оборудования" value={equipmentSearch} onChange={(event) => setEquipmentSearch(event.target.value)} size="small" />
            <Box sx={{ display: "grid", gap: 1, maxHeight: 220, overflow: "auto", pr: 0.5 }}>
              {visibleEquipment.slice(0, 20).map((item) => (
                <Card key={item.key} variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>{item.displayName}</Typography>
                    <Typography variant="body2" sx={{ color: "#475569" }}>{item.serialPorts.map((port) => `${port.type} x${port.count}`).join(", ")}</Typography>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>{item.locationFullPath || item.containerName}</Typography>
                    <Box sx={{ mt: 0.75 }}><AppButton size="small" onClick={() => addEquipmentNode(item.key)} disabled={readOnly}>Добавить</AppButton></Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
            <Divider />
            <Box sx={{ display: "grid", gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: "#334155" }}>{t("pages.serialMap.stats.nodes", { count: activeScheme.nodes.length })}</Typography>
              <Typography variant="body2" sx={{ color: "#334155" }}>{t("pages.serialMap.stats.edges", { count: activeScheme.edges.length })}</Typography>
              <Typography variant="body2" sx={{ color: conflicts.length ? "#b91c1c" : "#334155", fontWeight: conflicts.length ? 700 : 500 }}>{t("pages.serialMap.stats.conflicts", { count: conflicts.length })}</Typography>
              <AppButton size="small" onClick={() => setConflictDialogOpen(true)} disabled={!conflicts.length}>{t("pages.serialMap.actions.showConflicts")}</AppButton>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 4, minHeight: 720, border: "1px solid", borderColor: "divider", position: "relative", overflow: "hidden" }}>
          <Box ref={wrapperRef} onWheel={handleWheel} onPointerDown={beginCanvasInteraction} sx={{ position: "relative", height: 720, overflow: "hidden", cursor: toolMode === "pan" ? "grab" : toolMode === "connect" ? "crosshair" : "default", background: "radial-gradient(circle at top, rgba(255,255,255,0.98), rgba(239,246,255,0.95))" }}>
            <svg width="100%" height="100%" style={{ display: "block" }}>
              <defs>
                <pattern id="serial-grid" width={snapGrid ? 20 : 32} height={snapGrid ? 20 : 32} patternUnits="userSpaceOnUse">
                  <path d={`M ${snapGrid ? 20 : 32} 0 L 0 0 0 ${snapGrid ? 20 : 32}`} fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.75" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#serial-grid)" />
              <g transform={`translate(${activeScheme.viewport.x} ${activeScheme.viewport.y}) scale(${activeScheme.viewport.zoom})`}>
                {activeScheme.edges.map((edge) => (
                  <g key={edge.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeIds([]); }}>
                    <path d={edgePath(edge)} fill="none" stroke={selectedEdgeId === edge.id ? "#2563eb" : "#64748b"} strokeWidth={selectedEdgeId === edge.id ? 4 : 3} strokeLinecap="round" />
                    <text x={(centerOf(activeScheme.nodes.find((n) => n.id === edge.fromNodeId) || activeScheme.nodes[0]).x + centerOf(activeScheme.nodes.find((n) => n.id === edge.toNodeId) || activeScheme.nodes[0]).x) / 2} y={(centerOf(activeScheme.nodes.find((n) => n.id === edge.fromNodeId) || activeScheme.nodes[0]).y + centerOf(activeScheme.nodes.find((n) => n.id === edge.toNodeId) || activeScheme.nodes[0]).y) / 2 - 10} fill="#334155" fontSize="12" fontWeight="700">{edge.label || edge.protocol}</text>
                  </g>
                ))}
                {activeScheme.nodes.map((node) => {
                  const colors = palette[node.kind];
                  const active = selectedNodeIds.includes(node.id);
                  const protocol = getProtocolMeta(node.protocol);
                  return (
                    <g key={node.id} transform={`translate(${node.position.x} ${node.position.y})`} onPointerDown={(event) => beginNodeInteraction(event, node.id)} style={{ cursor: toolMode === "connect" ? "crosshair" : "grab" }}>
                      <rect rx="22" width={node.width} height={node.height} fill={colors.fill} stroke={active ? "#2563eb" : colors.stroke} strokeWidth={active ? 4 : 2.2} filter={active ? "drop-shadow(0 12px 18px rgba(37,99,235,0.18))" : "drop-shadow(0 10px 18px rgba(15,23,42,0.10))"} />
                      <rect rx="22" width={node.width} height="28" fill={colors.head} />
                      <text x="16" y="19" fill="#0f172a" fontSize="13" fontWeight="800">{nodeKindLabels[node.kind].toUpperCase()}</text>
                      <text x="16" y="50" fill="#0f172a" fontSize="16" fontWeight="800">{resolveNodeName(node, equipmentMap)}</text>
                      <text x="16" y="69" fill="#475569" fontSize="12" fontWeight="700">{node.protocol}{node.address !== null ? ` • ${t("pages.serialMap.labels.addressShort")} ${node.address}` : ""}</text>
                      <text x="16" y="84" fill="#64748b" fontSize="11" fontWeight="700">{protocol.baudRates.includes(node.baudRate) ? `${node.baudRate} bit/s` : `${node.baudRate}`}</text>
                      {pendingConnectId === node.id ? <circle cx={node.width - 18} cy={16} r={7} fill="#2563eb" /> : null}
                    </g>
                  );
                })}
                {logicalSelectionRect ? <rect x={logicalSelectionRect.x} y={logicalSelectionRect.y} width={logicalSelectionRect.width} height={logicalSelectionRect.height} fill={alpha("#2563eb", 0.12)} stroke="#2563eb" strokeDasharray="8 6" /> : null}
              </g>
            </svg>
            {dropHover ? <Box sx={{ position: "absolute", inset: 24, borderRadius: 4, border: "2px dashed #2563eb", bgcolor: alpha("#dbeafe", 0.7), display: "grid", placeItems: "center", pointerEvents: "none" }}><Typography sx={{ fontWeight: 800, color: "#1d4ed8" }}>{t("pages.serialMap.messages.dropImport")}</Typography></Box> : null}
            <Card sx={{ position: "absolute", right: 16, bottom: 16, width: 190, borderRadius: 3, bgcolor: alpha("#ffffff", 0.94), border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Typography variant="caption" sx={{ color: "#334155", fontWeight: 800 }}>{t("pages.serialMap.sections.minimap")}</Typography>
                <svg width="100%" height="120" viewBox={`${mapBounds.x - 30} ${mapBounds.y - 30} ${Math.max(mapBounds.width + 60, 260)} ${Math.max(mapBounds.height + 60, 180)}`}>
                  {activeScheme.edges.map((edge) => <path key={edge.id} d={edgePath(edge)} fill="none" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />)}
                  {activeScheme.nodes.map((node) => <rect key={node.id} x={node.position.x} y={node.position.y} width={node.width} height={node.height} rx="16" fill={selectedNodeIds.includes(node.id) ? "#93c5fd" : "#e2e8f0"} stroke="#64748b" strokeWidth="3" onClick={() => focusNode(node.id)} style={{ cursor: "pointer" }} />)}
                </svg>
              </CardContent>
            </Card>
          </Box>
        </Card>

        <Card sx={{ borderRadius: 4, minHeight: 720, border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>{t("pages.serialMap.sections.properties")}</Typography>
            <Tabs value={rightTab} onChange={(_, value) => setRightTab(value)} variant="fullWidth">
              <Tab value="props" label={t("pages.serialMap.tabs.properties")} />
              <Tab value="data" label={t("pages.serialMap.tabs.dataPool")} />
              <Tab value="gateway" label={t("pages.serialMap.tabs.gateway")} />
            </Tabs>
            {rightTab === "props" ? (
              <Box sx={{ display: "grid", gap: 1.25 }}>
                {selectedNode ? (
                  <>
                    <TextField label="Имя" value={selectedNode.name} onChange={(event) => updateSelectedNode({ name: event.target.value })} size="small" />
                    <FormControl size="small"><InputLabel>{t("pages.serialMap.fields.protocol")}</InputLabel><Select label={t("pages.serialMap.fields.protocol")} value={selectedNode.protocol} onChange={(event) => updateSelectedNode({ protocol: event.target.value as SerialMapProtocol })}>{protocolOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
                    <TextField label={t("pages.serialMap.fields.address")} size="small" type="number" value={selectedNode.address ?? ""} onChange={(event) => updateSelectedNode({ address: event.target.value === "" ? null : Number(event.target.value) })} />
                    <TextField label={t("pages.serialMap.fields.baudRate")} size="small" type="number" value={selectedNode.baudRate} onChange={(event) => updateSelectedNode({ baudRate: Number(event.target.value) })} />
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1 }}>
                      <FormControl size="small"><InputLabel>{t("pages.serialMap.fields.parity")}</InputLabel><Select label={t("pages.serialMap.fields.parity")} value={selectedNode.parity} onChange={(event) => updateSelectedNode({ parity: event.target.value as SerialMapNode["parity"] })}>{parityOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
                      <TextField label={t("pages.serialMap.fields.dataBits")} size="small" type="number" value={selectedNode.dataBits} onChange={(event) => updateSelectedNode({ dataBits: Number(event.target.value) })} />
                      <TextField label={t("pages.serialMap.fields.stopBits")} size="small" type="number" value={selectedNode.stopBits} onChange={(event) => updateSelectedNode({ stopBits: Number(event.target.value) })} />
                    </Box>
                    <TextField label={t("pages.serialMap.fields.segment")} size="small" type="number" value={selectedNode.segment} onChange={(event) => updateSelectedNode({ segment: Number(event.target.value) })} />
                    <TextField label={t("pages.serialMap.fields.comment")} value={selectedNode.note} onChange={(event) => updateSelectedNode({ note: event.target.value })} size="small" multiline minRows={3} />
                    <Typography variant="caption" sx={{ color: "#475569" }}>{t("pages.serialMap.fields.supportedRegisters")}: {activeProtocolMeta?.registerTypes.join(", ") || "-"}</Typography>
                  </>
                ) : selectedEdge ? (
                  <>
                    <TextField label={t("common.fields.label")} value={selectedEdge.label} onChange={(event) => updateSelectedEdge({ label: event.target.value })} size="small" />
                    <TextField label={t("pages.serialMap.fields.baudRate")} type="number" value={selectedEdge.baudRate} onChange={(event) => updateSelectedEdge({ baudRate: Number(event.target.value) })} size="small" />
                  </>
                ) : <Alert severity="info">{t("pages.serialMap.empty.selectNodeOrEdge")}</Alert>}
              </Box>
            ) : null}
            {rightTab === "data" ? (
              <Box sx={{ display: "grid", gap: 1 }}>
                {selectedNode ? (
                  <>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>{t("pages.serialMap.sections.nodeDataPool")}</Typography>
                      <AppButton size="small" startIcon={<AddRoundedIcon />} onClick={addDataPoolEntry} disabled={readOnly}>{t("actions.add")}</AppButton>
                    </Box>
                    {(selectedNode.dataPool || []).map((entry) => (
                      <Card key={entry.id} variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent sx={{ p: 1.25, display: "grid", gap: 1, '&:last-child': { pb: 1.25 } }}>
                          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            <TextField label={t("common.fields.name")} size="small" value={entry.name} onChange={(event) => updateDataPool(entry.id, { name: event.target.value })} />
                            <TextField label={t("pages.serialMap.fields.address")} size="small" value={entry.address} onChange={(event) => updateDataPool(entry.id, { address: event.target.value })} />
                          </Box>
                          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            <FormControl size="small"><InputLabel>{t("pages.serialMap.fields.register")}</InputLabel><Select label={t("pages.serialMap.fields.register")} value={entry.registerType} onChange={(event) => updateDataPool(entry.id, { registerType: event.target.value })}>{Array.from(new Set([...(activeProtocolMeta?.registerTypes || []), entry.registerType].filter(Boolean))).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
                            <FormControl size="small"><InputLabel>{t("pages.serialMap.fields.dataType")}</InputLabel><Select label={t("pages.serialMap.fields.dataType")} value={entry.dataType} onChange={(event) => updateDataPool(entry.id, { dataType: event.target.value })}>{Array.from(new Set([...(activeProtocolMeta?.dataTypes || []), entry.dataType].filter(Boolean))).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
                          </Box>
                          <TextField label={t("pages.serialMap.fields.description")} size="small" value={entry.description} onChange={(event) => updateDataPool(entry.id, { description: event.target.value })} />
                          <AppButton size="small" color="error" onClick={() => removeDataPoolEntry(entry.id)} disabled={readOnly}>{t("actions.delete")}</AppButton>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                ) : <Alert severity="info">{t("pages.serialMap.empty.selectNodeForDataPool")}</Alert>}
              </Box>
            ) : null}
            {rightTab === "gateway" ? (
              <Box sx={{ display: "grid", gap: 1 }}>
                {selectedNode?.kind === "gateway" ? (
                  <>
                    <FormControl size="small"><InputLabel>{t("pages.serialMap.fields.bridgeProtocol")}</InputLabel><Select label={t("pages.serialMap.fields.bridgeProtocol")} value={selectedNode.bridgeProtocol || ""} onChange={(event) => updateSelectedNode({ bridgeProtocol: (event.target.value || null) as SerialMapProtocol | null })}>{protocolOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>{t("pages.serialMap.sections.gatewayMappings")}</Typography>
                      <AppButton size="small" startIcon={<AddRoundedIcon />} onClick={addGatewayMapping} disabled={readOnly}>{t("actions.add")}</AppButton>
                    </Box>
                    {(selectedNode.converterMappings || []).map((mapping) => (
                      <Card key={mapping.id} variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent sx={{ p: 1.25, display: "grid", gap: 1, '&:last-child': { pb: 1.25 } }}>
                          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                          <TextField label={t("pages.serialMap.fields.srcRegister")} size="small" value={mapping.srcRegisterType} onChange={(event) => updateGatewayMapping(mapping.id, { srcRegisterType: event.target.value })} />
                            <TextField label={t("pages.serialMap.fields.srcAddress")} size="small" value={mapping.srcAddress} onChange={(event) => updateGatewayMapping(mapping.id, { srcAddress: event.target.value })} />
                          </Box>
                          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            <TextField label={t("pages.serialMap.fields.dstRegister")} size="small" value={mapping.dstRegisterType} onChange={(event) => updateGatewayMapping(mapping.id, { dstRegisterType: event.target.value })} />
                            <TextField label={t("pages.serialMap.fields.dstAddress")} size="small" value={mapping.dstAddress} onChange={(event) => updateGatewayMapping(mapping.id, { dstAddress: event.target.value })} />
                          </Box>
                          <TextField label={t("pages.serialMap.fields.note")} size="small" value={mapping.note} onChange={(event) => updateGatewayMapping(mapping.id, { note: event.target.value })} />
                          <AppButton size="small" color="error" onClick={() => removeGatewayMapping(mapping.id)} disabled={readOnly}>{t("actions.delete")}</AppButton>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                ) : <Alert severity="info">{t("pages.serialMap.empty.selectGateway")}</Alert>}
              </Box>
            ) : null}
            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0f172a" }}>{t("pages.serialMap.sections.diagnostics")}</Typography>
            <Box sx={{ display: "grid", gap: 1, maxHeight: 220, overflow: "auto" }}>
              {diagnostics.length ? diagnostics.map((item, index) => <Alert key={`${item.level}-${index}`} severity={item.level === "error" ? "error" : item.level === "warning" ? "warning" : "info"}>{item.message}</Alert>) : <Alert severity="success">{t("pages.serialMap.messages.diagnosticsClear")}</Alert>}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Dialog open={conflictDialogOpen} onClose={() => setConflictDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("pages.serialMap.dialogs.conflicts")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 1.5, pt: 1 }}>
          {conflicts.length ? conflicts.map((conflict) => (
            <Card key={`${conflict.protocol}-${conflict.address}`} variant="outlined">
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontWeight: 800 }}>{conflict.protocol} / {conflict.address}</Typography>
                <Typography variant="body2" sx={{ color: "#475569", mb: 1 }}>{conflict.nodes.map((node) => node.name).join(", ")}</Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{conflict.nodeIds.map((nodeId) => <Chip key={nodeId} label={nodeId} onClick={() => { focusNode(nodeId); setConflictDialogOpen(false); }} />)}</Box>
              </CardContent>
            </Card>
          )) : <Alert severity="success">{t("pages.serialMap.messages.noConflicts")}</Alert>}
        </DialogContent>
        <DialogActions><AppButton onClick={() => setConflictDialogOpen(false)}>{t("actions.close")}</AppButton></DialogActions>
      </Dialog>

      <Dialog open={addressDialogOpen} onClose={() => setAddressDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t("pages.serialMap.dialogs.addressTable")}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "grid", gap: 1 }}>
            {activeScheme.nodes.filter((node) => node.address !== null).sort((a, b) => (a.address || 0) - (b.address || 0)).map((node) => (
              <Card key={node.id} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", '&:last-child': { pb: 1.5 } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>{node.name}</Typography>
                    <Typography variant="body2" sx={{ color: "#475569" }}>{node.protocol} • {t("pages.serialMap.fields.address")} {node.address}</Typography>
                  </Box>
                  <AppButton size="small" onClick={() => { focusNode(node.id); setAddressDialogOpen(false); }}>{t("pages.serialMap.actions.goTo")}</AppButton>
                </CardContent>
              </Card>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <AppButton onClick={() => exportProject("csv")}>CSV</AppButton>
          <AppButton onClick={() => setAddressDialogOpen(false)}>{t("actions.close")}</AppButton>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialog.open} onClose={() => setImportDialog({ open: false, diagnostics: [] })} fullWidth maxWidth="sm">
        <DialogTitle>{t("pages.serialMap.dialogs.importResult")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 1.25, pt: 1 }}>
          {importDialog.diagnostics.length ? importDialog.diagnostics.map((item, index) => <Alert key={`${item.level}-${index}`} severity={item.level === "error" ? "error" : item.level === "warning" ? "warning" : "info"}>{item.message}</Alert>) : <Alert severity="success">{t("pages.serialMap.messages.importOk")}</Alert>}
        </DialogContent>
        <DialogActions><AppButton onClick={() => setImportDialog({ open: false, diagnostics: [] })}>{t("actions.close")}</AppButton></DialogActions>
      </Dialog>
    </Box>
  );
}
