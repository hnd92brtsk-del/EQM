import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type OnMoveEnd
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery } from "@tanstack/react-query";

import { AppButton } from "../components/ui/AppButton";
import { useAuth } from "../context/AuthContext";
import { listSerialMapEligibleEquipment } from "../features/serialMap/api";
import {
  autoLayoutScheme,
  computeConflicts,
  computeDiagnostics,
  createDefaultProjectDraft,
  createEmptyDataPoolEntry,
  createId,
  createNodeFromEquipment,
  createNodeFromPreset,
  createScheme,
  getProtocolMeta,
  resolveNodeName,
  snapshotOfScheme,
  validateImportedProject,
  withSchemeMutation
} from "../features/serialMap/model";
import { SerialMapNodeRenderer } from "../features/serialMap/SerialMapNodeRenderer";
import { loadSerialMapDraft, saveSerialMapDraft } from "../features/serialMap/storage";
import type {
  SerialMapDiagnostic,
  SerialMapEdge,
  SerialMapNode,
  SerialMapNodeKind,
  SerialMapProjectDraft,
  SerialMapProtocol,
  SerialMapSaveStatus,
  SerialMapScheme
} from "../features/serialMap/types";

const nodeTypes = {
  serialMapNode: SerialMapNodeRenderer
};

const presetKinds: { kind: Exclude<SerialMapNodeKind, "equipment">; label: string }[] = [
  { kind: "master", label: "+ Мастер / ПЛК" },
  { kind: "slave", label: "+ RTU Slave" },
  { kind: "sensor", label: "+ Датчик / I/O" },
  { kind: "bus", label: "+ Сегмент шины" },
  { kind: "repeater", label: "+ Репитер / Хаб" },
  { kind: "gateway", label: "+ Шлюз" }
];

const defaultViewport = { x: 0, y: 0, zoom: 1 };

function toRfNode(node: SerialMapNode, hasConflict: boolean, title: string): Node {
  return {
    id: node.id,
    type: "serialMapNode",
    position: node.position,
    data: {
      kind: node.kind,
      title,
      subtitle: node.sourceRef ? `${node.sourceRef.source}:${node.sourceRef.equipmentInOperationId}` : node.note || "Ручной узел",
      protocol: node.protocol,
      address: node.address,
      serialPorts: node.serialPorts.map((port) => `${port.type}-${port.count}`).join(", "),
      hasConflict
    }
  };
}

function toRfEdge(edge: SerialMapEdge): Edge {
  return {
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId,
    label: edge.label,
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      protocol: edge.protocol,
      baudRate: edge.baudRate
    }
  };
}

function fromRfEdges(edges: Edge[], activeScheme: SerialMapScheme): SerialMapEdge[] {
  return edges.map((edge) => {
    const existing = activeScheme.edges.find((item) => item.id === edge.id);
    return {
      id: edge.id,
      fromNodeId: edge.source,
      toNodeId: edge.target,
      protocol: (existing?.protocol || "Modbus RTU") as SerialMapProtocol,
      baudRate: existing?.baudRate || 9600,
      label: typeof edge.label === "string" ? edge.label : "",
      meta: existing?.meta || {}
    };
  });
}

function getActiveScheme(project: SerialMapProjectDraft) {
  return project.schemes.find((scheme) => scheme.id === project.activeSchemeId) || project.schemes[0];
}

function replaceActiveScheme(project: SerialMapProjectDraft, nextScheme: SerialMapScheme): SerialMapProjectDraft {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    schemes: project.schemes.map((scheme) => (scheme.id === nextScheme.id ? nextScheme : scheme))
  };
}

function cloneScheme(scheme: SerialMapScheme): SerialMapScheme {
  return {
    ...structuredClone(scheme),
    id: createId("scheme"),
    name: `${scheme.name} - копия`,
    history: {
      past: [],
      future: []
    }
  };
}

