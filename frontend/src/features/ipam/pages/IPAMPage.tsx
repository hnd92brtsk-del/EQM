import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BookmarkAddedRoundedIcon from "@mui/icons-material/BookmarkAddedRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ErrorSnackbar } from "../../../components/ErrorSnackbar";
import { AppButton } from "../../../components/ui/AppButton";
import { SearchableSelectField } from "../../../components/SearchableSelectField";
import { useAuth } from "../../../context/AuthContext";
import { buildLocationLookups, fetchLocationsTree } from "../../../utils/locations";
import {
  assignAddress,
  createSubnet,
  createVlan,
  deleteSubnet,
  deleteVlan,
  exportSubnetCsv,
  getAddressDetails,
  getSubnetAddresses,
  listEligibleEquipment,
  listSubnets,
  listVlans,
  patchAddress,
  releaseAddress,
  reserveAddress,
  updateSubnet,
  updateVlan
} from "../api/ipam";
import type { EligibleEquipment, IPAddressDetails, Subnet, Vlan } from "../types";

type StatusFilter = "all" | "free" | "used" | "reserved";
type ViewMode = "grid" | "list" | "heatmap";

const tones: Record<string, { bg: string; fg: string }> = {
  free: { bg: "#cfe5a8", fg: "#21311b" },
  used: { bg: "#ef9ca1", fg: "#3a1619" },
  reserved: { bg: "#f3cf8c", fg: "#37280f" },
  gateway: { bg: "#9ac4ff", fg: "#0a2241" },
  network: { bg: "#bfbfbf", fg: "#1d1d1d" },
  broadcast: { bg: "#e4d8cb", fg: "#31231b" }
};

const darkCardSx = {
  bgcolor: "#2c2b28",
  color: "#f6f1e9",
  borderRadius: 3,
  border: "1px solid rgba(255,255,255,0.08)"
};

