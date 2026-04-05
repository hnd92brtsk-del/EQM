import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  AlertCircle,
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

function DocumentRow({
  active,
  selected,
  name,
  description,
  nodes,
  edges,
  onClick,
  onDelete,
}: {
  active: boolean;
  selected: boolean;
  name: string;
  description: string | null;
  nodes: number;
  edges: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_42px_42px_32px] items-center gap-2 border px-3 py-2 text-left transition",
        selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:bg-slate-50",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold">{name}</div>
          {active ? <Badge className="rounded-none bg-amber-400 text-[10px] text-slate-950">OPEN</Badge> : null}
        </div>
        <div className={cn("truncate text-[11px]", selected ? "text-slate-300" : "text-slate-500")}>
          {description || "Без описания"}
        </div>
      </div>
      <div className="text-center text-xs font-semibold">{nodes}</div>
      <div className="text-center text-xs font-semibold">{edges}</div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center border transition",
          selected ? "border-white/20 hover:bg-white/10" : "border-slate-200 hover:bg-red-50",
        )}
        title="Удалить схему"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </button>
  );
}

function SerialMapV2PageInner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const readOnly = !hasPermission(user, "engineering", "write");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [documentSearch, setDocumentSearch] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [canvasSearch, setCanvasSearch] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);

  const actions = useSerialMapEditorActions({ readOnly });

  useEffect(() => {
    actions.registerCanvasElement(canvasRef.current);
  }, [actions]);

  useEffect(() => {
    setNodes(actions.document.nodes.map((node) => toFlowNode(node, actions.equipmentMap, actions.conflictedNodeIds)));
    setEdges(actions.document.edges.map((edge) => toFlowEdge(edge)));
  }, [actions.conflictedNodeIds, actions.document.edges, actions.document.nodes, actions.equipmentMap]);

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
    return actions.document.nodes.filter((item) => `${item.name} ${item.note} ${item.protocol}`.toLowerCase().includes(query));
  }, [actions.document.nodes, canvasSearch]);

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

  const shellClassName = fullscreen
    ? "fixed inset-4 z-[120] grid grid-cols-[320px_minmax(0,1fr)_340px] gap-4 bg-slate-100 p-4 shadow-2xl"
    : "grid h-[calc(100vh-7rem)] grid-cols-[320px_minmax(0,1fr)_340px] gap-4";

  return (
    <div className={shellClassName}>
      <Card className="rounded-none border-slate-300">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{t("pages.serialMap.v2.title")}</CardTitle>
              <CardDescription>Те же serial-map документы, новый React Flow редактор.</CardDescription>
            </div>
            {actions.recoveryDraft ? (
              <Button variant="outline" size="sm" className="rounded-none" onClick={() => void actions.restoreFallbackDraft()}>
                Восстановить
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button className="rounded-none" size="sm" onClick={() => void actions.createDocument()} disabled={readOnly}>
              <Plus className="mr-2 h-4 w-4" />
              Новая
            </Button>
            <Button className="rounded-none" variant="outline" size="sm" onClick={() => actions.selectedDocumentId !== null && void actions.openDocument(actions.selectedDocumentId)} disabled={actions.selectedDocumentId === null}>
              Открыть
            </Button>
            <Button className="rounded-none" variant="outline" size="sm" onClick={() => void actions.saveCurrent()} disabled={readOnly || !actions.hasOpenCanvas}>
              <Save className="mr-2 h-4 w-4" />
              Сохранить
            </Button>
            <Button className="rounded-none" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={readOnly}>
              <Upload className="mr-2 h-4 w-4" />
              Импорт
            </Button>
          </div>
          <Input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="Поиск схем..." className="rounded-none" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {filteredDocuments.map((item) => (
              <DocumentRow
                key={item.id}
                active={actions.activeDocumentId === item.id}
                selected={actions.selectedDocumentId === item.id}
                name={item.name}
                description={item.description}
                nodes={item.document.nodes.length}
                edges={item.document.edges.length}
                onClick={() => actions.setSelectedDocumentId(item.id)}
                onDelete={() => void actions.deleteDocument(item.id)}
              />
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Метаданные</div>
            <Input value={actions.documentName} onChange={(event) => actions.setDocumentName(event.target.value)} placeholder="Название схемы" className="rounded-none" />
            <textarea
              value={actions.documentDescription}
              onChange={(event) => actions.setDocumentDescription(event.target.value)}
              placeholder="Описание"
              className="min-h-[90px] w-full rounded-none border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <Button className="w-full rounded-none" variant="outline" onClick={() => actions.activeDocumentId !== null && void actions.updateDocumentMetadata(actions.activeDocumentId, actions.documentName, actions.documentDescription)} disabled={readOnly || !actions.hasOpenCanvas}>
              Обновить метаданные
            </Button>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Оборудование</div>
            <Input value={equipmentSearch} onChange={(event) => setEquipmentSearch(event.target.value)} placeholder="Поиск оборудования..." className="rounded-none" />
            <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
              {filteredEquipment.slice(0, 16).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="w-full border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                  onClick={() => void actions.addEquipmentNode(item)}
                  disabled={readOnly || !actions.hasOpenCanvas}
                >
                  <div className="font-medium">{item.displayName}</div>
                  <div className="text-[11px] text-slate-500">{item.containerName}{item.locationFullPath ? ` • ${item.locationFullPath}` : ""}</div>
                </button>
              ))}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden rounded-none border-slate-300">
        <CardHeader className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{t("pages.serialMap.v2.title")}</CardTitle>
              <CardDescription>Classic desktop shell поверх рабочего поля React Flow.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="rounded-none bg-slate-900 text-white">{saveStateLabel}</Badge>
              <Badge variant="outline" className="rounded-none">{actions.document.nodes.length} nodes</Badge>
              <Badge variant="outline" className="rounded-none">{actions.document.edges.length} edges</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative h-full min-h-0 p-0">
          <div ref={canvasRef} className="relative h-full min-h-[720px] bg-[#eef2f7]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[80] p-3">
              <div className="pointer-events-auto space-y-2">
                <Menubar className="rounded-none border-slate-300 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                  <MenubarMenu>
                    <MenubarTrigger>Файл</MenubarTrigger>
                    <MenubarContent>
                      <MenubarLabel>Документ</MenubarLabel>
                      <MenubarItem onClick={() => void actions.createDocument()} disabled={readOnly}>Новая схема<MenubarShortcut>Ctrl+N</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={() => actions.selectedDocumentId !== null && void actions.openDocument(actions.selectedDocumentId)} disabled={actions.selectedDocumentId === null}>Открыть<MenubarShortcut>Enter</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={() => void actions.saveCurrent()} disabled={readOnly || !actions.hasOpenCanvas}>Сохранить<MenubarShortcut>Ctrl+S</MenubarShortcut></MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem onClick={() => fileInputRef.current?.click()} disabled={readOnly}>Импорт JSON<MenubarShortcut>Ctrl+O</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={() => actions.exportCurrent("json")} disabled={!actions.hasOpenCanvas}>Экспорт JSON<MenubarShortcut>Ctrl+Shift+J</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={() => actions.exportCurrent("xml")} disabled={!actions.hasOpenCanvas}>Экспорт XML<MenubarShortcut>Ctrl+Shift+X</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={() => actions.exportCurrent("csv")} disabled={!actions.hasOpenCanvas}>Экспорт CSV<MenubarShortcut>Ctrl+Shift+C</MenubarShortcut></MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Правка</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem onClick={actions.undo} disabled={readOnly}>Undo<MenubarShortcut>Ctrl+Z</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={actions.redo} disabled={readOnly}>Redo<MenubarShortcut>Ctrl+Y</MenubarShortcut></MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem onClick={actions.copySelection} disabled={!actions.selectedNodeIds.length}>Copy<MenubarShortcut>Ctrl+C</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={actions.pasteSelection} disabled={readOnly || !actions.hasOpenCanvas}>Paste<MenubarShortcut>Ctrl+V</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={actions.duplicateSelection} disabled={readOnly || !actions.selectedNodeIds.length}>Duplicate<MenubarShortcut>Ctrl+D</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={actions.deleteSelection} disabled={readOnly || (!actions.selectedNodeIds.length && !actions.selectedEdgeId)}>Delete<MenubarShortcut>Del</MenubarShortcut></MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Вид</MenubarTrigger>
                    <MenubarContent>
                      <MenubarCheckboxItem checked={actions.showGrid} onClick={() => actions.setShowGrid((value) => !value)}>Сетка</MenubarCheckboxItem>
                      <MenubarCheckboxItem checked={actions.showMiniMap} onClick={() => actions.setShowMiniMap((value) => !value)}>Миникарта</MenubarCheckboxItem>
                      <MenubarSeparator />
                      <MenubarItem onClick={actions.fitView}>Fit view<MenubarShortcut>Ctrl+1</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={actions.resetView}>Reset view<MenubarShortcut>Ctrl+0</MenubarShortcut></MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Вставка</MenubarTrigger>
                    <MenubarContent>
                      <MenubarLabel>Preset nodes</MenubarLabel>
                      {SERIAL_MAP_NODE_TYPES.map((kind) => (
                        <MenubarItem key={kind} onClick={() => actions.addPresetNode(kind)} disabled={readOnly || !actions.hasOpenCanvas}>
                          {kind}
                        </MenubarItem>
                      ))}
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Инструменты</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem onClick={() => actions.setToolMode("connect")} disabled={readOnly}>Connect mode<MenubarShortcut>L</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={() => void actions.autoLayout()} disabled={readOnly || !actions.hasOpenCanvas}>Auto-layout<MenubarShortcut>Ctrl+L</MenubarShortcut></MenubarItem>
                      <MenubarItem onClick={() => setFullscreen((value) => !value)}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}<MenubarShortcut>F11</MenubarShortcut></MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem disabled>{actions.diagnostics.length} diagnostics</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>

                <div className="flex items-center gap-1 border border-slate-300 bg-white px-1.5 py-1 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                  <Button size="sm" variant={actions.toolMode === "select" ? "default" : "ghost"} className="rounded-none" onClick={() => actions.setToolMode("select")}>
                    <MousePointer2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant={actions.toolMode === "pan" ? "default" : "ghost"} className="rounded-none" onClick={() => actions.setToolMode("pan")}>
                    <Hand className="h-4 w-4" />
                  </Button>
                  <div className="mx-1 h-6 w-px bg-slate-200" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="rounded-none">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-none">
                      <DropdownMenuLabel>Добавить узел</DropdownMenuLabel>
                      <DropdownMenuGroup>
                        {SERIAL_MAP_NODE_TYPES.map((kind) => (
                          <DropdownMenuItem key={kind} onClick={() => actions.addPresetNode(kind)} disabled={readOnly || !actions.hasOpenCanvas}>
                            {kind}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant={actions.toolMode === "connect" ? "default" : "ghost"} className="rounded-none" onClick={() => actions.setToolMode("connect")}>
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.fitView}>
                    <Expand className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none" onClick={() => setFullscreen((value) => !value)}>
                    {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                  <div className="mx-1 h-6 w-px bg-slate-200" />
                  <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.undo} disabled={readOnly}>
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.redo} disabled={readOnly}>
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.copySelection} disabled={!actions.selectedNodeIds.length}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.duplicateSelection} disabled={readOnly || !actions.selectedNodeIds.length}>
                    <CopyPlus className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none" onClick={actions.deleteSelection} disabled={readOnly || (!actions.selectedNodeIds.length && !actions.selectedEdgeId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="ml-auto flex w-[240px] items-center border border-slate-200 bg-slate-50 px-2">
                    <Search className="mr-2 h-4 w-4 text-slate-400" />
                    <input
                      value={canvasSearch}
                      onChange={(event) => setCanvasSearch(event.target.value)}
                      placeholder="Найти узел на схеме..."
                      className="h-8 w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {canvasSearch && searchedNodes.length ? (
              <div className="absolute right-3 top-24 z-[85] w-[280px] border border-slate-300 bg-white shadow-xl">
                {searchedNodes.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-slate-50"
                    onClick={() => actions.focusNode(item.id)}
                  >
                    <div className="font-medium">{item.name}</div>
                    <div className="text-[11px] text-slate-500">{item.protocol}</div>
                  </button>
                ))}
              </div>
            ) : null}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              onInit={actions.registerFlowInstance}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDragStart={() => actions.beginNodeDrag()}
              onNodeDragStop={handleDragStop}
              onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) =>
                actions.setSelection(
                  selectedNodes.map((item) => item.id),
                  selectedEdges[0]?.id || null,
                )
              }
              onMoveEnd={(_, viewport) =>
                actions.mutateCurrentDocument(
                  (current) => ({ ...current, viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom } }),
                  { recordHistory: false },
                )
              }
              panOnDrag={actions.toolMode === "pan"}
              selectionOnDrag={actions.toolMode !== "pan"}
              nodesDraggable={!readOnly && actions.toolMode !== "pan"}
              nodesConnectable={!readOnly && actions.toolMode === "connect"}
              elementsSelectable={actions.toolMode !== "pan"}
              deleteKeyCode={null}
              className="bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef2f7_62%,#e2e8f0_100%)]"
            >
              {actions.showGrid ? <Background gap={20} size={1} color="#cbd5e1" /> : null}
              <Controls position="bottom-left" className="!bottom-4 !left-4 !rounded-none !border !border-slate-300 !bg-white" />
              {actions.showMiniMap ? (
                <MiniMap
                  position="bottom-right"
                  className="!bottom-4 !right-4 !rounded-none !border !border-slate-300 !bg-white"
                  nodeColor={(node) => (actions.selectedNodeIds.includes(node.id) ? "#0f172a" : "#94a3b8")}
                />
              ) : null}
            </ReactFlow>

            <div className="absolute bottom-4 left-24 z-[70] flex items-center gap-2 border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
              {actions.toolMode === "pan" ? <Grab className="h-3.5 w-3.5" /> : actions.toolMode === "connect" ? <Link2 className="h-3.5 w-3.5" /> : <MousePointer2 className="h-3.5 w-3.5" />}
              <span>Mode: {actions.toolMode}</span>
            </div>

            {actions.message ? (
              <div className={cn("absolute bottom-4 right-40 z-[70] flex items-center gap-2 border px-3 py-2 text-sm shadow-lg", actions.message.tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-300 bg-white text-slate-700")}>
                <AlertCircle className="h-4 w-4" />
                <span>{actions.message.text}</span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

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
                <select className="h-10 rounded-none border border-slate-200 bg-white px-3 text-sm" value={actions.selectedNode.parity} onChange={(event) => actions.updateSelectedNode({ parity: event.target.value as typeof parityOptions[number] })} disabled={readOnly}>
                  {parityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <Input value={actions.selectedNode.dataBits} onChange={(event) => actions.updateSelectedNode({ dataBits: Number(event.target.value || 0) })} placeholder="Bits" className="rounded-none" disabled={readOnly} />
                <Input value={actions.selectedNode.stopBits} onChange={(event) => actions.updateSelectedNode({ stopBits: Number(event.target.value || 0) })} placeholder="Stop" className="rounded-none" disabled={readOnly} />
              </div>
              <textarea value={actions.selectedNode.note} onChange={(event) => actions.updateSelectedNode({ note: event.target.value })} placeholder="Комментарий" className="min-h-[96px] w-full rounded-none border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900" disabled={readOnly} />
            </div>
          ) : null}

          {actions.selectedEdge ? (
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Связь</div>
              <Input value={actions.selectedEdge.label} onChange={(event) => actions.updateSelectedEdge({ label: event.target.value })} placeholder="Label" className="rounded-none" disabled={readOnly} />
              <Input value={actions.selectedEdge.cableMark} onChange={(event) => actions.updateSelectedEdge({ cableMark: event.target.value })} placeholder="Cable mark" className="rounded-none" disabled={readOnly} />
              <div className="grid grid-cols-2 gap-2">
                <select className="h-10 rounded-none border border-slate-200 bg-white px-3 text-sm" value={actions.selectedEdge.protocol} onChange={(event) => actions.updateSelectedEdge({ protocol: event.target.value as SerialMapProtocol })} disabled={readOnly}>
                  {protocolOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <Input value={actions.selectedEdge.baudRate} onChange={(event) => actions.updateSelectedEdge({ baudRate: Number(event.target.value || 0) })} placeholder="Baud" className="rounded-none" disabled={readOnly} />
              </div>
            </div>
          ) : null}

          {actions.selectedNode ? (
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Data Pool</div>
                <Button size="sm" variant="outline" className="rounded-none" onClick={actions.addDataPoolEntry} disabled={readOnly}>Добавить</Button>
              </div>
              <div className="space-y-2">
                {actions.selectedNode.dataPool.map((entry: SerialMapDataPoolEntry) => (
                  <div key={entry.id} className="space-y-2 border border-slate-200 p-3">
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
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Gateway</div>
                <Button size="sm" variant="outline" className="rounded-none" onClick={actions.addGatewayMapping} disabled={readOnly}>Добавить mapping</Button>
              </div>
              {(actions.selectedNode.converterMappings || []).map((mapping) => (
                <div key={mapping.id} className="space-y-2 border border-slate-200 p-3">
                  <Input value={mapping.srcAddress} onChange={(event) => actions.updateGatewayMapping(mapping.id, { srcAddress: event.target.value })} placeholder="Source address" className="rounded-none" disabled={readOnly} />
                  <Input value={mapping.dstAddress} onChange={(event) => actions.updateGatewayMapping(mapping.id, { dstAddress: event.target.value })} placeholder="Destination address" className="rounded-none" disabled={readOnly} />
                  <Button size="sm" variant="outline" className="rounded-none" onClick={() => actions.removeGatewayMapping(mapping.id)} disabled={readOnly}>Удалить mapping</Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-3 border-t border-slate-200 pt-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Диагностика</div>
            <div className="space-y-2">
              {actions.diagnostics.map((item, index) => (
                <div key={`${item.message}-${index}`} className={cn("border px-3 py-2 text-sm", item.level === "error" ? "border-red-200 bg-red-50 text-red-900" : item.level === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700")}>
                  {item.message}
                </div>
              ))}
              {!actions.diagnostics.length ? <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Диагностических сообщений нет.</div> : null}
            </div>
          </div>
        </CardContent>
      </Card>
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
