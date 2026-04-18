import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  CopyPlus,
  Expand,
  Grab,
  Hand,
  Link2,
  Maximize2,
  Minimize2,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Search,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
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
import { SerialMapFlowEdge } from "../features/serialMap/v2/SerialMapFlowEdge";
import { SerialMapFlowNode } from "../features/serialMap/v2/SerialMapFlowNode";
import { useSerialMapEditorActions } from "../features/serialMap/v2/useSerialMapEditorActions";
import { SERIAL_MAP_NODE_TYPES, toFlowEdge, toFlowNode } from "../features/serialMap/v2/utils";
import type { SerialMapDataPoolEntry, SerialMapProtocol } from "../features/serialMap/types";
import { cn } from "../lib/utils";
import { hasPermission } from "../utils/permissions";

const protocolOptions: SerialMapProtocol[] = ["Modbus RTU", "Profibus DP", "CAN Bus", "RS-485", "RS-232", "Custom"];
const parityOptions = ["None", "Even", "Odd", "Mark", "Space"] as const;
const nodeTypes = { serialMapNode: SerialMapFlowNode };
const edgeTypes = { serialMapEdge: SerialMapFlowEdge };

type Bounds = { x: number; y: number; width: number; height: number };
type Viewport = { x: number; y: number; zoom: number };

function getMapBounds(nodes: Array<{ position: { x: number; y: number }; width?: number; height?: number }>): Bounds {
  if (!nodes.length) return { x: 0, y: 0, width: 800, height: 500 };

  const left = Math.min(...nodes.map((node) => node.position.x));
  const top = Math.min(...nodes.map((node) => node.position.y));
  const right = Math.max(...nodes.map((node) => node.position.x + (node.width || 220)));
  const bottom = Math.max(...nodes.map((node) => node.position.y + (node.height || 120)));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function buildMiniMapEdgePath(
  edge: { fromNodeId: string; toNodeId: string },
  nodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number }>,
) {
  const from = nodes.find((item) => item.id === edge.fromNodeId);
  const to = nodes.find((item) => item.id === edge.toNodeId);
  if (!from || !to) return "";

  const fromCenter = { x: from.position.x + (from.width || 220) / 2, y: from.position.y + (from.height || 120) / 2 };
  const toCenter = { x: to.position.x + (to.width || 220) / 2, y: to.position.y + (to.height || 120) / 2 };
  const dx = Math.abs(toCenter.x - fromCenter.x) * 0.42;
  return `M ${fromCenter.x} ${fromCenter.y} C ${fromCenter.x + dx} ${fromCenter.y}, ${toCenter.x - dx} ${toCenter.y}, ${toCenter.x} ${toCenter.y}`;
}