const darkInputSx = {
  "& .MuiInputBase-root": {
    color: "#fff",
    bgcolor: "rgba(255,255,255,0.04)",
    borderRadius: 2
  }
};

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)", minWidth: 84 }}>
      <Typography variant="h6" sx={{ color, fontWeight: 800, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase" }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function IPAMPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const canOperate = user?.role === "admin" || user?.role === "engineer";
  const canAdmin = user?.role === "admin";
  const [q, setQ] = useState(params.get("ip") || "");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [mode, setMode] = useState<ViewMode>("grid");
  const [groupByVlan, setGroupByVlan] = useState(true);
  const [selectedSubnetId, setSelectedSubnetId] = useState<number | null>(
    Number(params.get("subnet_id") || 0) || null
  );
  const [selectedOffset, setSelectedOffset] = useState<number | null>(
    params.get("offset") ? Number(params.get("offset")) : null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vlanOpen, setVlanOpen] = useState(false);
  const [subnetOpen, setSubnetOpen] = useState(false);
  const [editingVlan, setEditingVlan] = useState<Vlan | null>(null);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [vlanForm, setVlanForm] = useState({
    vlan_number: "",
    name: "",
    purpose: "",
    description: "",
    location_id: "",
    is_active: true
  });
  const [subnetForm, setSubnetForm] = useState({
    vlan_id: "",
    cidr: "",
    gateway_ip: "",
    name: "",
    description: "",
    location_id: "",
    vrf: "",
    is_active: true
  });
  const [addressForm, setAddressForm] = useState({
    hostname: "",
    dns_name: "",
    mac_address: "",
    comment: "",
    equipmentQuery: "",
    equipment_instance_id: "" as number | "",
    equipment_interface_id: "" as number | "",
    is_primary: true
  });

  const locationsQuery = useQuery({
    queryKey: ["ipam-locations"],
    queryFn: () => fetchLocationsTree(false)
  });
  const { options: locationOptions, breadcrumbMap } = useMemo(
    () => buildLocationLookups(locationsQuery.data || []),
    [locationsQuery.data]
  );
  const vlansQuery = useQuery({
    queryKey: ["ipam-vlans"],
    queryFn: () => listVlans({ page: 1, page_size: 200, sort: "vlan_number" })
  });
  const subnetsQuery = useQuery({
    queryKey: ["ipam-subnets", q],
    queryFn: () => listSubnets({ page: 1, page_size: 300, q: q || undefined, sort: "cidr" })
  });

  const vlans = vlansQuery.data?.items || [];
  const subnets = subnetsQuery.data?.items || [];
  const selectedSubnet = useMemo(
    () => subnets.find((x) => x.id === selectedSubnetId) || subnets[0] || null,
    [subnets, selectedSubnetId]
  );

  useEffect(() => {
    if (!selectedSubnetId && subnets[0]) {
      setSelectedSubnetId(subnets[0].id);
    }
  }, [selectedSubnetId, subnets]);

  const effectiveMode: ViewMode =
    selectedSubnet?.prefix === 16 ? (mode === "list" ? "list" : "heatmap") : mode;

  const addressesQuery = useQuery({
    queryKey: ["ipam-addresses", selectedSubnet?.id, q, status, effectiveMode],
    enabled: Boolean(selectedSubnet?.id),
    queryFn: () =>
      getSubnetAddresses(selectedSubnet!.id, {
        q: q || undefined,
        status: status === "all" ? undefined : status,
        mode: effectiveMode,
        include_service: true,
        page: 1,
        page_size: 512
      })
  });
  const addressQuery = useQuery({
    queryKey: ["ipam-address", selectedSubnet?.id, selectedOffset],
    enabled: Boolean(selectedSubnet?.id && selectedOffset !== null),
    queryFn: () => getAddressDetails(selectedSubnet!.id, selectedOffset as number)
  });
  const eligibleQuery = useQuery({
    queryKey: ["ipam-eligible", addressForm.equipmentQuery],
    enabled: addressForm.equipmentQuery.trim().length >= 2,
    queryFn: () => listEligibleEquipment({ q: addressForm.equipmentQuery.trim() })
  });
  const selectedEquipment = useMemo(
    () =>
      (eligibleQuery.data || []).find(
        (x: EligibleEquipment) => x.equipment_instance_id === addressForm.equipment_instance_id
      ) || null,
    [eligibleQuery.data, addressForm.equipment_instance_id]
  );

  useEffect(() => {
    const item = addressQuery.data;
    if (!item) {
      return;
    }
    setAddressForm({
      hostname: item.hostname || "",
      dns_name: item.dns_name || "",
      mac_address: item.mac_address || "",
      comment: item.comment || "",
      equipmentQuery: "",
      equipment_instance_id: item.equipment_instance_id || "",
      equipment_interface_id: item.equipment_interface_id || "",
      is_primary: item.is_primary ?? true
    });
  }, [addressQuery.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ipam-vlans"] });
    qc.invalidateQueries({ queryKey: ["ipam-subnets"] });
    qc.invalidateQueries({ queryKey: ["ipam-addresses"] });
    qc.invalidateQueries({ queryKey: ["ipam-address"] });
    qc.invalidateQueries({ queryKey: ["cabinet-item-ipam-summary"] });
  };

  const onError = (e: unknown) =>
    setErrorMessage(e instanceof Error ? e.message : t("errors.saveFailed"));

  const saveVlanMutation = useMutation({
    mutationFn: () => {
      const payload = {
        vlan_number: Number(vlanForm.vlan_number),
        name: vlanForm.name.trim(),
        purpose: vlanForm.purpose || null,
        description: vlanForm.description || null,
        location_id: vlanForm.location_id ? Number(vlanForm.location_id) : null,
        is_active: vlanForm.is_active
      };
      return editingVlan ? updateVlan(editingVlan.id, payload) : createVlan(payload);
    },
    onSuccess: () => {
      refresh();
      setVlanOpen(false);
      setEditingVlan(null);
      setVlanForm({
        vlan_number: "",
        name: "",
        purpose: "",
        description: "",
        location_id: "",
        is_active: true
      });
    },
    onError
  });

  const saveSubnetMutation = useMutation({
    mutationFn: () => {
      const payload = {
        vlan_id: subnetForm.vlan_id ? Number(subnetForm.vlan_id) : null,
        cidr: subnetForm.cidr.trim(),
        gateway_ip: subnetForm.gateway_ip || null,
        name: subnetForm.name || null,
        description: subnetForm.description || null,
        location_id: subnetForm.location_id ? Number(subnetForm.location_id) : null,
        vrf: subnetForm.vrf || null,
        is_active: subnetForm.is_active
      };
      return editingSubnet
        ? updateSubnet(editingSubnet.id, {
            vlan_id: payload.vlan_id,
            gateway_ip: payload.gateway_ip,
            name: payload.name,
            description: payload.description,
            location_id: payload.location_id,
            vrf: payload.vrf,
            is_active: payload.is_active
          })
        : createSubnet(payload);
    },
    onSuccess: (saved) => {
      refresh();
      setSubnetOpen(false);
      setEditingSubnet(null);
      if (saved?.id) {
        setSelectedSubnetId(saved.id);
      }
    },
    onError
  });

  const saveAddressMutation = useMutation({
    mutationFn: () =>
      patchAddress(selectedSubnet!.id, selectedOffset as number, {
        hostname: addressForm.hostname || null,
        dns_name: addressForm.dns_name || null,
        comment: addressForm.comment || null,
        equipment_instance_id: addressForm.equipment_instance_id || null,
        equipment_interface_id: addressForm.equipment_interface_id || null,
        is_primary: addressForm.is_primary,
        mac_address: addressForm.mac_address || null
      }),
    onSuccess: refresh,
    onError
  });
  const assignMutation = useMutation({
    mutationFn: () =>
      assignAddress(selectedSubnet!.id, selectedOffset as number, {
        hostname: addressForm.hostname || undefined,
        dns_name: addressForm.dns_name || undefined,
        comment: addressForm.comment || undefined,
        equipment_instance_id: Number(addressForm.equipment_instance_id),
        equipment_interface_id: Number(addressForm.equipment_interface_id),
        is_primary: addressForm.is_primary,
        mac_address: addressForm.mac_address || undefined
      }),
    onSuccess: refresh,
    onError
  });
  const reserveMutation = useMutation({
    mutationFn: () =>
      reserveAddress(selectedSubnet!.id, selectedOffset as number, {
        hostname: addressForm.hostname || undefined,
        comment: addressForm.comment || undefined
      }),
    onSuccess: refresh,
    onError
  });
  const releaseMutation = useMutation({
    mutationFn: () => releaseAddress(selectedSubnet!.id, selectedOffset as number),
    onSuccess: refresh,
    onError
  });
  const deleteVlanMutation = useMutation({
    mutationFn: (id: number) => deleteVlan(id),
    onSuccess: refresh,
    onError
  });
  const deleteSubnetMutation = useMutation({
    mutationFn: (id: number) => deleteSubnet(id),
    onSuccess: refresh,
    onError
  });

  const grouped = useMemo(() => {
    if (!groupByVlan) {
      return [{ key: "all", label: t("common.all"), items: subnets }];
    }
    const map = new Map<string, { key: string; label: string; items: Subnet[] }>();
    subnets.forEach((item) => {
      const key = item.vlan_id ? `v:${item.vlan_id}` : "none";
      const label = item.vlan_number ? `VLAN ${item.vlan_number}` : t("pagesUi.ipam.labels.noVlan");
      if (!map.has(key)) {
        map.set(key, { key, label, items: [] });
      }
      map.get(key)!.items.push(item);
    });
    return Array.from(map.values());
  }, [groupByVlan, subnets, t]);

  const selectSubnet = (id: number) => {
    setSelectedSubnetId(id);
    setSelectedOffset(null);
    const next = new URLSearchParams(params);
    next.set("subnet_id", String(id));
    next.delete("offset");
    setParams(next);
  };

  const selectAddress = (item: IPAddressDetails) => {
    setSelectedOffset(item.ip_offset);
    const next = new URLSearchParams(params);
    if (selectedSubnet?.id) {
      next.set("subnet_id", String(selectedSubnet.id));
    }
    next.set("offset", String(item.ip_offset));
    setParams(next);
  };

  const summary = addressesQuery.data?.summary;
  const items = addressesQuery.data?.items || [];
  const rows = (effectiveMode === "heatmap" ? items.filter((x) => x.status !== "free") : items).slice(
    0,
    256
  );
  const heatmap = addressesQuery.data?.aggregates || [];
  const selectedAddress = addressQuery.data || null;
  const serviceLocked = Boolean(selectedAddress?.is_service);
  const gridCols =
    selectedSubnet?.prefix === 20 ? "repeat(64, 28px)" : "repeat(16, 28px)";

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "290px minmax(0,1fr) 340px" }
        }}
      >
        <Card sx={darkCardSx}>
          <Box sx={{ p: 2, display: "grid", gap: 1.5 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <AppButton
                variant={groupByVlan ? "contained" : "outlined"}
                size="small"
                onClick={() => setGroupByVlan(true)}
                sx={
                  groupByVlan
                    ? { bgcolor: "#5e5a4f", color: "#fff" }
                    : { color: "#fff", borderColor: "rgba(255,255,255,0.18)" }
                }
              >
                VLAN
              </AppButton>
              <AppButton
                variant={!groupByVlan ? "contained" : "outlined"}
                size="small"
                onClick={() => setGroupByVlan(false)}
                sx={
                  !groupByVlan
                    ? { bgcolor: "#5e5a4f", color: "#fff" }
                    : { color: "#fff", borderColor: "rgba(255,255,255,0.18)" }
                }
              >
                {t("pagesUi.ipam.sidebar.flat")}
              </AppButton>
              {canAdmin ? (
                <AppButton
                  variant="outlined"
                  size="small"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => {
                    setEditingSubnet(null);
                    setSubnetForm({
                      vlan_id: selectedSubnet?.vlan_id ? String(selectedSubnet.vlan_id) : "",
                      cidr: "",
                      gateway_ip: "",
                      name: "",
                      description: "",
                      location_id: "",
                      vrf: "",
                      is_active: true
                    });
                    setSubnetOpen(true);
                  }}
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}
                >
                  {t("pagesUi.ipam.actions.addSubnet")}
                </AppButton>
              ) : null}
            </Box>

            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("pagesUi.ipam.filters.searchSubnets")}
              size="small"
              fullWidth
              sx={darkInputSx}
            />

            <Box sx={{ maxHeight: { xs: 320, lg: 760 }, overflowY: "auto", display: "grid", gap: 1.25 }}>
              {subnetsQuery.isLoading ? (
                <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                grouped.map((g) => (
                  <Box key={g.key} sx={{ display: "grid", gap: 0.75 }}>
                    {groupByVlan ? (
                      <Typography
                        variant="caption"
                        sx={{ color: "rgba(255,255,255,0.56)", textTransform: "uppercase" }}
                      >
                        {g.label}
                      </Typography>
                    ) : null}
                    {g.items.map((subnet) => (
                      <Box
                        key={subnet.id}
                        onClick={() => selectSubnet(subnet.id)}
                        sx={{
                          p: 1.2,
                          borderRadius: 2,
                          cursor: "pointer",
                          border: "1px solid rgba(255,255,255,0.08)",
                          bgcolor: selectedSubnet?.id === subnet.id ? "#29456f" : "rgba(255,255,255,0.02)"
                        }}
                      >
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: "#fff" }}>
                            {subnet.cidr}
                          </Typography>
                          {subnet.vlan_number ? (
                            <Chip
                              size="small"
                              label={`V${subnet.vlan_number}`}
                              sx={{ height: 18, color: "#fff", bgcolor: "rgba(0,0,0,0.22)" }}
                            />
                          ) : null}
                        </Box>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>
                          {subnet.name || subnet.description || t("pagesUi.ipam.placeholders.noDescription")}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </Card>
        <Card sx={darkCardSx}>
          <Box sx={{ p: 2, display: "grid", gap: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <TextField value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("pagesUi.ipam.filters.searchSubnets")} size="small" sx={{ ...darkInputSx, minWidth: 220, flexGrow: 1 }} />
              {(["all", "free", "used", "reserved"] as StatusFilter[]).map((item) => <AppButton key={item} variant={status === item ? "contained" : "outlined"} size="small" onClick={() => setStatus(item)} sx={status === item ? { bgcolor: "#5e5a4f", color: "#fff" } : { color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}>{item === "all" ? t("common.all") : t(`pagesUi.ipam.status.${item}`)}</AppButton>)}
              {(["grid", "list", "heatmap"] as ViewMode[]).map((item) => <AppButton key={item} variant={effectiveMode === item ? "contained" : "outlined"} size="small" disabled={selectedSubnet?.prefix !== 16 && item === "heatmap"} onClick={() => setMode(item)} sx={effectiveMode === item ? { bgcolor: "#4d5b3d", color: "#fff" } : { color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}>{t(`pagesUi.ipam.modes.${item}`)}</AppButton>)}
              <AppButton variant="outlined" size="small" startIcon={<DownloadRoundedIcon />} onClick={() => selectedSubnet?.id && exportSubnetCsv(selectedSubnet.id)} sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}>CSV</AppButton>
            </Box>
            {!selectedSubnet ? (
              <Box
                sx={{
                  minHeight: 220,
                  borderRadius: 3,
                  border: "1px dashed rgba(255,255,255,0.14)",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  px: 3
                }}
              >
                <Box sx={{ display: "grid", gap: 1.5, maxWidth: 420 }}>
                  <Typography variant="h6">{t("pagesUi.ipam.empty.title")}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.72)" }}>
                    {t("pagesUi.ipam.empty.description")}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)" }}>
                    {t("pagesUi.ipam.empty.heatmapHint")}
                  </Typography>
                  {canAdmin ? (
                    <Box>
                      <AppButton
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        onClick={() => {
                          setEditingSubnet(null);
                          setSubnetForm({
                            vlan_id: "",
                            cidr: "",
                            gateway_ip: "",
                            name: "",
                            description: "",
                            location_id: "",
                            vrf: "",
                            is_active: true
                          });
                          setSubnetOpen(true);
                        }}
                      >
                        {t("pagesUi.ipam.actions.addSubnet")}
                      </AppButton>
                    </Box>
                  ) : null}
                </Box>
              </Box>
            ) : null}
            {selectedSubnet && selectedSubnet.prefix !== 16 ? (
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)" }}>
                {t("pagesUi.ipam.empty.heatmapHint")}
              </Typography>
            ) : null}
            {selectedSubnet ? <>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "start" }}>
                <Box sx={{ display: "grid", gap: 0.5, minWidth: 260, flexGrow: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{selectedSubnet.cidr}{selectedSubnet.name ? ` - ${selectedSubnet.name}` : ""}</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.72)" }}>{selectedSubnet.description || t("pagesUi.ipam.placeholders.noDescription")}</Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.72)" }}>{t("pagesUi.ipam.labels.gateway")}: {selectedSubnet.gateway_ip || "-"} · {selectedSubnet.vlan_number ? `VLAN ${selectedSubnet.vlan_number}` : t("pagesUi.ipam.labels.noVlan")}{selectedSubnet.location_id ? ` · ${breadcrumbMap.get(selectedSubnet.location_id) || ""}` : ""}</Typography>
                </Box>
                <Stack direction="row" spacing={1}><Metric label={t("pagesUi.ipam.status.free")} value={summary?.free || 0} color={tones.free.bg} /><Metric label={t("pagesUi.ipam.status.used")} value={summary?.used || 0} color={tones.used.bg} /><Metric label={t("pagesUi.ipam.status.reserved")} value={summary?.reserved || 0} color={tones.reserved.bg} /></Stack>
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {Object.keys(tones).map((s) => <Chip key={s} label={t(`pagesUi.ipam.status.${s}`)} size="small" sx={{ color: tones[s].fg, bgcolor: tones[s].bg, fontWeight: 700 }} />)}
                <Box sx={{ flexGrow: 1 }} />
                {canAdmin ? <>
                  <AppButton size="small" startIcon={<EditRoundedIcon />} onClick={() => { setEditingSubnet(selectedSubnet); setSubnetForm({ vlan_id: selectedSubnet.vlan_id ? String(selectedSubnet.vlan_id) : "", cidr: selectedSubnet.cidr, gateway_ip: selectedSubnet.gateway_ip || "", name: selectedSubnet.name || "", description: selectedSubnet.description || "", location_id: selectedSubnet.location_id ? String(selectedSubnet.location_id) : "", vrf: selectedSubnet.vrf || "", is_active: selectedSubnet.is_active }); setSubnetOpen(true); }}>{t("actions.edit")}</AppButton>
                  <AppButton size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => window.confirm(t("pagesUi.ipam.prompts.deleteSubnet")) && deleteSubnetMutation.mutate(selectedSubnet.id)}>{t("actions.delete")}</AppButton>
                </> : null}
              </Box>
              {addressesQuery.isLoading ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : effectiveMode === "heatmap" ? (
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1 }}>
                  {heatmap.map((block) => { const usedRate = (block.used + block.reserved) / Math.max(block.used + block.reserved + block.free, 1); const hue = Math.max(0, 110 - Math.round(usedRate * 110)); return <Box key={block.block_cidr} sx={{ borderRadius: 2, p: 1.25, minHeight: 90, bgcolor: `hsl(${hue} 48% 32%)`, border: "1px solid rgba(255,255,255,0.12)" }}><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{block.block_cidr}</Typography><Typography variant="caption" sx={{ opacity: 0.8 }}>{t("pagesUi.ipam.status.used")}: {block.used} · {t("pagesUi.ipam.status.reserved")}: {block.reserved}</Typography><Typography variant="caption" sx={{ display: "block", opacity: 0.8 }}>{t("pagesUi.ipam.status.free")}: {block.free}</Typography></Box>; })}
                </Box>
              ) : <Box sx={{ display: "grid", gap: 2 }}>
                <Box sx={{ overflow: "auto", borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "#353430", p: 1.25 }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: gridCols, gap: 0.5, width: "max-content" }}>
                    {items.map((item) => <Box key={`${item.subnet_id}:${item.ip_offset}`} onClick={() => selectAddress(item)} sx={{ width: 28, height: 28, borderRadius: 0.7, cursor: "pointer", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, bgcolor: tones[item.status].bg, color: tones[item.status].fg, border: "2px solid", borderColor: selectedOffset === item.ip_offset ? "#fff" : "rgba(0,0,0,0.08)" }}>{item.ip_address.split(".").pop()}</Box>)}
                  </Box>
                </Box>
                <Box sx={{ borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "#353430", overflow: "hidden" }}>
                  <Box sx={{ px: 2, py: 1.2, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between" }}><Typography variant="overline">{t("pagesUi.ipam.sections.addressList")}</Typography><Typography variant="caption" sx={{ color: "rgba(255,255,255,0.56)" }}>{rows.length} {t("pagesUi.ipam.labels.records")}</Typography></Box>
                  <Box sx={{ maxHeight: 340, overflow: "auto" }}>
                    <Table size="small" stickyHeader><TableHead><TableRow><TableCell>IP</TableCell><TableCell>{t("common.status.label")}</TableCell><TableCell>{t("pagesUi.ipam.fields.hostname")}</TableCell><TableCell>Offset</TableCell></TableRow></TableHead><TableBody>{rows.map((item) => <TableRow key={`${item.subnet_id}:${item.ip_offset}:row`} hover selected={selectedOffset === item.ip_offset} onClick={() => selectAddress(item)} sx={{ cursor: "pointer" }}><TableCell sx={{ color: "#fff", fontWeight: 700 }}>{item.ip_address}</TableCell><TableCell><Chip size="small" label={t(`pagesUi.ipam.status.${item.status}`)} sx={{ color: tones[item.status].fg, bgcolor: tones[item.status].bg, fontWeight: 700 }} /></TableCell><TableCell sx={{ color: "rgba(255,255,255,0.82)" }}>{item.hostname || "—"}</TableCell><TableCell sx={{ color: "rgba(255,255,255,0.56)" }}>.{item.ip_offset}</TableCell></TableRow>)}</TableBody></Table>
                  </Box>
                </Box>
              </Box>}
            </> : <Typography color="text.secondary">{t("dashboard.common.no_data")}</Typography>}
          </Box>
        </Card>
        <Card sx={darkCardSx}>
          <Box sx={{ p: 2, display: "grid", gap: 2 }}>
            <Typography variant="h6">{t("pagesUi.ipam.panels.address")}</Typography>
            {selectedAddress ? (
              <>
                <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{selectedAddress.ip_address}</Typography>
                  <Chip size="small" label={t(`pagesUi.ipam.status.${selectedAddress.status}`)} sx={{ mt: 1, color: tones[selectedAddress.status].fg, bgcolor: tones[selectedAddress.status].bg, fontWeight: 700 }} />
                </Box>
                <TextField label={t("pagesUi.ipam.fields.hostname")} value={addressForm.hostname} onChange={(e) => setAddressForm((p) => ({ ...p, hostname: e.target.value }))} size="small" fullWidth disabled={serviceLocked} />
                <TextField label={t("pagesUi.ipam.fields.dnsName")} value={addressForm.dns_name} onChange={(e) => setAddressForm((p) => ({ ...p, dns_name: e.target.value }))} size="small" fullWidth disabled={serviceLocked} />
                <TextField label={t("pagesUi.ipam.fields.macAddress")} value={addressForm.mac_address} onChange={(e) => setAddressForm((p) => ({ ...p, mac_address: e.target.value }))} size="small" fullWidth disabled={serviceLocked} />
                <TextField label={t("common.fields.comment")} value={addressForm.comment} onChange={(e) => setAddressForm((p) => ({ ...p, comment: e.target.value }))} size="small" multiline minRows={3} fullWidth disabled={serviceLocked} />
                <TextField label={t("pagesUi.ipam.fields.searchEquipment")} value={addressForm.equipmentQuery} onChange={(e) => setAddressForm((p) => ({ ...p, equipmentQuery: e.target.value }))} size="small" fullWidth disabled={serviceLocked} />
                {(eligibleQuery.data || []).length ? <FormControl size="small" fullWidth disabled={serviceLocked}><InputLabel>{t("pagesUi.ipam.fields.equipment")}</InputLabel><Select label={t("pagesUi.ipam.fields.equipment")} value={addressForm.equipment_instance_id} onChange={(e) => { const found = (eligibleQuery.data || []).find((x: EligibleEquipment) => x.equipment_instance_id === Number(e.target.value)); setAddressForm((p) => ({ ...p, equipment_instance_id: Number(e.target.value), equipment_interface_id: found?.network_interfaces[0]?.id || "" })); }}>{(eligibleQuery.data || []).map((item: EligibleEquipment) => <MenuItem key={item.equipment_instance_id} value={item.equipment_instance_id}>{item.display_name}</MenuItem>)}</Select></FormControl> : null}
                <FormControl size="small" fullWidth disabled={!selectedEquipment || serviceLocked}><InputLabel>{t("pagesUi.ipam.fields.interface")}</InputLabel><Select label={t("pagesUi.ipam.fields.interface")} value={addressForm.equipment_interface_id} onChange={(e) => setAddressForm((p) => ({ ...p, equipment_interface_id: Number(e.target.value) }))}>{(selectedEquipment?.network_interfaces || []).map((item) => <MenuItem key={item.id} value={item.id}>{item.interface_name}</MenuItem>)}</Select></FormControl>
                <FormControlLabel control={<Switch checked={addressForm.is_primary} onChange={(e) => setAddressForm((p) => ({ ...p, is_primary: e.target.checked }))} disabled={serviceLocked} />} label={t("pagesUi.ipam.fields.isPrimary")} />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <AppButton variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => saveAddressMutation.mutate()} disabled={!canOperate || !selectedSubnet || selectedOffset === null || serviceLocked}>{t("actions.save")}</AppButton>
                  <AppButton variant="contained" color="warning" startIcon={<BookmarkAddedRoundedIcon />} onClick={() => reserveMutation.mutate()} disabled={!canOperate || !selectedSubnet || selectedOffset === null || serviceLocked}>{t("pagesUi.ipam.actions.reserve")}</AppButton>
                  <AppButton variant="contained" color="success" startIcon={<LinkRoundedIcon />} onClick={() => assignMutation.mutate()} disabled={!canOperate || !selectedSubnet || selectedOffset === null || !addressForm.equipment_instance_id || !addressForm.equipment_interface_id || serviceLocked}>{t("pagesUi.ipam.actions.assign")}</AppButton>
                  <AppButton variant="outlined" color="error" startIcon={<DeleteSweepRoundedIcon />} onClick={() => releaseMutation.mutate()} disabled={!canOperate || !selectedSubnet || selectedOffset === null || serviceLocked}>{t("pagesUi.ipam.actions.release")}</AppButton>
                </Stack>
                {serviceLocked ? <Typography variant="caption" color="warning.main">{t("pagesUi.ipam.placeholders.serviceLocked")}</Typography> : null}
              </>
            ) : (
              <Typography color="text.secondary">{t("pagesUi.ipam.placeholders.selectAddress")}</Typography>
            )}
            {canAdmin ? <Box sx={{ display: "grid", gap: 1 }}>
              <Typography variant="subtitle2">{t("pagesUi.ipam.sections.vlans")}</Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <AppButton size="small" startIcon={<AddRoundedIcon />} onClick={() => { setEditingVlan(null); setVlanForm({ vlan_number: "", name: "", purpose: "", description: "", location_id: "", is_active: true }); setVlanOpen(true); }}>{t("pagesUi.ipam.actions.addVlan")}</AppButton>
                {vlans.slice(0, 6).map((vlan) => <Chip key={vlan.id} label={`VLAN ${vlan.vlan_number} · ${vlan.name}`} onClick={() => { setEditingVlan(vlan); setVlanForm({ vlan_number: String(vlan.vlan_number), name: vlan.name || "", purpose: vlan.purpose || "", description: vlan.description || "", location_id: vlan.location_id ? String(vlan.location_id) : "", is_active: vlan.is_active }); setVlanOpen(true); }} />)}
              </Box>
            </Box> : null}
          </Box>
        </Card>
      </Box>

      <Dialog open={vlanOpen} onClose={() => setVlanOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingVlan ? t("pagesUi.ipam.dialogs.editVlan") : t("pagesUi.ipam.dialogs.createVlan")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
          <TextField label={t("pagesUi.ipam.fields.vlanNumber")} type="number" value={vlanForm.vlan_number} onChange={(e) => setVlanForm((p) => ({ ...p, vlan_number: e.target.value }))} fullWidth />
          <TextField label={t("common.fields.name")} value={vlanForm.name} onChange={(e) => setVlanForm((p) => ({ ...p, name: e.target.value }))} fullWidth />
          <TextField label={t("pagesUi.ipam.fields.purpose")} value={vlanForm.purpose} onChange={(e) => setVlanForm((p) => ({ ...p, purpose: e.target.value }))} fullWidth />
          <TextField label={t("common.fields.comment")} value={vlanForm.description} onChange={(e) => setVlanForm((p) => ({ ...p, description: e.target.value }))} multiline minRows={3} fullWidth />
          <SearchableSelectField label={t("common.fields.location")} value={vlanForm.location_id} options={locationOptions.map((item) => ({ value: String(item.value), label: item.label }))} onChange={(nextValue) => setVlanForm((p) => ({ ...p, location_id: String(nextValue) }))} emptyOptionLabel={t("actions.notSelected")} fullWidth />
          <FormControlLabel control={<Switch checked={vlanForm.is_active} onChange={(e) => setVlanForm((p) => ({ ...p, is_active: e.target.checked }))} />} label={t("common.status.active")} />
        </DialogContent>
        <DialogActions>
          {editingVlan ? <AppButton color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => window.confirm(t("pagesUi.ipam.prompts.deleteVlan")) && deleteVlanMutation.mutate(editingVlan.id)}>{t("actions.delete")}</AppButton> : null}
          <Box sx={{ flexGrow: 1 }} />
          <AppButton onClick={() => setVlanOpen(false)}>{t("actions.cancel")}</AppButton>
          <AppButton variant="contained" onClick={() => saveVlanMutation.mutate()}>{t("actions.save")}</AppButton>
        </DialogActions>
      </Dialog>

      <Dialog open={subnetOpen} onClose={() => setSubnetOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingSubnet ? t("pagesUi.ipam.dialogs.editSubnet") : t("pagesUi.ipam.dialogs.createSubnet")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
          <FormControl fullWidth><InputLabel>VLAN</InputLabel><Select label="VLAN" value={subnetForm.vlan_id} onChange={(e) => setSubnetForm((p) => ({ ...p, vlan_id: String(e.target.value) }))}><MenuItem value="">{t("pagesUi.ipam.labels.noVlan")}</MenuItem>{vlans.map((item) => <MenuItem key={item.id} value={String(item.id)}>{`VLAN ${item.vlan_number} · ${item.name}`}</MenuItem>)}</Select></FormControl>
          <TextField label="CIDR" value={subnetForm.cidr} onChange={(e) => setSubnetForm((p) => ({ ...p, cidr: e.target.value }))} disabled={Boolean(editingSubnet)} helperText={editingSubnet ? t("pagesUi.ipam.placeholders.cidrLocked") : "10.10.0.0/24"} fullWidth />
          <TextField label={t("pagesUi.ipam.labels.gateway")} value={subnetForm.gateway_ip} onChange={(e) => setSubnetForm((p) => ({ ...p, gateway_ip: e.target.value }))} fullWidth />
          <TextField label={t("common.fields.name")} value={subnetForm.name} onChange={(e) => setSubnetForm((p) => ({ ...p, name: e.target.value }))} fullWidth />
          <TextField label={t("common.fields.comment")} value={subnetForm.description} onChange={(e) => setSubnetForm((p) => ({ ...p, description: e.target.value }))} multiline minRows={3} fullWidth />
          <TextField label="VRF" value={subnetForm.vrf} onChange={(e) => setSubnetForm((p) => ({ ...p, vrf: e.target.value }))} fullWidth />
          <SearchableSelectField label={t("common.fields.location")} value={subnetForm.location_id} options={locationOptions.map((item) => ({ value: String(item.value), label: item.label }))} onChange={(nextValue) => setSubnetForm((p) => ({ ...p, location_id: String(nextValue) }))} emptyOptionLabel={t("actions.notSelected")} fullWidth />
          <FormControlLabel control={<Switch checked={subnetForm.is_active} onChange={(e) => setSubnetForm((p) => ({ ...p, is_active: e.target.checked }))} />} label={t("common.status.active")} />
        </DialogContent>
        <DialogActions>
          {editingSubnet ? <AppButton color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => window.confirm(t("pagesUi.ipam.prompts.deleteSubnet")) && deleteSubnetMutation.mutate(editingSubnet.id)}>{t("actions.delete")}</AppButton> : null}
          <Box sx={{ flexGrow: 1 }} />
          <AppButton onClick={() => setSubnetOpen(false)}>{t("actions.cancel")}</AppButton>
          <AppButton variant="contained" onClick={() => saveSubnetMutation.mutate()}>{t("actions.save")}</AppButton>
        </DialogActions>
      </Dialog>

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
