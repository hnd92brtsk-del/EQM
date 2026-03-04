import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { usePidApi } from "../api/pid";
import { fetchLocationsTree } from "../utils/locations";
import { fetchMainEquipmentTree, type MainEquipmentTreeNode } from "../utils/mainEquipment";
import { getToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { PidDiagram, PidProcess } from "../types/pid";
import { PidEditor } from "../components/pid/PidEditor";
import { PidEquipmentListTab } from "../components/pid/PidEquipmentListTab";
import { PidLocationPanel } from "../components/pid/PidLocationPanel";

type TreeNode = { id: number; name: string; children?: TreeNode[] };

const emptyDiagram = (processId: number): PidDiagram => ({
  processId,
  version: 1,
  updatedAt: new Date().toISOString(),
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
});

export default function TechnologicalEquipmentPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const pidApi = usePidApi();
  const queryClient = useQueryClient();

  const [locationId, setLocationId] = useState<number | "">("");
  const [activeTab, setActiveTab] = useState(0);
  const [processName, setProcessName] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<PidDiagram | null>(null);
  const [autosaveBlocked, setAutosaveBlocked] = useState(false);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedFingerprintRef = useRef<string | null>(null);

  const getDiagramFingerprint = (value: PidDiagram) =>
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
    });

  const locationsQuery = useQuery({ queryKey: ["pid-locations"], queryFn: () => fetchLocationsTree(false) });
  const mainEquipmentQuery = useQuery({
    queryKey: ["pid-main-equipment-tree"],
    queryFn: () => fetchMainEquipmentTree(false),
  });

  const processesQuery = useQuery({
    queryKey: ["pid-processes", locationId],
    queryFn: () => pidApi.fetchProcesses(Number(locationId)),
    enabled: Boolean(locationId),
  });

  const diagramQuery = useQuery({
    queryKey: ["pid-diagram", selectedProcessId],
    queryFn: () => pidApi.fetchDiagram(selectedProcessId!),
    enabled: Boolean(selectedProcessId),
  });

  useEffect(() => {
    if (diagramQuery.data) {
      setDiagram(diagramQuery.data);
      lastSavedFingerprintRef.current = getDiagramFingerprint(diagramQuery.data);
      setAutosaveBlocked(false);
    }
  }, [diagramQuery.data]);

  useEffect(() => {
    setSelectedProcessId(null);
    setDiagram(null);
    setAutosaveBlocked(false);
    lastSavedFingerprintRef.current = null;
  }, [locationId]);

  const createProcessMutation = useMutation({
    mutationFn: () => pidApi.createProcess(Number(locationId), { name: processName.trim() }),
    onSuccess: (created) => {
      setProcessName("");
      setSelectedProcessId(created.id);
      queryClient.invalidateQueries({ queryKey: ["pid-processes", locationId] });
    },
  });

  useEffect(() => {
    if (!diagram || !selectedProcessId || !canWrite || autosaveBlocked || saveInFlightRef.current) return;
    if (!getToken()) {
      setAutosaveBlocked(true);
      return;
    }
    const snapshot = diagram;
    const fingerprint = getDiagramFingerprint(snapshot);
    if (fingerprint === lastSavedFingerprintRef.current) return;
    if (fingerprint === saveQueuedFingerprintRef.current) return;
    saveQueuedFingerprintRef.current = fingerprint;

    const timeout = setTimeout(() => {
      saveInFlightRef.current = true;
      pidApi
        .saveDiagram(snapshot.processId, snapshot)
        .then((saved) => {
          lastSavedFingerprintRef.current = getDiagramFingerprint(saved);
          setAutosaveBlocked(false);
        })
        .catch((error: Error & { status?: number }) => {
          if (error.status === 401) {
            setAutosaveBlocked(true);
          }
        })
        .finally(() => {
          saveInFlightRef.current = false;
          saveQueuedFingerprintRef.current = null;
        });
    }, 900);
    return () => {
      clearTimeout(timeout);
      if (saveQueuedFingerprintRef.current === fingerprint) {
        saveQueuedFingerprintRef.current = null;
      }
    };
  }, [autosaveBlocked, canWrite, diagram, pidApi, selectedProcessId]);

  const activeProcesses = useMemo(
    () => (processesQuery.data || []).filter((item: PidProcess) => !item.is_deleted),
    [processesQuery.data]
  );

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pid.page.title")}</Typography>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gap: 1 }}>
            <Tabs
              value={activeTab}
              onChange={(_, next) => setActiveTab(next)}
              textColor="primary"
              sx={{ "& .MuiTab-root": { color: "text.primary", opacity: 0.9, fontWeight: 700 } }}
            >
              <Tab label={t("pid.tabs.diagram")} />
              <Tab label={t("pid.tabs.equipment")} />
            </Tabs>
            {selectedProcessId && diagram ? (
              activeTab === 0 ? (
                <PidEditor
                  diagram={diagram}
                  readOnly={!canWrite}
                  focusNodeId={focusNodeId}
                  onDiagramChange={setDiagram}
                  locationPanel={
                    <PidLocationPanel
                      canWrite={canWrite}
                      locationId={locationId}
                      locationTree={(locationsQuery.data || []) as TreeNode[]}
                      processName={processName}
                      activeProcesses={activeProcesses}
                      selectedProcessId={selectedProcessId}
                      onLocationChange={setLocationId}
                      onProcessNameChange={setProcessName}
                      onCreateProcess={() => createProcessMutation.mutate()}
                      onSelectProcess={(id) => {
                        setSelectedProcessId(id);
                        setDiagram(emptyDiagram(id));
                      }}
                    />
                  }
                  mainEquipmentTree={(mainEquipmentQuery.data || []) as MainEquipmentTreeNode[]}
                />
              ) : (
                <PidEquipmentListTab
                  nodes={diagram.nodes}
                  onJumpToNode={(nodeId) => {
                    setActiveTab(0);
                    setFocusNodeId(nodeId);
                  }}
                />
              )
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 320px) minmax(0, 1fr)" },
                  gap: 1,
                  minHeight: 320,
                  minWidth: 0,
                }}
              >
                <Box sx={{ minWidth: 0, border: "1px solid", borderColor: "divider" }}>
                  <PidLocationPanel
                    canWrite={canWrite}
                    locationId={locationId}
                    locationTree={(locationsQuery.data || []) as TreeNode[]}
                    processName={processName}
                    activeProcesses={activeProcesses}
                    selectedProcessId={selectedProcessId}
                    onLocationChange={setLocationId}
                    onProcessNameChange={setProcessName}
                    onCreateProcess={() => createProcessMutation.mutate()}
                    onSelectProcess={(id) => {
                      setSelectedProcessId(id);
                      setDiagram(emptyDiagram(id));
                    }}
                  />
                </Box>
                <Box sx={{ p: 2, minWidth: 0, color: "text.secondary" }}>{t("pid.page.selectProcess")}</Box>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