function SerialMapV2PageInner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { user } = useAuth();
  const readOnly = !hasPermission(user, "engineering", "write");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const [documentSearch, setDocumentSearch] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [canvasSearch, setCanvasSearch] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  const actions = useSerialMapEditorActions({ readOnly });

  useEffect(() => {
    actions.registerCanvasElement(canvasRef.current);
  }, [actions]);

  useEffect(() => {
    setNodes(actions.document.nodes.map((node) => toFlowNode(node, actions.equipmentMap, actions.conflictedNodeIds)));
    setEdges(actions.document.edges.map((edge) => toFlowEdge(edge)));
  }, [actions.conflictedNodeIds, actions.document.edges, actions.document.nodes, actions.equipmentMap]);

  useEffect(() => {
    setViewport(actions.document.viewport);
  }, [actions.document.viewport]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(globalThis.document.fullscreenElement === canvasShellRef.current);
    };

    globalThis.document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => globalThis.document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F11") return;
      event.preventDefault();
      void toggleFullscreen();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const filteredDocuments = useMemo(() => {
    const query = documentSearch.trim().toLowerCase();
    return actions.allDocuments.filter((item) => {
      if (!query) return true;
      return `${item.name} ${item.description || ""}`.toLowerCase().includes(query);
    });
  }, [actions.allDocuments, documentSearch]);

  const filteredEquipment = useMemo(() => {
    const query = equipmentSearch.trim().toLowerCase();
    return actions.allEquipment.filter((item) => {
      if (!query) return true;
      return `${item.displayName} ${item.containerName} ${item.locationFullPath || ""}`.toLowerCase().includes(query);
    });
  }, [actions.allEquipment, equipmentSearch]);

  const searchedNodes = useMemo(() => {
    const query = canvasSearch.trim().toLowerCase();
    if (!query) return [];
    return actions.document.nodes.filter((item) => `${item.name} ${item.note} ${item.protocol} ${item.kind} ${String(item.address ?? "")}`.toLowerCase().includes(query));
  }, [actions.document.nodes, canvasSearch]);

  const mapBounds = useMemo(() => getMapBounds(actions.document.nodes), [actions.document.nodes]);
  const miniMapViewBox = useMemo(
    () => ({
      x: mapBounds.x - 30,
      y: mapBounds.y - 30,
      width: Math.max(mapBounds.width + 60, 260),
      height: Math.max(mapBounds.height + 60, 180),
    }),
    [mapBounds],
  );
  const miniMapViewportRect = useMemo(() => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || !bounds.width || !bounds.height || viewport.zoom <= 0) return null;
    return {
      x: -viewport.x / viewport.zoom,
      y: -viewport.y / viewport.zoom,
      width: bounds.width / viewport.zoom,
      height: bounds.height / viewport.zoom,
    };
  }, [viewport]);

  const saveStateLabel =
    actions.saveStatus === "saving"
      ? "Сохранение..."
      : actions.saveStatus === "saved"
        ? "Сохранено"
        : actions.saveStatus === "error"
          ? "Ошибка"
          : actions.hasUnsavedChanges
            ? "Есть изменения"
            : "Черновик";

  const renderOpenDocumentsContent = () => (
    <DropdownMenuContent className="left-0 right-auto w-[380px] rounded-none p-0">
      <div className="border-b border-[var(--eqm-ui-border)] p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--eqm-ui-muted)]">Схемы</div>
        <Input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="Поиск схем..." className="rounded-none" />
      </div>
      <div className="max-h-[360px] overflow-auto p-1">
        {filteredDocuments.length ? filteredDocuments.map((item) => (
          <div key={item.id} className="flex items-start gap-2 border-b border-[var(--eqm-ui-border)] px-2 py-2 last:border-b-0">
            <button type="button" className={cn("flex min-w-0 flex-1 items-start gap-3 rounded-none px-2 py-1.5 text-left transition hover:bg-[var(--eqm-ui-panel-alt)]", actions.activeDocumentId === item.id && "bg-[var(--eqm-ui-panel-alt)]")} onClick={() => void actions.openDocument(item.id)}>
              <div className="pt-0.5 text-[var(--eqm-ui-accent)]">{actions.activeDocumentId === item.id ? <Check className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-[var(--eqm-ui-border)]" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><div className="truncate text-sm font-semibold">{item.name}</div>{actions.activeDocumentId === item.id ? <Badge className="rounded-none bg-amber-400 text-[10px] text-slate-950">OPEN</Badge> : null}</div>
                <div className="truncate text-[11px] text-[var(--eqm-ui-muted)]">{item.description || "Без описания"}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[var(--eqm-ui-muted)]">{item.document.nodes.length} nodes • {item.document.edges.length} edges</div>
              </div>
            </button>
            <Button size="sm" variant="ghost" className="h-8 w-8 rounded-none px-0" onClick={() => void actions.deleteDocument(item.id)} disabled={readOnly}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )) : <div className="px-3 py-4 text-sm text-[var(--eqm-ui-muted)]">Документы последовательных интерфейсов не найдены.</div>}
      </div>
    </DropdownMenuContent>
  );

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  };

  const onConnect = (connection: Connection) => {
    if (readOnly || actions.toolMode !== "connect") return;
    if (!connection.source || !connection.target) return;
    actions.connectNodes(connection.source, connection.target);
  };

  const handleDragStop = () => {
    const positions = Object.fromEntries(nodes.map((item) => [item.id, { x: item.position.x, y: item.position.y }]));
    actions.endNodeDrag(positions);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await actions.importDocumentsFromText(text);
    event.target.value = "";
  };
  const gridStyle = actions.showGrid
    ? {
        backgroundImage:
          "linear-gradient(to right, rgba(203,213,225,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(203,213,225,0.18) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }
    : undefined;

  const focusPoint = (x: number, y: number) => {
    if (!flowRef.current) return;
    flowRef.current.setCenter(x, y, { zoom: Math.max(flowRef.current.getZoom(), 0.8), duration: 250 });
  };

  const handleMiniMapPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const logicalX = miniMapViewBox.x + ((event.clientX - bounds.left) / bounds.width) * miniMapViewBox.width;
    const logicalY = miniMapViewBox.y + ((event.clientY - bounds.top) / bounds.height) * miniMapViewBox.height;
    focusPoint(logicalX, logicalY);
  };

  async function toggleFullscreen() {
    const target = canvasShellRef.current;
    if (!target) return;
    try {
      if (globalThis.document.fullscreenElement === target) {
        await globalThis.document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch {
      actions.setMessage({ tone: "warning", text: "Не удалось переключить полноэкранный режим." });
    }
  }

  const inspectorPanel = (
    <Card className="rounded-none border-slate-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Инспектор</CardTitle>
        <CardDescription>Свойства выбранного узла, связи и диагностические сообщения.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {actions.selectedNode ? (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Узел</div>
            <Input value={actions.selectedNode.name} onChange={(event) => actions.updateSelectedNode({ name: event.target.value })} className="rounded-none" disabled={readOnly} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={actions.selectedNode.address ?? ""} onChange={(event) => actions.updateSelectedNode({ address: event.target.value ? Number(event.target.value) : null })} placeholder="Адрес" className="rounded-none" disabled={readOnly} />
              <Input value={actions.selectedNode.segment} onChange={(event) => actions.updateSelectedNode({ segment: Number(event.target.value || 0) })} placeholder="Сегмент" className="rounded-none" disabled={readOnly} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="h-10 rounded-none border border-slate-200 bg-white px-3 text-sm" value={actions.selectedNode.protocol} onChange={(event) => actions.updateSelectedNode({ protocol: event.target.value as SerialMapProtocol })} disabled={readOnly}>
                {protocolOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <Input value={actions.selectedNode.baudRate} onChange={(event) => actions.updateSelectedNode({ baudRate: Number(event.target.value || 0) })} placeholder="Baud" className="rounded-none" disabled={readOnly} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select className="h-10 rounded-none border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] px-3 text-sm text-[var(--eqm-ui-text)]" value={actions.selectedNode.parity} onChange={(event) => actions.updateSelectedNode({ parity: event.target.value as typeof parityOptions[number] })} disabled={readOnly}>
                {parityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <Input value={actions.selectedNode.dataBits} onChange={(event) => actions.updateSelectedNode({ dataBits: Number(event.target.value || 0) })} placeholder="Bits" className="rounded-none" disabled={readOnly} />
              <Input value={actions.selectedNode.stopBits} onChange={(event) => actions.updateSelectedNode({ stopBits: Number(event.target.value || 0) })} placeholder="Stop" className="rounded-none" disabled={readOnly} />
            </div>
            <textarea value={actions.selectedNode.note} onChange={(event) => actions.updateSelectedNode({ note: event.target.value })} placeholder="Комментарий" className="min-h-[96px] w-full rounded-none border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] px-3 py-2 text-sm text-[var(--eqm-ui-text)] outline-none transition focus:border-[var(--eqm-ui-border-strong)]" disabled={readOnly} />
          </div>
        ) : null}

        {actions.selectedEdge ? (
          <div className="space-y-3 border-t border-[var(--eqm-ui-border)] pt-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--eqm-ui-muted)]">Связь</div>
            <Input value={actions.selectedEdge.label} onChange={(event) => actions.updateSelectedEdge({ label: event.target.value })} placeholder="Label" className="rounded-none" disabled={readOnly} />
            <Input value={actions.selectedEdge.cableMark} onChange={(event) => actions.updateSelectedEdge({ cableMark: event.target.value })} placeholder="Cable mark" className="rounded-none" disabled={readOnly} />
            <div className="grid grid-cols-2 gap-2">
              <select className="h-10 rounded-none border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] px-3 text-sm text-[var(--eqm-ui-text)]" value={actions.selectedEdge.protocol} onChange={(event) => actions.updateSelectedEdge({ protocol: event.target.value as SerialMapProtocol })} disabled={readOnly}>
                {protocolOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <Input value={actions.selectedEdge.baudRate} onChange={(event) => actions.updateSelectedEdge({ baudRate: Number(event.target.value || 0) })} placeholder="Baud" className="rounded-none" disabled={readOnly} />
            </div>
          </div>
        ) : null}

        {actions.selectedNode ? (
          <div className="space-y-3 border-t border-[var(--eqm-ui-border)] pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--eqm-ui-muted)]">Data Pool</div>
              <Button size="sm" variant="outline" className="rounded-none" onClick={actions.addDataPoolEntry} disabled={readOnly}>Добавить</Button>
            </div>
            <div className="space-y-2">
              {actions.selectedNode.dataPool.map((entry: SerialMapDataPoolEntry) => (
                <div key={entry.id} className="space-y-2 border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={entry.name} onChange={(event) => actions.updateDataPoolEntry(entry.id, { name: event.target.value })} placeholder="Name" className="rounded-none" disabled={readOnly} />
                    <Input value={entry.address} onChange={(event) => actions.updateDataPoolEntry(entry.id, { address: event.target.value })} placeholder="Address" className="rounded-none" disabled={readOnly} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={entry.registerType} onChange={(event) => actions.updateDataPoolEntry(entry.id, { registerType: event.target.value })} placeholder="Register type" className="rounded-none" disabled={readOnly} />
                    <Input value={entry.dataType} onChange={(event) => actions.updateDataPoolEntry(entry.id, { dataType: event.target.value })} placeholder="Data type" className="rounded-none" disabled={readOnly} />
                  </div>
                  <Button size="sm" variant="outline" className="rounded-none" onClick={() => actions.removeDataPoolEntry(entry.id)} disabled={readOnly}>Удалить запись</Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {actions.selectedNode?.kind === "gateway" ? (
          <div className="space-y-3 border-t border-[var(--eqm-ui-border)] pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--eqm-ui-muted)]">Gateway</div>
              <Button size="sm" variant="outline" className="rounded-none" onClick={actions.addGatewayMapping} disabled={readOnly}>Добавить mapping</Button>
            </div>
            {(actions.selectedNode.converterMappings || []).map((mapping) => (
              <div key={mapping.id} className="space-y-2 border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] p-3">
                <Input value={mapping.srcAddress} onChange={(event) => actions.updateGatewayMapping(mapping.id, { srcAddress: event.target.value })} placeholder="Source address" className="rounded-none" disabled={readOnly} />
                <Input value={mapping.dstAddress} onChange={(event) => actions.updateGatewayMapping(mapping.id, { dstAddress: event.target.value })} placeholder="Destination address" className="rounded-none" disabled={readOnly} />
                <Button size="sm" variant="outline" className="rounded-none" onClick={() => actions.removeGatewayMapping(mapping.id)} disabled={readOnly}>Удалить mapping</Button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-3 border-t border-[var(--eqm-ui-border)] pt-5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--eqm-ui-muted)]">Диагностика</div>
          <div className="space-y-2">
            {actions.diagnostics.map((item, index) => (
              <div key={`${item.message}-${index}`} className={cn("border px-3 py-2 text-sm", item.level === "error" ? "border-red-300/80 bg-[color-mix(in_srgb,#7f1d1d_18%,var(--eqm-ui-panel)_82%)] text-red-200" : item.level === "warning" ? "border-amber-300/80 bg-[color-mix(in_srgb,#78350f_16%,var(--eqm-ui-panel)_84%)] text-amber-100" : "border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] text-[var(--eqm-ui-text)]")}>
                {item.message}
              </div>
            ))}
            {!actions.diagnostics.length ? <div className="border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] px-3 py-2 text-sm text-[var(--eqm-ui-muted)]">Диагностических сообщений нет.</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div ref={canvasShellRef} className={cn("eqm-canvas-page space-y-4", isFullscreen && "fixed inset-0 z-[120] flex h-full flex-col overflow-hidden bg-[var(--eqm-ui-bg)] p-4")}>
      <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />

      <Card className="border-slate-200 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-xl">{t("pages.serialMap.v2.title")}</CardTitle>
              <CardDescription>Общий shell для canvas-редактора React Flow без отдельного левого меню.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-none bg-slate-900 text-white">{saveStateLabel}</Badge>
              <Badge variant="outline" className="rounded-none">{actions.document.nodes.length} nodes</Badge>
              <Badge variant="outline" className="rounded-none">{actions.document.edges.length} edges</Badge>
              {actions.recoveryDraft ? <Button variant="outline" size="sm" className="rounded-none" onClick={() => void actions.restoreFallbackDraft()}>Восстановить черновик</Button> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-none" size="sm" onClick={() => void actions.createDocument()} disabled={readOnly}><Plus className="h-4 w-4" />Новая</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-none" variant="outline" size="sm">Открыть<ChevronDown className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              {renderOpenDocumentsContent()}
            </DropdownMenu>
            <Button className="rounded-none" variant="outline" size="sm" onClick={() => void actions.saveCurrent()} disabled={readOnly || !actions.hasOpenCanvas}><Save className="h-4 w-4" />Сохранить</Button>
            <Button className="rounded-none" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={readOnly}><Upload className="h-4 w-4" />Импорт</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-none" variant="outline" size="sm" disabled={!actions.hasOpenCanvas}>Метаданные<ChevronDown className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="left-0 right-auto w-[360px] rounded-none p-3">
                <DropdownMenuLabel className="px-0">Активная схема</DropdownMenuLabel>
                <div className="space-y-3">
                  <Input value={actions.documentName} onChange={(event) => actions.setDocumentName(event.target.value)} placeholder="Название схемы" className="rounded-none" />
                  <textarea value={actions.documentDescription} onChange={(event) => actions.setDocumentDescription(event.target.value)} placeholder="Описание" className="min-h-[96px] w-full rounded-none border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] px-3 py-2 text-sm text-[var(--eqm-ui-text)] outline-none transition focus:border-[var(--eqm-ui-border-strong)]" />
                  <Button className="w-full rounded-none" variant="outline" onClick={() => actions.activeDocumentId !== null && void actions.updateDocumentMetadata(actions.activeDocumentId, actions.documentName, actions.documentDescription)} disabled={readOnly || !actions.hasOpenCanvas}>Обновить метаданные</Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
      </Card>

      <div className={cn("grid min-h-0 gap-4", isFullscreen ? "flex-1 grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_340px]")}>
        <div className="min-w-0 min-h-0">
          <Card className="relative h-full overflow-hidden rounded-none border-[var(--eqm-ui-border-strong)]">
            <CardHeader className="border-b border-[var(--eqm-ui-border)] pb-3" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--eqm-ui-panel) 96%, transparent) 0%, var(--eqm-ui-panel-alt) 100%)" }}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div><CardTitle className="text-base">{t("pages.serialMap.v2.title")}</CardTitle><CardDescription>Classic desktop shell поверх рабочего поля React Flow.</CardDescription></div>
                <div className="flex flex-wrap items-center gap-2"><Badge className="rounded-none bg-slate-900 text-white">{saveStateLabel}</Badge><Badge variant="outline" className="rounded-none">{actions.document.nodes.length} nodes</Badge><Badge variant="outline" className="rounded-none">{actions.document.edges.length} edges</Badge></div>
              </div>
            </CardHeader>
            <CardContent className="relative h-full min-h-0 p-0">
              <div ref={canvasRef} className={cn("relative overflow-hidden eqm-canvas-shell", isFullscreen ? "h-full min-h-0" : "h-[calc(100vh-22rem)] min-h-[720px]")}>
                <div className="absolute inset-0 z-0" style={{ background: isDark ? "radial-gradient(circle at top, rgba(23,36,52,0.98) 0%, rgba(16,26,38,0.97) 58%, rgba(10,18,27,1) 100%)" : "radial-gradient(circle at top, rgba(255,255,255,0.98) 0%, rgba(239,246,255,0.95) 62%, rgba(226,232,240,1) 100%)" }} />
                {actions.showGrid ? <div className="pointer-events-none absolute inset-0 z-[1]" style={gridStyle} /> : null}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[80] p-3">
                  <div className="pointer-events-auto space-y-2">
                    <Menubar className="rounded-none border-slate-300 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                      <MenubarMenu><MenubarTrigger>Файл</MenubarTrigger><MenubarContent><MenubarLabel>Документ</MenubarLabel><MenubarItem onClick={() => void actions.createDocument()} disabled={readOnly}>Новая схема<MenubarShortcut>Ctrl+N</MenubarShortcut></MenubarItem><DropdownMenu><DropdownMenuTrigger asChild><MenubarItem inset onSelect={(event) => event.preventDefault()}>Открыть<MenubarShortcut>Ctrl+O</MenubarShortcut></MenubarItem></DropdownMenuTrigger>{renderOpenDocumentsContent()}</DropdownMenu><MenubarItem onClick={() => void actions.saveCurrent()} disabled={readOnly || !actions.hasOpenCanvas}>Сохранить<MenubarShortcut>Ctrl+S</MenubarShortcut></MenubarItem><MenubarSeparator /><MenubarItem onClick={() => fileInputRef.current?.click()} disabled={readOnly}>Импорт JSON<MenubarShortcut>Ctrl+Shift+O</MenubarShortcut></MenubarItem><MenubarItem onClick={() => actions.exportCurrent("json")} disabled={!actions.hasOpenCanvas}>Экспорт JSON<MenubarShortcut>Ctrl+Shift+J</MenubarShortcut></MenubarItem><MenubarItem onClick={() => actions.exportCurrent("xml")} disabled={!actions.hasOpenCanvas}>Экспорт XML<MenubarShortcut>Ctrl+Shift+X</MenubarShortcut></MenubarItem><MenubarItem onClick={() => actions.exportCurrent("csv")} disabled={!actions.hasOpenCanvas}>Экспорт CSV<MenubarShortcut>Ctrl+Shift+C</MenubarShortcut></MenubarItem></MenubarContent></MenubarMenu>
                      <MenubarMenu><MenubarTrigger>Правка</MenubarTrigger><MenubarContent><MenubarItem onClick={actions.undo} disabled={readOnly}>Undo<MenubarShortcut>Ctrl+Z</MenubarShortcut></MenubarItem><MenubarItem onClick={actions.redo} disabled={readOnly}>Redo<MenubarShortcut>Ctrl+Y</MenubarShortcut></MenubarItem><MenubarSeparator /><MenubarItem onClick={actions.copySelection} disabled={!actions.selectedNodeIds.length}>Copy<MenubarShortcut>Ctrl+C</MenubarShortcut></MenubarItem><MenubarItem onClick={actions.pasteSelection} disabled={readOnly || !actions.hasOpenCanvas}>Paste<MenubarShortcut>Ctrl+V</MenubarShortcut></MenubarItem><MenubarItem onClick={actions.duplicateSelection} disabled={readOnly || !actions.selectedNodeIds.length}>Duplicate<MenubarShortcut>Ctrl+D</MenubarShortcut></MenubarItem><MenubarItem onClick={actions.deleteSelection} disabled={readOnly || (!actions.selectedNodeIds.length && !actions.selectedEdgeId)}>Delete<MenubarShortcut>Del</MenubarShortcut></MenubarItem></MenubarContent></MenubarMenu>
                      <MenubarMenu><MenubarTrigger>Вид</MenubarTrigger><MenubarContent><MenubarCheckboxItem checked={actions.showGrid} onClick={() => actions.setShowGrid((value) => !value)}>Сетка</MenubarCheckboxItem><MenubarCheckboxItem checked={actions.showMiniMap} onClick={() => actions.setShowMiniMap((value) => !value)}>Миникарта</MenubarCheckboxItem><MenubarSeparator /><MenubarItem onClick={actions.fitView}>Fit view<MenubarShortcut>Ctrl+1</MenubarShortcut></MenubarItem><MenubarItem onClick={actions.resetView}>Reset view<MenubarShortcut>Ctrl+0</MenubarShortcut></MenubarItem></MenubarContent></MenubarMenu>
                      <MenubarMenu><MenubarTrigger>Вставка</MenubarTrigger><MenubarContent><MenubarLabel>Preset nodes</MenubarLabel>{SERIAL_MAP_NODE_TYPES.map((kind) => <MenubarItem key={kind} onClick={() => actions.addPresetNode(kind)} disabled={readOnly || !actions.hasOpenCanvas}>{kind}</MenubarItem>)}</MenubarContent></MenubarMenu>
                      <MenubarMenu><MenubarTrigger>Инструменты</MenubarTrigger><MenubarContent><MenubarItem onClick={() => actions.setToolMode("connect")} disabled={readOnly}>Connect mode<MenubarShortcut>L</MenubarShortcut></MenubarItem><MenubarItem onClick={() => void actions.autoLayout()} disabled={readOnly || !actions.hasOpenCanvas}>Auto-layout<MenubarShortcut>Ctrl+L</MenubarShortcut></MenubarItem><MenubarItem onClick={() => void toggleFullscreen()}>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}<MenubarShortcut>F11</MenubarShortcut></MenubarItem><MenubarSeparator /><MenubarItem disabled>{actions.diagnostics.length} diagnostics</MenubarItem></MenubarContent></MenubarMenu>
                    </Menubar>
                    <div className="flex flex-wrap items-center gap-1 border border-[var(--eqm-ui-border-strong)] bg-[var(--eqm-ui-panel)] px-1.5 py-1 text-[var(--eqm-ui-text)] shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                      <Button size="sm" variant={actions.toolMode === "select" ? "default" : "ghost"} className="rounded-none" onClick={() => actions.setToolMode("select")}><MousePointer2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant={actions.toolMode === "pan" ? "default" : "ghost"} className="rounded-none" onClick={() => actions.setToolMode("pan")}><Hand className="h-4 w-4" /></Button>
                      <div className="mx-1 h-6 w-px bg-[var(--eqm-ui-border)]" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="rounded-none"><Plus className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="left-0 right-auto w-[340px] rounded-none p-0">
                          <div className="border-b border-[var(--eqm-ui-border)] p-3"><DropdownMenuLabel className="px-0">Добавить узел</DropdownMenuLabel><DropdownMenuGroup>{SERIAL_MAP_NODE_TYPES.map((kind) => <DropdownMenuItem key={kind} onClick={() => actions.addPresetNode(kind)} disabled={readOnly || !actions.hasOpenCanvas}>{kind}</DropdownMenuItem>)}</DropdownMenuGroup></div>
                          <div className="p-3"><DropdownMenuLabel className="px-0">Оборудование</DropdownMenuLabel><Input value={equipmentSearch} onChange={(event) => setEquipmentSearch(event.target.value)} placeholder="Поиск оборудования..." className="mb-3 rounded-none" /><div className="max-h-[260px] space-y-1 overflow-auto">{filteredEquipment.slice(0, 12).map((item) => <button key={item.key} type="button" className="w-full border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel)] px-3 py-2 text-left text-sm text-[var(--eqm-ui-text)] transition hover:border-[var(--eqm-ui-border-strong)] hover:bg-[var(--eqm-ui-panel-alt)]" onClick={() => void actions.addEquipmentNode(item)} disabled={readOnly || !actions.hasOpenCanvas}><div className="font-medium">{item.displayName}</div><div className="text-[11px] text-[var(--eqm-ui-muted)]">{item.containerName}{item.locationFullPath ? ` • ${item.locationFullPath}` : ""}</div></button>)}{!filteredEquipment.length ? <div className="px-1 py-2 text-sm text-[var(--eqm-ui-muted)]">Подходящее оборудование не найдено.</div> : null}</div></div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button size="sm" variant={actions.toolMode === "connect" ? "default" : "ghost"} className="rounded-none" onClick={() => actions.setToolMode("connect")}><Link2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.fitView}><Expand className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="rounded-none" onClick={() => void toggleFullscreen()}>{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
                      <div className="mx-1 h-6 w-px bg-[var(--eqm-ui-border)]" />
                      <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.undo} disabled={readOnly}><Undo2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.redo} disabled={readOnly}><Redo2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.copySelection} disabled={!actions.selectedNodeIds.length}><Copy className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.duplicateSelection} disabled={readOnly || !actions.selectedNodeIds.length}><CopyPlus className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.deleteSelection} disabled={readOnly || (!actions.selectedNodeIds.length && !actions.selectedEdgeId)}><Trash2 className="h-4 w-4" /></Button>
                      <div className="ml-auto flex w-full min-w-[220px] max-w-[280px] items-center border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel-alt)] px-2"><Search className="mr-2 h-4 w-4 text-[var(--eqm-ui-muted)]" /><input value={canvasSearch} onChange={(event) => setCanvasSearch(event.target.value)} placeholder="Найти узел на схеме..." className="h-8 w-full bg-transparent text-sm text-[var(--eqm-ui-text)] outline-none placeholder:text-[var(--eqm-ui-muted)]" /></div>
                    </div>
                  </div>
                </div>
                {canvasSearch && searchedNodes.length ? <div className="absolute right-3 top-24 z-[85] w-[280px] border border-[var(--eqm-ui-border-strong)] bg-[var(--eqm-ui-panel)] shadow-xl">{searchedNodes.slice(0, 8).map((item) => <button key={item.id} type="button" className="block w-full border-b border-[var(--eqm-ui-border)] px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-[var(--eqm-ui-panel-alt)]" onClick={() => actions.focusNode(item.id)}><div className="font-medium">{item.name}</div><div className="text-[11px] text-[var(--eqm-ui-muted)]">{item.protocol}</div></button>)}</div> : null}
                {!actions.hasOpenCanvas ? <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-6 backdrop-blur-[1px]"><div className="w-full max-w-md border border-[var(--eqm-ui-border-strong)] bg-[var(--eqm-ui-panel)] p-6 text-center shadow-2xl"><div className="text-lg font-semibold text-[var(--eqm-ui-text)]">{actions.allDocuments.length ? "Нет открытой схемы" : "Документы последовательных интерфейсов не найдены"}</div><div className="mt-2 text-sm text-[var(--eqm-ui-muted)]">{actions.allDocuments.length ? "Выберите схему через кнопку Открыть или создайте новую." : "Создайте новую схему или импортируйте JSON, чтобы начать работу."}</div><div className="mt-4 flex flex-wrap justify-center gap-2"><Button size="sm" className="rounded-none" onClick={() => void actions.createDocument()} disabled={readOnly}><Plus className="h-4 w-4" />Новая схема</Button><Button size="sm" variant="outline" className="rounded-none" onClick={() => fileInputRef.current?.click()} disabled={readOnly}><Upload className="h-4 w-4" />Импорт</Button></div></div></div> : null}
                <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView onInit={(instance) => { flowRef.current = instance; actions.registerFlowInstance(instance); setViewport(instance.getViewport()); }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeDragStart={() => actions.beginNodeDrag()} onNodeDragStop={handleDragStop} onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => actions.setSelection(selectedNodes.map((item) => item.id), selectedEdges[0]?.id || null)} onMove={(_, nextViewport) => setViewport({ x: nextViewport.x, y: nextViewport.y, zoom: nextViewport.zoom })} onMoveEnd={(_, nextViewport) => actions.mutateCurrentDocument((current) => ({ ...current, viewport: { x: nextViewport.x, y: nextViewport.y, zoom: nextViewport.zoom } }), { recordHistory: false })} panOnDrag={actions.toolMode === "pan"} selectionOnDrag={actions.toolMode !== "pan"} nodesDraggable={!readOnly && actions.toolMode !== "pan"} nodesConnectable={!readOnly && actions.toolMode === "connect"} elementsSelectable={actions.toolMode !== "pan"} deleteKeyCode={null} style={{ background: "transparent" }}>
                  <Controls position="bottom-left" className="!bottom-4 !left-4 !rounded-none" style={{ backgroundColor: isDark ? "rgba(18,29,42,0.96)" : "rgba(255,255,255,0.96)", border: `1px solid ${isDark ? "rgba(211,223,237,0.18)" : "#cbd5e1"}`, color: isDark ? "#edf4ff" : "#152235" }} />
                </ReactFlow>
                <div className="absolute bottom-4 left-24 z-[70] flex items-center gap-2 border border-[var(--eqm-ui-border-strong)] bg-[var(--eqm-ui-panel)] px-3 py-1.5 text-xs text-[var(--eqm-ui-muted)] shadow-sm">{actions.toolMode === "pan" ? <Grab className="h-3.5 w-3.5" /> : actions.toolMode === "connect" ? <Link2 className="h-3.5 w-3.5" /> : <MousePointer2 className="h-3.5 w-3.5" />}<span>Mode: {actions.toolMode}</span></div>
                {actions.showMiniMap ? <Card className="absolute bottom-4 right-4 z-[70] w-[190px] rounded-none border-[var(--eqm-ui-border-strong)] bg-[color-mix(in_srgb,var(--eqm-ui-panel)_94%,transparent)] shadow-[0_18px_36px_rgba(15,23,42,0.18)] backdrop-blur"><CardContent className="p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--eqm-ui-muted)]">Миникарта</div><svg width="100%" height="120" viewBox={`${miniMapViewBox.x} ${miniMapViewBox.y} ${miniMapViewBox.width} ${miniMapViewBox.height}`} onPointerDown={handleMiniMapPointerDown} style={{ cursor: "pointer" }}>{actions.document.edges.map((edge) => <path key={edge.id} d={buildMiniMapEdgePath(edge, actions.document.nodes)} fill="none" stroke="color-mix(in srgb, var(--eqm-ui-muted) 78%, transparent)" strokeWidth="8" strokeLinecap="round" />)}{actions.document.nodes.map((node) => <rect key={node.id} x={node.position.x} y={node.position.y} width={node.width} height={node.height} fill={actions.selectedNodeIds.includes(node.id) ? "#60a5fa" : "color-mix(in srgb, var(--eqm-ui-panel-alt) 88%, #cbd5e1 12%)"} stroke={actions.selectedNodeIds.includes(node.id) ? "#bfdbfe" : "color-mix(in srgb, var(--eqm-ui-muted) 75%, transparent)"} strokeWidth="3" onPointerDown={(event) => { event.stopPropagation(); actions.focusNode(node.id); }} style={{ cursor: "pointer" }} />)}{miniMapViewportRect ? <rect x={miniMapViewportRect.x} y={miniMapViewportRect.y} width={miniMapViewportRect.width} height={miniMapViewportRect.height} fill="rgba(96,165,250,0.12)" stroke="#60a5fa" strokeWidth="4" pointerEvents="none" /> : null}</svg></CardContent></Card> : null}
                {actions.message ? <div className={cn("absolute bottom-4 right-56 z-[70] flex max-w-[420px] items-center gap-2 border px-3 py-2 text-sm shadow-lg", actions.message.tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[var(--eqm-ui-border-strong)] bg-[var(--eqm-ui-panel)] text-[var(--eqm-ui-text)]")}><AlertCircle className="h-4 w-4" /><span>{actions.message.text}</span></div> : null}
                {isFullscreen ? <div className="absolute right-4 top-4 z-[75] w-[min(360px,calc(100vw-32px))]">{inspectorPanel}</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>
        {!isFullscreen ? <div className="min-w-0">{inspectorPanel}</div> : null}
      </div>
    </div>
  );
}

export default function SerialMapV2Page() {
  return (
    <ReactFlowProvider>
      <SerialMapV2PageInner />
    </ReactFlowProvider>
  );
}