export default function SerialMapPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const readOnly = !canWrite;
  const [project, setProject] = useState<SerialMapProjectDraft>(() => loadSerialMapDraft() || createDefaultProjectDraft());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState<SerialMapSaveStatus>("saved");
  const [diagnostics, setDiagnostics] = useState<SerialMapDiagnostic[]>([]);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [rightTab, setRightTab] = useState<"props" | "data">("props");
  const [importDialog, setImportDialog] = useState<{ open: boolean; diagnostics: SerialMapDiagnostic[] }>({
    open: false,
    diagnostics: []
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const flowRef = useRef<any>(null);

  const equipmentQuery = useQuery({
    queryKey: ["serial-map-eligible-equipment"],
    queryFn: listSerialMapEligibleEquipment
  });

  const equipmentMap = useMemo(
    () => new Map((equipmentQuery.data || []).map((item) => [item.key, item])),
    [equipmentQuery.data]
  );

  const activeScheme = getActiveScheme(project);
  const allConflicts = useMemo(() => computeConflicts(project), [project]);
  const activeConflicts = useMemo(
    () => allConflicts.filter((item) => item.schemeId === activeScheme.id),
    [activeScheme.id, allConflicts]
  );

  useEffect(() => {
    setDiagnostics(computeDiagnostics(activeScheme));
  }, [activeScheme]);

  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        saveSerialMapDraft(project);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [project]);

  const rfNodes = useMemo(
    () =>
      activeScheme.nodes.map((node) =>
        toRfNode(node, activeConflicts.some((item) => item.nodeIds.includes(node.id)), resolveNodeName(node, equipmentMap))
      ),
    [activeConflicts, activeScheme.nodes, equipmentMap]
  );
  const rfEdges = useMemo(() => activeScheme.edges.map(toRfEdge), [activeScheme.edges]);

  const selectedNode = activeScheme.nodes.find((item) => item.id === selectedNodeId) || null;
  const selectedEdge = activeScheme.edges.find((item) => item.id === selectedEdgeId) || null;

  const updateActiveScheme = (mutate: (scheme: SerialMapScheme) => SerialMapScheme) => {
    setProject((current) => withSchemeMutation(current, getActiveScheme(current).id, mutate));
  };

  const focusNode = (nodeId: string) => {
    const node = activeScheme.nodes.find((item) => item.id === nodeId);
    if (!node || !flowRef.current) {
      return;
    }
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    flowRef.current.setCenter(node.position.x, node.position.y, { zoom: 1.2, duration: 220 });
  };

  const toolbarSaveLabel =
    saveStatus === "saved" ? "Сохранено" : saveStatus === "saving" ? "Сохранение..." : "Ошибка сохранения";

  const protocolMeta = selectedNode ? getProtocolMeta(selectedNode.protocol) : null;
  const schemeNodesFiltered = activeScheme.nodes.filter((node) =>
    resolveNodeName(node, equipmentMap).toLowerCase().includes(nodeSearch.toLowerCase())
  );
  const eligibleEquipmentFiltered = (equipmentQuery.data || []).filter((item) =>
    [item.displayName, item.manufacturerName || "", item.locationFullPath || ""].join(" ").toLowerCase().includes(equipmentSearch.toLowerCase())
  );

  const addEquipmentNode = (equipmentKey: string) => {
    const item = equipmentMap.get(equipmentKey);
    if (!item || readOnly) {
      return;
    }
    updateActiveScheme((scheme) => ({
      ...scheme,
      nodes: [
        ...scheme.nodes,
        createNodeFromEquipment(item, {
          x: 120 + scheme.nodes.length * 24,
          y: 120 + scheme.nodes.length * 24
        })
      ]
    }));
  };

  const addPresetNode = (kind: Exclude<SerialMapNodeKind, "equipment">) => {
    if (readOnly) {
      return;
    }
    updateActiveScheme((scheme) => ({
      ...scheme,
      nodes: [...scheme.nodes, createNodeFromPreset(kind, { x: 180, y: 180 + scheme.nodes.length * 18 }, scheme.nodes.length + 1)]
    }));
  };

  const createEdgeFromConnection = (connection: Connection) => {
    const sourceNode = activeScheme.nodes.find((item) => item.id === connection.source);
    const protocol = sourceNode?.protocol || "Modbus RTU";
    const baudRate = sourceNode?.baudRate || 9600;
    return {
      id: createId("edge"),
      source: connection.source || "",
      target: connection.target || "",
      label: "",
      data: { protocol, baudRate }
    } as Edge;
  };

  const handleUndo = () => {
    const scheme = activeScheme;
    if (scheme.history.past.length === 0) {
      return;
    }
    const previous = scheme.history.past[scheme.history.past.length - 1];
    const currentSnapshot = snapshotOfScheme(scheme);
    const nextScheme: SerialMapScheme = {
      ...scheme,
      nodes: previous.nodes,
      edges: previous.edges,
      viewport: previous.viewport,
      history: {
        past: scheme.history.past.slice(0, -1),
        future: [currentSnapshot, ...scheme.history.future].slice(0, 100)
      }
    };
    setProject((current) => replaceActiveScheme(current, nextScheme));
  };

  const handleRedo = () => {
    const scheme = activeScheme;
    if (scheme.history.future.length === 0) {
      return;
    }
    const [nextSnapshot, ...restFuture] = scheme.history.future;
    const currentSnapshot = snapshotOfScheme(scheme);
    const nextScheme: SerialMapScheme = {
      ...scheme,
      nodes: nextSnapshot.nodes,
      edges: nextSnapshot.edges,
      viewport: nextSnapshot.viewport,
      history: {
        past: [...scheme.history.past, currentSnapshot].slice(-100),
        future: restFuture
      }
    };
    setProject((current) => replaceActiveScheme(current, nextScheme));
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "serial-map-project.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (file: File) => {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setImportDialog({
        open: true,
        diagnostics: [{ level: "error", message: "Файл не является валидным JSON." }]
      });
      return;
    }
    const result = validateImportedProject(parsed);
    setImportDialog({ open: true, diagnostics: result.diagnostics });
    if (result.project) {
      setProject(result.project);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  const deleteSelected = () => {
    if (readOnly) {
      return;
    }
    if (selectedNode) {
      updateActiveScheme((scheme) => ({
        ...scheme,
        nodes: scheme.nodes.filter((item) => item.id !== selectedNode.id),
        edges: scheme.edges.filter((item) => item.fromNodeId !== selectedNode.id && item.toNodeId !== selectedNode.id)
      }));
      setSelectedNodeId(null);
    } else if (selectedEdge) {
      updateActiveScheme((scheme) => ({
        ...scheme,
        edges: scheme.edges.filter((item) => item.id !== selectedEdge.id)
      }));
      setSelectedEdgeId(null);
    }
  };

  const updateSelectedNode = (patch: Partial<SerialMapNode>) => {
    if (!selectedNode) {
      return;
    }
    updateActiveScheme((scheme) => ({
      ...scheme,
      nodes: scheme.nodes.map((node) => (node.id === selectedNode.id ? { ...node, ...patch } : node))
    }));
  };

  const updateSelectedEdge = (patch: Partial<SerialMapEdge>) => {
    if (!selectedEdge) {
      return;
    }
    updateActiveScheme((scheme) => ({
      ...scheme,
      edges: scheme.edges.map((edge) => (edge.id === selectedEdge.id ? { ...edge, ...patch } : edge))
    }));
  };

  const updateDataPoolEntry = (entryId: string, patch: Partial<SerialMapNode["dataPool"][number]>) => {
    if (!selectedNode) {
      return;
    }
    updateActiveScheme((scheme) => ({
      ...scheme,
      nodes: scheme.nodes.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              dataPool: node.dataPool.map((item) => (item.id === entryId ? { ...item, ...patch } : item))
            }
          : node
      )
    }));
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Карта сети последовательных протоколов</Typography>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Контур</InputLabel>
              <Select
                label="Контур"
                value={activeScheme.id}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    activeSchemeId: String(event.target.value),
                    updatedAt: new Date().toISOString()
                  }))
                }
              >
                {project.schemes.map((scheme) => (
                  <MenuItem key={scheme.id} value={scheme.id}>
                    {scheme.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Назад">
              <span>
                <IconButton onClick={handleUndo} disabled={activeScheme.history.past.length === 0}>
                  <UndoRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Вперёд">
              <span>
                <IconButton onClick={handleRedo} disabled={activeScheme.history.future.length === 0}>
                  <RedoRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Авторасстановка">
              <span>
                <IconButton onClick={() => updateActiveScheme((scheme) => autoLayoutScheme(scheme))} disabled={readOnly || activeScheme.nodes.length === 0}>
                  <AutoFixHighRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Сбросить вид">
              <span>
                <IconButton
                  onClick={() => {
                    flowRef.current?.setViewport(defaultViewport, { duration: 180 });
                    updateActiveScheme((scheme) => ({ ...scheme, viewport: defaultViewport }));
                  }}
                >
                  <RestartAltRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Экспорт JSON">
              <span>
                <IconButton onClick={exportProject}>
                  <DownloadRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Импорт JSON">
              <span>
                <IconButton onClick={() => fileInputRef.current?.click()}>
                  <UploadRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color={saveStatus === "error" ? "error.main" : saveStatus === "saving" ? "warning.main" : "success.main"}>
              {toolbarSaveLabel}
            </Typography>
            <AppButton
              variant={activeConflicts.length > 0 ? "contained" : "outlined"}
              color={activeConflicts.length > 0 ? "error" : "inherit"}
              startIcon={<ErrorOutlineRoundedIcon />}
              onClick={() => setConflictDialogOpen(true)}
            >
              {activeConflicts.length} конфл.
            </AppButton>
          </Box>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr) 340px" },
              alignItems: "start"
            }}
          >
            <Card variant="outlined">
              <CardContent sx={{ display: "grid", gap: 2 }}>
                <Box sx={{ display: "grid", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Схемы / Контуры
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <AppButton
                      size="small"
                      startIcon={<AddRoundedIcon />}
                      onClick={() => {
                        const nextScheme = createScheme(`Контур ${project.schemes.length + 1}`);
                        setProject((current) => ({
                          ...current,
                          updatedAt: new Date().toISOString(),
                          activeSchemeId: nextScheme.id,
                          schemes: [...current.schemes, nextScheme]
                        }));
                      }}
                      disabled={readOnly}
                    >
                      Новый
                    </AppButton>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setProject((current) => {
                          const source = getActiveScheme(current);
                          const duplicate = cloneScheme(source);
                          return {
                            ...current,
                            updatedAt: new Date().toISOString(),
                            activeSchemeId: duplicate.id,
                            schemes: [...current.schemes, duplicate]
                          };
                        })
                      }
                      disabled={readOnly}
                    >
                      <ContentCopyRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setProject((current) => {
                          if (current.schemes.length <= 1) {
                            return current;
                          }
                          const nextSchemes = current.schemes.filter((scheme) => scheme.id !== current.activeSchemeId);
                          return {
                            ...current,
                            updatedAt: new Date().toISOString(),
                            activeSchemeId: nextSchemes[0].id,
                            schemes: nextSchemes
                          };
                        })
                      }
                      disabled={readOnly || project.schemes.length <= 1}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <List dense disablePadding>
                    {project.schemes.map((scheme) => (
                      <ListItemButton
                        key={scheme.id}
                        selected={scheme.id === activeScheme.id}
                        onClick={() => setProject((current) => ({ ...current, activeSchemeId: scheme.id }))}
                      >
                        <ListItemText
                          primary={scheme.name}
                          secondary={`${scheme.nodes.length} узл. / ${scheme.edges.length} связ.`}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>

                <Divider />

                <Box sx={{ display: "grid", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Добавить узел
                  </Typography>
                  {presetKinds.map((preset) => (
                    <AppButton key={preset.kind} variant="outlined" onClick={() => addPresetNode(preset.kind)} disabled={readOnly}>
                      {preset.label}
                    </AppButton>
                  ))}
                </Box>

                <Divider />

                <Box sx={{ display: "grid", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Оборудование в эксплуатации
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="Поиск оборудования"
                    value={equipmentSearch}
                    onChange={(event) => setEquipmentSearch(event.target.value)}
                  />
                  <List dense disablePadding sx={{ maxHeight: 260, overflowY: "auto" }}>
                    {eligibleEquipmentFiltered.map((item) => (
                      <ListItemButton key={item.key} onClick={() => addEquipmentNode(item.key)} disabled={readOnly}>
                        <ListItemText
                          primary={item.displayName}
                          secondary={[item.manufacturerName, item.locationFullPath].filter(Boolean).join(" • ")}
                        />
                      </ListItemButton>
                    ))}
                    {eligibleEquipmentFiltered.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {equipmentQuery.isLoading ? "Загрузка..." : "Нет доступного оборудования"}
                      </Typography>
                    ) : null}
                  </List>
                </Box>

                <Divider />

                <Box sx={{ display: "grid", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Узлы
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="Поиск узлов"
                    value={nodeSearch}
                    onChange={(event) => setNodeSearch(event.target.value)}
                  />
                  <List dense disablePadding sx={{ maxHeight: 260, overflowY: "auto" }}>
                    {schemeNodesFiltered.map((node) => (
                      <ListItemButton key={node.id} selected={node.id === selectedNodeId} onClick={() => focusNode(node.id)}>
                        <ListItemText primary={resolveNodeName(node, equipmentMap)} secondary={`${node.kind} • ${node.protocol}`} />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent sx={{ p: 0, height: 780 }}>
                <ReactFlow
                  nodes={rfNodes}
                  edges={rfEdges}
                  nodeTypes={nodeTypes}
                  fitView={false}
                  defaultViewport={activeScheme.viewport}
                  onInit={(instance) => {
                    flowRef.current = instance;
                    instance.setViewport(activeScheme.viewport);
                  }}
                  onNodesChange={(changes) => {
                    if (readOnly) {
                      return;
                    }
                    updateActiveScheme((scheme) => {
                      const nextRfNodes = applyNodeChanges(changes, scheme.nodes.map((node) => toRfNode(node, false, node.name)));
                      const nextNodes = nextRfNodes.map((rfNode) => {
                        const source = scheme.nodes.find((item) => item.id === rfNode.id)!;
                        return {
                          ...source,
                          position: rfNode.position
                        };
                      });
                      return {
                        ...scheme,
                        nodes: nextNodes
                      };
                    });
                  }}
                  onEdgesChange={(changes) => {
                    if (readOnly) {
                      return;
                    }
                    updateActiveScheme((scheme) => {
                      const nextRf = applyEdgeChanges(changes, scheme.edges.map(toRfEdge));
                      return {
                        ...scheme,
                        edges: fromRfEdges(nextRf, scheme)
                      };
                    });
                  }}
                  onNodeClick={((_event, node) => {
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }) as NodeMouseHandler}
                  onEdgeClick={((_event, edge) => {
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                  }) as EdgeMouseHandler}
                  onPaneClick={() => {
                    setSelectedEdgeId(null);
                    setSelectedNodeId(null);
                  }}
                  onConnect={(connection) => {
                    if (readOnly || !connection.source || !connection.target) {
                      return;
                    }
                    updateActiveScheme((scheme) => {
                      const next = addEdge(createEdgeFromConnection(connection), scheme.edges.map(toRfEdge));
                      return {
                        ...scheme,
                        edges: fromRfEdges(next, scheme)
                      };
                    });
                  }}
                  onMoveEnd={((_event, viewport) => {
                    updateActiveScheme((scheme) => ({
                      ...scheme,
                      viewport
                    }));
                  }) as OnMoveEnd}
                  nodesDraggable={!readOnly}
                  nodesConnectable={!readOnly}
                  elementsSelectable
                  deleteKeyCode={null}
                >
                  <Background />
                  <Controls />
                </ReactFlow>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent sx={{ display: "grid", gap: 1 }}>
                <Tabs value={rightTab} onChange={(_, value) => setRightTab(value)} variant="fullWidth">
                  <Tab value="props" label="Свойства" />
                  <Tab value="data" label="Пул данных" disabled={!selectedNode} />
                </Tabs>

                {rightTab === "props" ? (
                  selectedNode ? (
                    <Box sx={{ display: "grid", gap: 1.25 }}>
                      <TextField
                        label="Наименование"
                        size="small"
                        value={selectedNode.sourceRef ? resolveNodeName(selectedNode, equipmentMap) : selectedNode.name}
                        disabled={readOnly || Boolean(selectedNode.sourceRef)}
                        onChange={(event) => updateSelectedNode({ name: event.target.value })}
                      />
                      <FormControl size="small">
                        <InputLabel>Тип узла</InputLabel>
                        <Select
                          label="Тип узла"
                          value={selectedNode.kind}
                          disabled={readOnly}
                          onChange={(event) => updateSelectedNode({ kind: event.target.value as SerialMapNodeKind })}
                        >
                          {["master", "slave", "sensor", "bus", "repeater", "gateway", "equipment"].map((kind) => (
                            <MenuItem key={kind} value={kind}>
                              {kind}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small">
                        <InputLabel>Протокол</InputLabel>
                        <Select
                          label="Протокол"
                          value={selectedNode.protocol}
                          disabled={readOnly}
                          onChange={(event) =>
                            updateSelectedNode({
                              protocol: event.target.value as SerialMapProtocol,
                              baudRate: getProtocolMeta(event.target.value as SerialMapProtocol).baudRates[0]
                            })
                          }
                        >
                          {["Modbus RTU", "Profibus DP", "CAN Bus", "RS-485", "RS-232", "Custom"].map((protocol) => (
                            <MenuItem key={protocol} value={protocol}>
                              {protocol}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small">
                        <InputLabel>Скорость</InputLabel>
                        <Select
                          label="Скорость"
                          value={selectedNode.baudRate}
                          disabled={readOnly}
                          onChange={(event) => updateSelectedNode({ baudRate: Number(event.target.value) })}
                        >
                          {getProtocolMeta(selectedNode.protocol).baudRates.map((baud) => (
                            <MenuItem key={baud} value={baud}>
                              {baud}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                        <TextField
                          label="Адрес"
                          size="small"
                          type="number"
                          value={selectedNode.address ?? ""}
                          disabled={readOnly || selectedNode.kind === "bus" || selectedNode.kind === "repeater"}
                          onChange={(event) =>
                            updateSelectedNode({
                              address: event.target.value === "" ? null : Number(event.target.value)
                            })
                          }
                        />
                        <TextField
                          label="Сегмент"
                          size="small"
                          type="number"
                          value={selectedNode.segment}
                          disabled={readOnly}
                          onChange={(event) => updateSelectedNode({ segment: Number(event.target.value) || 1 })}
                        />
                      </Box>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
                        <TextField
                          label="Parity"
                          size="small"
                          value={selectedNode.parity}
                          disabled={readOnly}
                          onChange={(event) => updateSelectedNode({ parity: event.target.value as SerialMapNode["parity"] })}
                        />
                        <TextField
                          label="Data bits"
                          size="small"
                          type="number"
                          value={selectedNode.dataBits}
                          disabled={readOnly}
                          onChange={(event) => updateSelectedNode({ dataBits: Number(event.target.value) || 8 })}
                        />
                        <TextField
                          label="Stop bits"
                          size="small"
                          type="number"
                          value={selectedNode.stopBits}
                          disabled={readOnly}
                          onChange={(event) => updateSelectedNode({ stopBits: Number(event.target.value) || 1 })}
                        />
                      </Box>
                      <TextField
                        label="Заметка"
                        size="small"
                        multiline
                        minRows={3}
                        value={selectedNode.note}
                        disabled={readOnly}
                        onChange={(event) => updateSelectedNode({ note: event.target.value })}
                      />
                      {selectedNode.sourceRef ? (
                        <Alert severity="info">
                          Узел связан с оборудованием {selectedNode.sourceRef.source}:{selectedNode.sourceRef.equipmentInOperationId}. Паспортные поля подтягиваются из эксплуатации.
                        </Alert>
                      ) : null}
                    </Box>
                  ) : selectedEdge ? (
                    <Box sx={{ display: "grid", gap: 1.25 }}>
                      <TextField
                        label="Подпись связи"
                        size="small"
                        value={selectedEdge.label}
                        disabled={readOnly}
                        onChange={(event) => updateSelectedEdge({ label: event.target.value })}
                      />
                      <FormControl size="small">
                        <InputLabel>Протокол</InputLabel>
                        <Select
                          label="Протокол"
                          value={selectedEdge.protocol}
                          disabled={readOnly}
                          onChange={(event) => updateSelectedEdge({ protocol: event.target.value as SerialMapProtocol })}
                        >
                          {["Modbus RTU", "Profibus DP", "CAN Bus", "RS-485", "RS-232", "Custom"].map((protocol) => (
                            <MenuItem key={protocol} value={protocol}>
                              {protocol}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        label="Скорость"
                        size="small"
                        type="number"
                        value={selectedEdge.baudRate}
                        disabled={readOnly}
                        onChange={(event) => updateSelectedEdge({ baudRate: Number(event.target.value) || selectedEdge.baudRate })}
                      />
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Выберите узел или связь.
                    </Typography>
                  )
                ) : selectedNode ? (
                  <Box sx={{ display: "grid", gap: 1.25 }}>
                    <AppButton
                      variant="outlined"
                      onClick={() => updateSelectedNode({ dataPool: [...selectedNode.dataPool, { ...createEmptyDataPoolEntry(selectedNode.protocol), sortOrder: selectedNode.dataPool.length }] })}
                      disabled={readOnly}
                    >
                      Добавить запись
                    </AppButton>
                    {selectedNode.dataPool.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Пул данных пуст.
                      </Typography>
                    ) : null}
                    {selectedNode.dataPool.map((entry) => (
                      <Card key={entry.id} variant="outlined">
                        <CardContent sx={{ display: "grid", gap: 1 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                            <Typography variant="subtitle2">{entry.name || "Новая запись"}</Typography>
                            <IconButton
                              size="small"
                              onClick={() => updateSelectedNode({ dataPool: selectedNode.dataPool.filter((item) => item.id !== entry.id) })}
                              disabled={readOnly}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            <TextField label="Имя" size="small" value={entry.name} disabled={readOnly} onChange={(event) => updateDataPoolEntry(entry.id, { name: event.target.value })} />
                            <TextField label="Адрес" size="small" value={entry.address} disabled={readOnly} onChange={(event) => updateDataPoolEntry(entry.id, { address: event.target.value })} />
                          </Box>
                          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            <FormControl size="small">
                              <InputLabel>Тип регистра</InputLabel>
                              <Select label="Тип регистра" value={entry.registerType} disabled={readOnly} onChange={(event) => updateDataPoolEntry(entry.id, { registerType: String(event.target.value) })}>
                                {(protocolMeta?.registerTypes || []).map((item) => (
                                  <MenuItem key={item} value={item}>
                                    {item}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl size="small">
                              <InputLabel>Тип данных</InputLabel>
                              <Select label="Тип данных" value={entry.dataType} disabled={readOnly} onChange={(event) => updateDataPoolEntry(entry.id, { dataType: String(event.target.value) })}>
                                {(protocolMeta?.dataTypes || []).map((item) => (
                                  <MenuItem key={item} value={item}>
                                    {item}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Выберите узел, чтобы редактировать пул данных.
                  </Typography>
                )}

                <Divider />
                <AppButton color="error" variant="outlined" onClick={deleteSelected} disabled={readOnly || (!selectedNode && !selectedEdge)}>
                  Удалить выбранное
                </AppButton>

                {diagnostics.length > 0 ? (
                  <Box sx={{ display: "grid", gap: 1 }}>
                    <Typography variant="subtitle2">Диагностика</Typography>
                    {diagnostics.slice(0, 6).map((item, index) => (
                      <Alert key={`${item.message}-${index}`} severity={item.level}>
                        {item.message}
                      </Alert>
                    ))}
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={conflictDialogOpen} onClose={() => setConflictDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Таблица конфликтов адресов</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 1.5 }}>
          {activeConflicts.length === 0 ? (
            <Alert severity="success">Конфликты адресов не обнаружены.</Alert>
          ) : (
            activeConflicts.map((conflict) => (
              <Card key={`${conflict.protocol}-${conflict.address}`} variant="outlined">
                <CardContent sx={{ display: "grid", gap: 1 }}>
                  <Typography variant="subtitle2">
                    {conflict.protocol} / адрес #{conflict.address}
                  </Typography>
                  {conflict.nodes.map((node) => (
                    <Box key={node.id} sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                      <Typography variant="body2">{node.name}</Typography>
                      <AppButton size="small" variant="outlined" onClick={() => {
                        setConflictDialogOpen(false);
                        focusNode(node.id);
                      }}>
                        Перейти
                      </AppButton>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <AppButton onClick={() => setConflictDialogOpen(false)}>Закрыть</AppButton>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialog.open} onClose={() => setImportDialog({ open: false, diagnostics: [] })} maxWidth="sm" fullWidth>
        <DialogTitle>Результат импорта</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 1.25 }}>
          {importDialog.diagnostics.length === 0 ? (
            <Alert severity="success">Импорт выполнен без замечаний.</Alert>
          ) : (
            importDialog.diagnostics.map((item, index) => (
              <Alert key={`${item.message}-${index}`} severity={item.level}>
                {item.message}
              </Alert>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <AppButton onClick={() => setImportDialog({ open: false, diagnostics: [] })}>Закрыть</AppButton>
        </DialogActions>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importProject(file);
          }
          event.target.value = "";
        }}
      />
    </Box>
  );
}
