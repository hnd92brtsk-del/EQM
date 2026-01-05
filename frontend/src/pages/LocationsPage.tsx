import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DictionariesTabs } from "../components/DictionariesTabs";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, updateEntity, restoreEntity, Pagination } from "../api/entities";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Location = {
  id: number;
  name: string;
  parent_id?: number | null;
  is_deleted: boolean;
  created_at?: string;
};

type LocationNode = Location & { children: LocationNode[] };

async function fetchAllLocations(includeDeleted: boolean) {
  const pageSize = 200;
  let page = 1;
  let items: Location[] = [];
  while (true) {
    const data = await apiFetch<Pagination<Location>>(
      `/locations?page=${page}&page_size=${pageSize}&include_deleted=${includeDeleted}`
    );
    items = items.concat(data.items);
    if (items.length >= data.total) {
      break;
    }
    page += 1;
  }
  return items;
}

function buildTree(locations: Location[]): LocationNode[] {
  const nodeMap = new Map<number, LocationNode>();
  locations.forEach((loc) => nodeMap.set(loc.id, { ...loc, children: [] }));
  const roots: LocationNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function sortTree(nodes: LocationNode[]): LocationNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function filterTree(nodes: LocationNode[], query: string): LocationNode[] {
  if (!query.trim()) {
    return nodes;
  }
  const lower = query.toLowerCase();
  const filtered: LocationNode[] = [];
  nodes.forEach((node) => {
    const childMatches = filterTree(node.children, query);
    const matches = node.name.toLowerCase().includes(lower);
    if (matches || childMatches.length > 0) {
      filtered.push({ ...node, children: childMatches });
    }
  });
  return filtered;
}

export default function LocationsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const locationsQuery = useQuery({
    queryKey: ["locations-tree", showDeleted],
    queryFn: () => fetchAllLocations(showDeleted)
  });

  useEffect(() => {
    if (locationsQuery.error) {
      setErrorMessage(
        locationsQuery.error instanceof Error ? locationsQuery.error.message : "Failed to load locations."
      );
    }
  }, [locationsQuery.error]);

  const tree = useMemo(() => sortTree(buildTree(locationsQuery.data || [])), [locationsQuery.data]);
  const filteredTree = useMemo(() => filterTree(tree, q), [tree, q]);
  const locationMap = useMemo(() => {
    const map = new Map<number, Location>();
    (locationsQuery.data || []).forEach((loc) => map.set(loc.id, loc));
    return map;
  }, [locationsQuery.data]);

  const parentOptions = useMemo(() => {
    const options = (locationsQuery.data || []).map((loc) => ({
      label: loc.name,
      value: loc.id
    }));
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [locationsQuery.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["locations-tree"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; parent_id?: number | null }) => createEntity("/locations", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to create location.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Location> }) =>
      updateEntity("/locations", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to update location.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/locations", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete location.")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/locations", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to restore location.")
  });

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateDialog = (parentId?: number | null) => {
    setDialog({
      open: true,
      title: "Create location",
      fields: [
        { name: "name", label: "Name", type: "text" },
        {
          name: "parent_id",
          label: "Parent",
          type: "select",
          options: parentOptions
        }
      ],
      values: { name: "", parent_id: parentId ?? "" },
      onSave: (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        createMutation.mutate({
          name: values.name,
          parent_id: parentValue
        });
        setDialog(null);
      }
    });
  };

  const openEditDialog = (node: LocationNode) => {
    setDialog({
      open: true,
      title: "Edit location",
      fields: [
        { name: "name", label: "Name", type: "text" },
        {
          name: "parent_id",
          label: "Parent",
          type: "select",
          options: parentOptions.filter((option) => option.value !== node.id)
        }
      ],
      values: { name: node.name, parent_id: node.parent_id ?? "" },
      onSave: (values) => {
        const parentValue =
          values.parent_id === "" || values.parent_id === undefined ? null : Number(values.parent_id);
        updateMutation.mutate({
          id: node.id,
          payload: { name: values.name, parent_id: parentValue }
        });
        setDialog(null);
      }
    });
  };

  const buildBreadcrumb = (nodeId: number) => {
    const parts: string[] = [];
    let current = locationMap.get(nodeId);
    while (current && current.parent_id) {
      const parent = locationMap.get(current.parent_id);
      if (!parent) {
        break;
      }
      parts.unshift(parent.name);
      current = parent;
    }
    return parts.join(" / ");
  };

  const renderNode = (node: LocationNode, level: number) => {
    const hasChildren = node.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const forceExpand = q.trim().length > 0;
    const breadcrumb = buildBreadcrumb(node.id);

    return (
      <Box key={node.id} sx={{ display: "grid", gap: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", pl: level * 2, gap: 1 }}>
          {hasChildren ? (
            <IconButton size="small" onClick={() => toggleExpanded(node.id)}>
              {expanded || forceExpand ? <ExpandMoreRoundedIcon /> : <ChevronRightRoundedIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 32 }} />
          )}
          <Box sx={{ display: "grid" }}>
            <Typography sx={{ fontWeight: 500 }}>
              {node.name}
              {node.is_deleted ? " (deleted)" : ""}
            </Typography>
            {breadcrumb ? (
              <Typography variant="body2" color="text.secondary">
                {breadcrumb}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {canWrite && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" onClick={() => openCreateDialog(node.id)}>
                Add child
              </Button>
              <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => openEditDialog(node)}>
                Edit
              </Button>
              <Button
                size="small"
                color={node.is_deleted ? "success" : "error"}
                startIcon={node.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
                onClick={() =>
                  node.is_deleted ? restoreMutation.mutate(node.id) : deleteMutation.mutate(node.id)
                }
              >
                {node.is_deleted ? "Restore" : "Delete"}
              </Button>
            </Box>
          )}
        </Box>
        {hasChildren && (
          <Collapse in={expanded || forceExpand} timeout="auto" unmountOnExit>
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {node.children.map((child) => renderNode(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Locations</Typography>
      <DictionariesTabs />

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <TextField
              label="Search"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
              }}
              fullWidth
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showDeleted}
                  onChange={(event) => {
                    setShowDeleted(event.target.checked);
                    setExpandedIds(new Set());
                  }}
                />
              }
              label="Show deleted"
            />
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreateDialog(null)}>
                Add root
              </Button>
            )}
          </Box>

          <Box sx={{ display: "grid", gap: 1 }}>{filteredTree.map((node) => renderNode(node, 0))}</Box>
        </CardContent>
      </Card>

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
