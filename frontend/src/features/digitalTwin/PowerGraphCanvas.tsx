import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ContentPasteRoundedIcon from "@mui/icons-material/ContentPasteRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PanToolAltRoundedIcon from "@mui/icons-material/PanToolAltRounded";
import PlaylistAddRoundedIcon from "@mui/icons-material/PlaylistAddRounded";
import { useTranslation } from "react-i18next";
import { alpha, useTheme } from "@mui/material/styles";

import type { DigitalTwinDocument, DigitalTwinItem, DigitalTwinPowerNode } from "../../api/digitalTwins";
import { AppButton } from "../../components/ui/AppButton";
import {
  analyzePowerGraph,
  boundsOfPowerNodes,
  CABINET_INPUT_NODE_ID,
  canCopyPowerSelection,
  canDeletePowerSelection,
  createPowerNodeForItem,
  duplicateManualItemWithNode,
  edgePathForPowerGraph,
  findPowerNodeByItemId,
  fitPowerGraphViewport,
  formatRequiredPowerLabel,
  getPowerNodeCenter,
  getPowerNodeSize,
  isItemPoweredByGraph,
  itemDisplayName,
  normalizeVoltageLabel,
  removePowerEdgeFromDocument,
  removePowerNodeFromDocument,
  type ValidationIssue,
} from "./utils";

type PowerGraphToolMode = "select" | "connect" | "pan";
type PowerGraphInteraction =
  | { type: "pan"; startX: number; startY: number; viewport: DigitalTwinDocument["viewport"]; moved: boolean }
  | { type: "drag-node"; startX: number; startY: number; nodeId: string; position: { x: number; y: number }; moved: boolean }
  | null;

type PowerGraphCanvasProps = {
  document: DigitalTwinDocument;
  canWrite: boolean;
  validationIssues: ValidationIssue[];
  updateDocument: (updater: (current: DigitalTwinDocument) => DigitalTwinDocument) => void;
  setErrorMessage: (message: string | null) => void;
};

const defaultViewport = { x: 0, y: 0, zoom: 1 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function ensureRenderableNodes(document: DigitalTwinDocument) {
  const cabinetNode = document.powerGraph.nodes.find((node) => node.kind === "cabinet-input");
  const nodes: DigitalTwinPowerNode[] = cabinetNode
    ? document.powerGraph.nodes
    : [
      {
        id: CABINET_INPUT_NODE_ID,
        kind: "cabinet-input" as const,
        item_id: null,
        label: document.cabinet_properties.incoming_label?.trim() || "Вводное напряжение",
        x: 80,
        y: 80,
        voltage: document.cabinet_properties.incoming_voltage || null,
        role: "source" as const,
        status: "active" as const,
      },
      ...document.powerGraph.nodes,
    ];

  return nodes.map((node): DigitalTwinPowerNode => {
    if (node.kind !== "cabinet-input") return node;
    return {
      ...node,
      id: CABINET_INPUT_NODE_ID,
      item_id: null,
      label: document.cabinet_properties.incoming_label?.trim() || node.label || "Вводное напряжение",
      voltage: document.cabinet_properties.incoming_voltage || node.voltage || null,
      role: "source",
      status: "active" as const,
    };
  });
}

export function PowerGraphCanvas({
  document,
  canWrite,
  validationIssues,
  updateDocument,
  setErrorMessage,
}: PowerGraphCanvasProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const shellRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<PowerGraphInteraction>(null);
  const initialViewportResolvedRef = useRef(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [pendingConnectNodeId, setPendingConnectNodeId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<PowerGraphToolMode>("select");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [addGraphObjectOpen, setAddGraphObjectOpen] = useState(false);
  const [graphClipboard, setGraphClipboard] = useState<{ kind: "manual-node"; item: DigitalTwinItem; node: DigitalTwinPowerNode } | null>(null);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const viewport = document.viewport || defaultViewport;
  const nodes = useMemo(() => ensureRenderableNodes(document), [document]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const edges = useMemo(
    () => document.powerGraph.edges.filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target)),
    [document.powerGraph.edges, nodeById],
  );
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) || null : null;
  const selectedEdge = selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) || null : null;
  const selectedGraphItem = selectedNode?.item_id ? document.items.find((item) => item.id === selectedNode.item_id) || null : null;
  const canCopySelection = canCopyPowerSelection({ ...document, powerGraph: { ...document.powerGraph, nodes } }, selectedNodeId);
  const canDeleteSelection = canWrite && canDeletePowerSelection(selectedNodeId, selectedEdgeId);
  const canPasteSelection = canWrite && Boolean(graphClipboard);
  const graphAvailableItems = useMemo(
    () => document.items.filter((item) => !findPowerNodeByItemId({ ...document, powerGraph: { ...document.powerGraph, nodes } }, item.id)),
    [document, nodes],
  );
  const sceneBounds = useMemo(() => boundsOfPowerNodes(nodes), [nodes]);
  const worldRect = useMemo(
    () => ({
      x: sceneBounds.x - 360,
      y: sceneBounds.y - 260,
      width: Math.max(sceneBounds.width + 720, 2200),
      height: Math.max(sceneBounds.height + 520, 1300),
    }),
    [sceneBounds],
  );
  const powerAnalysis = useMemo(() => analyzePowerGraph(document), [document]);
  const selectedGraphItemPowered = selectedGraphItem ? isItemPoweredByGraph(document, selectedGraphItem.id) : false;
  const selectedGraphItemRequiredPower = selectedGraphItem
    ? formatRequiredPowerLabel(selectedGraphItem.supply_voltage, selectedGraphItem.current_type)
    : null;
  const graphSurfaceColor = isDark ? "#1e293b" : "#eef3fb";
  const graphGridDot = isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.14)";
  const edgeColor = isDark ? "#94a3b8" : "#475569";
  const selectedEdgeColor = isDark ? "#f8fafc" : "#0f172a";
  const nodeTextColor = "#0f172a";
  const nodeFillColor = isDark ? "#f8fafc" : "#ffffff";
  const edgeLabelFill = isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.96)";
  const edgeLabelText = isDark ? "#f8fafc" : "#0f172a";
  const getNodeRolePalette = (role: DigitalTwinItem["power_role"] | "cabinet-input" | null | undefined) => {
    if (role === "cabinet-input" || role === "source") {
      return {
        fill: isDark ? "#ccfbf1" : "#c9f7ee",
        border: "#0f766e",
        chip: alpha(theme.palette.success.main, isDark ? 0.16 : 0.12),
      };
    }
    if (role === "converter") {
      return {
        fill: isDark ? "#fef3c7" : "#fff1c2",
        border: "#d97706",
        chip: alpha(theme.palette.warning.main, isDark ? 0.18 : 0.14),
      };
    }
    if (role === "consumer") {
      return {
        fill: isDark ? "#dbeafe" : "#e2efff",
        border: "#2563eb",
        chip: alpha(theme.palette.info.main, isDark ? 0.16 : 0.12),
      };
    }
    return {
      fill: nodeFillColor,
      border: isDark ? "#cbd5e1" : "#94a3b8",
      chip: alpha(theme.palette.common.black, isDark ? 0.06 : 0.05),
    };
  };
  const getNodeVisualState = (node: DigitalTwinPowerNode, item: DigitalTwinItem | null) => {
    const isCabinetInput = node.kind === "cabinet-input";
    const isPowered = isCabinetInput || powerAnalysis.energizedNodeIds.has(node.id);
    const rolePalette = getNodeRolePalette(isCabinetInput ? "cabinet-input" : item?.power_role);
    if (!isPowered) {
      return {
        fill: isDark ? "#fee2e2" : "#fff1f1",
        border: "#dc2626",
        chip: alpha(theme.palette.error.main, isDark ? 0.16 : 0.12),
        text: "#7f1d1d",
        powered: false,
      };
    }
    return {
      fill: rolePalette.fill,
      border: rolePalette.border,
      chip: rolePalette.chip,
      text: nodeTextColor,
      powered: true,
    };
  };
  const hasVisibleNodes = useMemo(() => {
    if (!wrapperSize.width || !wrapperSize.height || !nodes.length) return true;
    return nodes.some((node) => {
      const size = getPowerNodeSize(node);
      const left = node.x * viewport.zoom + viewport.x;
      const top = node.y * viewport.zoom + viewport.y;
      const right = left + size.width * viewport.zoom;
      const bottom = top + size.height * viewport.zoom;
      return right >= 0 && bottom >= 0 && left <= wrapperSize.width && top <= wrapperSize.height;
    });
  }, [nodes, viewport.x, viewport.y, viewport.zoom, wrapperSize.height, wrapperSize.width]);
  const legendItems = [
    { label: "Источник / ввод шкафа", fill: isDark ? "#ccfbf1" : "#c9f7ee", border: "#0f766e" },
    { label: "Потребитель", fill: isDark ? "#dbeafe" : "#e2efff", border: "#2563eb" },
    { label: "Преобразователь", fill: isDark ? "#fef3c7" : "#fff1c2", border: "#d97706" },
    { label: "Не запитан по графу", fill: isDark ? "#fee2e2" : "#fff1f1", border: "#dc2626" },
    { label: "Выбранный узел", fill: isDark ? "#eff6ff" : "#eff6ff", border: "#2563eb", highlight: true },
  ];

  useEffect(() => {
    if (selectedNodeId && !nodeById.has(selectedNodeId)) setSelectedNodeId(null);
    if (selectedEdgeId && !edges.some((edge) => edge.id === selectedEdgeId)) setSelectedEdgeId(null);
  }, [edges, nodeById, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(globalThis.document.fullscreenElement === shellRef.current);
    globalThis.document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => globalThis.document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const updateSize = () => {
      const bounds = element.getBoundingClientRect();
      setWrapperSize({ width: bounds.width, height: bounds.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initialViewportResolvedRef.current) return;
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds || !nodes.length) return;
    initialViewportResolvedRef.current = true;
    if (hasVisibleNodes) return;
    setViewport(fitPowerGraphViewport(nodes, { width: bounds.width, height: bounds.height }));
  }, [hasVisibleNodes, nodes]);

  const setViewport = (nextViewport: DigitalTwinDocument["viewport"]) => {
    updateDocument((current) => {
      current.viewport = nextViewport;
      return current;
    });
  };

  const updateSelectedDocumentItem = (itemId: string | null) => {
    updateDocument((current) => {
      current.ui.selected_item_id = itemId;
      return current;
    });
  };

  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPendingConnectNodeId(null);
    setToolMode("select");
    updateSelectedDocumentItem(null);
  };

  const focusInspector = () => inspectorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });

  const toLogical = (clientX: number, clientY: number) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: (clientX - bounds.left - viewport.x) / viewport.zoom,
      y: (clientY - bounds.top - viewport.y) / viewport.zoom,
    };
  };

  const fitView = () => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setViewport(fitPowerGraphViewport(nodes, { width: bounds.width, height: bounds.height }));
  };

  const toggleFullscreen = async () => {
    const target = shellRef.current;
    if (!target) return;
    try {
      if (globalThis.document.fullscreenElement === target) {
        await globalThis.document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch {
      setErrorMessage("Не удалось переключить полноэкранный режим графа.");
    }
  };

  const getNodeBucket = (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) return null;
    if (node.kind === "cabinet-input") {
      return normalizeVoltageLabel(document.cabinet_properties.incoming_voltage, document.cabinet_properties.incoming_current_type);
    }
    const item = node.item_id ? document.items.find((entry) => entry.id === node.item_id) : null;
    return item ? normalizeVoltageLabel(item.output_voltage || item.supply_voltage, item.current_type) : null;
  };

  const getTargetSupplyBucket = (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node || node.kind === "cabinet-input") return null;
    const item = node.item_id ? document.items.find((entry) => entry.id === node.item_id) : null;
    return item ? normalizeVoltageLabel(item.supply_voltage, item.current_type) : null;
  };

  const createEdge = (sourceId: string, targetId: string) => {
    if (!canWrite) return;
    if (sourceId === targetId) {
      setErrorMessage("Нельзя соединить узел сам с собой.");
      return;
    }
    if (targetId === CABINET_INPUT_NODE_ID) {
      setErrorMessage("Ввод шкафа может быть только источником.");
      return;
    }
    if (edges.some((edge) => edge.source === sourceId && edge.target === targetId)) {
      setErrorMessage("Такая связь уже существует.");
      return;
    }
    const sourceBucket = getNodeBucket(sourceId);
    const targetBucket = getTargetSupplyBucket(targetId);
    if (sourceBucket && targetBucket && sourceBucket !== targetBucket) {
      setErrorMessage(`Несовместимое напряжение: ${sourceBucket} -> ${targetBucket}.`);
      return;
    }
    const nextEdgeId = `edge-${Date.now()}`;
    updateDocument((current) => {
      current.powerGraph.edges.push({
        id: nextEdgeId,
        source: sourceId,
        target: targetId,
        label: "",
        voltage: null,
        role: "feed",
      });
      return current;
    });
    setPendingConnectNodeId(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(nextEdgeId);
    setToolMode("select");
    focusInspector();
  };

  const handleNodePointerDown = (event: ReactPointerEvent, nodeId: string) => {
    event.stopPropagation();
    if (toolMode === "connect") {
      if (pendingConnectNodeId && pendingConnectNodeId !== nodeId) {
        createEdge(pendingConnectNodeId, nodeId);
      } else {
        setPendingConnectNodeId(nodeId);
        setSelectedNodeId(nodeId);
        setSelectedEdgeId(null);
        updateSelectedDocumentItem(nodeById.get(nodeId)?.item_id || null);
      }
      return;
    }
    setPendingConnectNodeId(null);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    updateSelectedDocumentItem(nodeById.get(nodeId)?.item_id || null);
    if (!canWrite || toolMode === "pan" || event.button !== 0) return;
    const node = nodeById.get(nodeId);
    if (!node) return;
    interactionRef.current = {
      type: "drag-node",
      startX: event.clientX,
      startY: event.clientY,
      nodeId,
      position: { x: node.x, y: node.y },
      moved: false,
    };
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent) => {
    if (toolMode === "pan" || event.button === 1) {
      interactionRef.current = {
        type: "pan",
        startX: event.clientX,
        startY: event.clientY,
        viewport,
        moved: false,
      };
      return;
    }
    clearSelection();
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.type === "pan") {
        const dx = event.clientX - interaction.startX;
        const dy = event.clientY - interaction.startY;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) interaction.moved = true;
        setViewport({
          x: interaction.viewport.x + dx,
          y: interaction.viewport.y + dy,
          zoom: interaction.viewport.zoom,
        });
        return;
      }
      const dx = (event.clientX - interaction.startX) / viewport.zoom;
      const dy = (event.clientY - interaction.startY) / viewport.zoom;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) interaction.moved = true;
      updateDocument((current) => {
        const node = current.powerGraph.nodes.find((entry) => entry.id === interaction.nodeId);
        if (node) {
          node.x = interaction.position.x + dx;
          node.y = interaction.position.y + dy;
        }
        return current;
      });
    };
    const onUp = () => {
      interactionRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateDocument, viewport.zoom]);

  const handleWheel = (event: ReactWheelEvent) => {
    event.preventDefault();
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const mx = event.clientX - bounds.left;
    const my = event.clientY - bounds.top;
    const zoom = clamp(viewport.zoom * (event.deltaY > 0 ? 0.88 : 1.12), 0.2, 3);
    setViewport({
      x: mx - ((mx - viewport.x) / viewport.zoom) * zoom,
      y: my - ((my - viewport.y) / viewport.zoom) * zoom,
      zoom,
    });
  };

  const handleDelete = () => {
    if (!canDeleteSelection) return;
    updateDocument((current) => {
      if (selectedEdgeId) {
        removePowerEdgeFromDocument(current, selectedEdgeId);
      } else if (selectedNodeId) {
        const removedNode = current.powerGraph.nodes.find((node) => node.id === selectedNodeId);
        removePowerNodeFromDocument(current, selectedNodeId);
        if (removedNode?.item_id && current.ui.selected_item_id === removedNode.item_id) current.ui.selected_item_id = null;
      }
      return current;
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPendingConnectNodeId(null);
  };

  const handleCopy = () => {
    if (!selectedNodeId || !canCopySelection) return;
    const node = nodeById.get(selectedNodeId);
    const item = node?.item_id ? document.items.find((entry) => entry.id === node.item_id) : null;
    if (!node || !item || item.item_kind !== "manual") return;
    setGraphClipboard({ kind: "manual-node", item: { ...item }, node: { ...node } });
  };

  const handlePaste = () => {
    if (!graphClipboard || graphClipboard.kind !== "manual-node") return;
    let nextSelectedNodeId: string | null = null;
    updateDocument((current) => {
      const duplicated = duplicateManualItemWithNode(
        {
          ...current,
          items: [...current.items, graphClipboard.item],
          powerGraph: { ...current.powerGraph, nodes: [...current.powerGraph.nodes, graphClipboard.node] },
        },
        graphClipboard.item.id,
      );
      if (!duplicated) return current;
      current.items.push(duplicated.item);
      current.powerGraph.nodes.push(duplicated.node);
      current.ui.selected_item_id = duplicated.item.id;
      nextSelectedNodeId = duplicated.node.id;
      return current;
    });
    setSelectedNodeId(nextSelectedNodeId);
    setSelectedEdgeId(null);
    focusInspector();
  };

  const addItemToGraph = (itemId: string) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const logicalCenter = bounds
      ? toLogical(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      : { x: sceneBounds.x + sceneBounds.width / 2, y: sceneBounds.y + sceneBounds.height / 2 };
    updateDocument((current) => {
      const item = current.items.find((entry) => entry.id === itemId);
      if (!item || findPowerNodeByItemId(current, item.id)) return current;
      current.powerGraph.nodes.push(createPowerNodeForItem(item, { x: logicalCenter.x - 80, y: logicalCenter.y - 32 }));
      current.ui.selected_item_id = item.id;
      return current;
    });
    setSelectedNodeId(`pnode-${itemId}`);
    setSelectedEdgeId(null);
    setToolMode("select");
    setAddGraphObjectOpen(false);
    focusInspector();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName || "";
      const isEditable = tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable;
      if (isEditable) return;
      if (event.key === "Escape") {
        event.preventDefault();
        clearSelection();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && canDeleteSelection) {
        event.preventDefault();
        handleDelete();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && canCopySelection) {
        event.preventDefault();
        handleCopy();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && canPasteSelection) {
        event.preventDefault();
        handlePaste();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canCopySelection, canDeleteSelection, canPasteSelection, graphClipboard, selectedEdgeId, selectedNodeId]);
  const canvasHeight = isFullscreen ? "calc(100vh - 170px)" : 440;

  return (
    <Card ref={shellRef}>
      <CardContent
        sx={{
          display: "grid",
          gap: 2,
          p: isFullscreen ? 2 : 3,
          minHeight: isFullscreen ? "100vh" : undefined,
          bgcolor: isFullscreen ? "background.default" : undefined,
        }}
      >
        <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2} alignItems={{ xs: "stretch", lg: "center" }}>
          <Typography variant="h6">{t("pagesUi.digitalTwin.sections.powerGraph")}</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ border: "1px solid", borderColor: "divider", borderRadius: 999, px: 0.75, py: 0.5, bgcolor: "background.default", width: "fit-content" }}>
            <Tooltip title="Выбор">
              <span><IconButton size="small" color={toolMode === "select" ? "primary" : "default"} onClick={() => setToolMode("select")}><PanToolAltRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Панорамирование">
              <span><IconButton size="small" color={toolMode === "pan" ? "primary" : "default"} onClick={() => setToolMode("pan")}><EditRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Создать связь">
              <span><IconButton size="small" color={toolMode === "connect" ? "primary" : "default"} onClick={() => setToolMode("connect")} disabled={!canWrite}><LinkRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Добавить объект на граф">
              <span><IconButton size="small" onClick={() => setAddGraphObjectOpen(true)} disabled={!canWrite || !graphAvailableItems.length}><PlaylistAddRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Свойства выделения">
              <span><IconButton size="small" disabled={!selectedNodeId && !selectedEdgeId} onClick={focusInspector}><EditRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title={canDeleteSelection ? "Удалить выделенное" : "Нет выделения"}>
              <span><IconButton size="small" onClick={handleDelete} disabled={!canDeleteSelection}><DeleteSweepRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title={canCopySelection ? "Копировать manual-объект" : "Копирование доступно только для manual-объектов"}>
              <span><IconButton size="small" onClick={handleCopy} disabled={!canCopySelection}><ContentCopyRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title={canPasteSelection ? "Вставить" : "Буфер обмена пуст"}>
              <span><IconButton size="small" onClick={handlePaste} disabled={!canPasteSelection}><ContentPasteRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Подогнать под окно">
              <span><IconButton size="small" onClick={fitView}><CenterFocusStrongRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title={isFullscreen ? "Выйти из полного экрана" : "Полный экран"}>
              <span><IconButton size="small" onClick={() => { void toggleFullscreen(); }}>{isFullscreen ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}</IconButton></span>
            </Tooltip>
          </Stack>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 360px" }, gap: 2, minHeight: isFullscreen ? "calc(100vh - 130px)" : undefined }}>
          <Box
            ref={wrapperRef}
            onPointerDown={handleCanvasPointerDown}
            onWheel={handleWheel}
            sx={{
              position: "relative",
              height: canvasHeight,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              bgcolor: graphSurfaceColor,
              cursor: toolMode === "pan" ? "grab" : toolMode === "connect" ? "crosshair" : "default",
              backgroundImage: `radial-gradient(${graphGridDot} 1px, transparent 1px)`,
              backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
              backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            }}
          >
            {nodes.length && !hasVisibleNodes ? (
              <Alert
                severity="warning"
                action={<Button color="inherit" size="small" onClick={fitView}>Показать все</Button>}
                sx={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 2 }}
              >
                Узлы графа есть в документе, но не попадают в текущую область просмотра.
              </Alert>
            ) : null}
            <Box
              sx={{
                position: "absolute",
                top: nodes.length && !hasVisibleNodes ? 76 : 12,
                right: 12,
                zIndex: 2,
                width: 244,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.94 : 0.96),
                boxShadow: 3,
                p: 1.25,
                display: "grid",
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Легенда
              </Typography>
              {legendItems.map((item) => (
                <Box key={item.label} sx={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 1, alignItems: "center" }}>
                  <Box
                    sx={{
                      width: 20,
                      height: 14,
                      borderRadius: 1,
                      border: "2px solid",
                      borderColor: item.border,
                      bgcolor: item.fill,
                      boxShadow: item.highlight ? "0 0 0 3px rgba(37,99,235,0.16)" : "none",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25 }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                transformOrigin: "0 0",
                overflow: "visible",
              }}
            >
              <svg
                width={worldRect.width}
                height={worldRect.height}
                viewBox={`${worldRect.x} ${worldRect.y} ${worldRect.width} ${worldRect.height}`}
                style={{ position: "absolute", left: worldRect.x, top: worldRect.y, overflow: "visible" }}
              >
                {edges.map((edge) => {
                  const path = edgePathForPowerGraph(edge, nodes);
                  if (!path) return null;
                  const source = nodeById.get(edge.source);
                  const target = nodeById.get(edge.target);
                  if (!source || !target) return null;
                  const a = getPowerNodeCenter(source);
                  const b = getPowerNodeCenter(target);
                  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                  const selected = edge.id === selectedEdgeId;
                  return (
                    <g key={edge.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={selected ? selectedEdgeColor : edgeColor}
                        strokeWidth={selected ? 3.2 : 2}
                        style={{ cursor: "pointer" }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedNodeId(null);
                          setSelectedEdgeId(edge.id);
                          setPendingConnectNodeId(null);
                          setToolMode("select");
                          updateSelectedDocumentItem(null);
                          focusInspector();
                        }}
                      />
                      <polygon points={`${b.x - 12},${b.y - 6} ${b.x},${b.y} ${b.x - 12},${b.y + 6}`} fill={selected ? selectedEdgeColor : edgeColor} />
                      {(edge.label || edge.voltage) ? (
                        <g>
                          <rect x={mid.x - 54} y={mid.y - 12} rx="10" width="108" height="24" fill={edgeLabelFill} stroke={alpha(edgeColor, 0.35)} />
                          <text x={mid.x} y={mid.y + 4} textAnchor="middle" fill={edgeLabelText} fontSize="11">{edge.label || edge.voltage}</text>
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </svg>

              {nodes.map((node) => {
                const size = getPowerNodeSize(node);
                const selected = node.id === selectedNodeId;
                const pending = node.id === pendingConnectNodeId;
                const item = node.item_id ? document.items.find((entry) => entry.id === node.item_id) || null : null;
                const visualState = getNodeVisualState(node, item);
                const bucket = node.kind === "cabinet-input"
                  ? normalizeVoltageLabel(document.cabinet_properties.incoming_voltage, document.cabinet_properties.incoming_current_type)
                  : item
                    ? normalizeVoltageLabel(item.output_voltage || item.supply_voltage, item.current_type)
                    : null;
                return (
                  <Box
                    key={node.id}
                    onPointerDown={(event) => handleNodePointerDown(event, node.id)}
                    sx={{
                      position: "absolute",
                      left: node.x,
                      top: node.y,
                      width: size.width,
                      minHeight: size.height,
                      borderRadius: 2.5,
                      border: pending ? "2px solid #38bdf8" : selected ? "2px solid #2563eb" : `1px solid ${visualState.border}`,
                      bgcolor: visualState.fill,
                      boxShadow: selected ? "0 0 0 4px rgba(37,99,235,0.16)" : pending ? "0 0 0 4px rgba(56,189,248,0.14)" : "0 12px 28px rgba(15,23,42,0.18)",
                      color: visualState.text,
                      px: 1.4,
                      py: 1.1,
                      cursor: toolMode === "pan" ? "grab" : toolMode === "connect" ? "crosshair" : canWrite ? "grab" : "pointer",
                      userSelect: "none",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: node.kind === "cabinet-input" ? 700 : 600, lineHeight: 1.25, color: visualState.text }}>
                      {node.label}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{
                        mt: 0.9,
                        flexWrap: "wrap",
                        "& .MuiChip-root": { color: visualState.text, bgcolor: visualState.chip },
                        "& .MuiChip-label": { color: visualState.text, fontWeight: 600 },
                      }}
                      useFlexGap
                    >
                      <Chip
                        size="small"
                        label={bucket || node.voltage || "?"}
                        sx={{
                          height: 22,
                          bgcolor: visualState.chip,
                          color: visualState.text,
                          "& .MuiChip-label": { color: visualState.text, fontWeight: 600 },
                        }}
                      />
                      {node.kind === "cabinet-input" ? <Chip size="small" label="Источник" sx={{ height: 22 }} /> : null}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Card variant="outlined" ref={inspectorRef}>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Свойства</Typography>
              {selectedEdge ? (
                <Stack spacing={1.5}>
                  <Chip size="small" color="primary" label="Выбрана связь" sx={{ width: "fit-content" }} />
                  <TextField
                    size="small"
                    label={t("pagesUi.digitalTwin.fields.edgeLabel")}
                    value={selectedEdge.label}
                    onChange={(event) => updateDocument((current) => {
                      const edge = current.powerGraph.edges.find((entry) => entry.id === selectedEdge.id);
                      if (edge) edge.label = event.target.value;
                      return current;
                    })}
                  />
                  <TextField
                    size="small"
                    label={t("pagesUi.digitalTwin.fields.edgeVoltage")}
                    value={selectedEdge.voltage || ""}
                    onChange={(event) => updateDocument((current) => {
                      const edge = current.powerGraph.edges.find((entry) => entry.id === selectedEdge.id);
                      if (edge) edge.voltage = event.target.value || null;
                      return current;
                    })}
                  />
                  <TextField size="small" label="Тип связи" value={selectedEdge.role || "feed"} disabled />
                </Stack>
              ) : selectedGraphItem ? (
                <Stack spacing={1.5}>
                  <Chip size="small" color="primary" label="Выбран объект" sx={{ width: "fit-content" }} />
                  <TextField size="small" label={t("pagesUi.digitalTwin.fields.name")} value={itemDisplayName(selectedGraphItem)} disabled />
                  <TextField size="small" label={t("pagesUi.digitalTwin.fields.powerRole")} value={selectedGraphItem.power_role || "-"} disabled />
                  <TextField size="small" label={t("pagesUi.digitalTwin.fields.supplyVoltage")} value={selectedGraphItem.supply_voltage || "-"} disabled />
                  <TextField size="small" label={t("pagesUi.digitalTwin.fields.currentType")} value={selectedGraphItem.current_type || "-"} disabled />
                  <TextField size="small" label="Требуемое питание" value={selectedGraphItemRequiredPower || "-"} disabled />
                  <TextField size="small" label="Питание по графу" value={selectedGraphItemPowered ? "Подведено" : "Не подведено"} disabled />
                  <Typography variant="body2" color="text.secondary">
                    {selectedGraphItem.item_kind === "manual"
                      ? "Manual-объект можно копировать и вставлять через toolbar."
                      : "Объект из состава можно убрать только с графа, не удаляя его из документа."}
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Выберите объект или связь на графе, чтобы открыть свойства.
                  </Typography>
                  <Typography variant="body2">Узлов на графе: {nodes.length}</Typography>
                  <Typography variant="body2">Связей: {edges.length}</Typography>
                  <Typography variant="body2">Не добавлено на граф: {graphAvailableItems.length}</Typography>
                  {pendingConnectNodeId ? <Alert severity="info">Источник связи выбран. Нажмите на второй узел, чтобы создать связь.</Alert> : null}
                </Stack>
              )}
              <Divider />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Предупреждения</Typography>
              <Box sx={{ display: "grid", gap: 1, maxHeight: isFullscreen ? "calc(100vh - 430px)" : 260, overflow: "auto" }}>
                {validationIssues.length
                  ? validationIssues.map((issue) => (
                    <Alert key={issue.id} severity={issue.severity === "error" ? "error" : "warning"}>
                      {issue.title}: {issue.detail}
                    </Alert>
                  ))
                  : <Alert severity="success">{t("pagesUi.digitalTwin.validation.clear")}</Alert>}
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Dialog open={addGraphObjectOpen} onClose={() => setAddGraphObjectOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Добавить объект в граф питания</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 1.5, pt: 2 }}>
            <DialogContentText>
              Выберите оборудование, которое уже есть в документе, но еще не размещено на графе питания.
            </DialogContentText>
            {graphAvailableItems.length ? graphAvailableItems.map((item) => (
              <AppButton key={item.id} variant="outlined" onClick={() => addItemToGraph(item.id)} sx={{ justifyContent: "flex-start" }}>
                {itemDisplayName(item)}
              </AppButton>
            )) : <Alert severity="info">Все объекты документа уже размещены на графе.</Alert>}
          </DialogContent>
          <DialogActions>
            <AppButton variant="outlined" onClick={() => setAddGraphObjectOpen(false)}>{t("actions.cancel")}</AppButton>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
