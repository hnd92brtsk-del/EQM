import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { EntityImportExportIconActions } from "../../../components/EntityImportExportIconActions";
import { ErrorSnackbar } from "../../../components/ErrorSnackbar";
import { SearchableTreeSelectField, type SearchableTreeSelectOption } from "../../../components/SearchableTreeSelectField";
import { AppButton } from "../../../components/ui/AppButton";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../utils/permissions";
import { buildLocationLookups, fetchLocationsTree } from "../../../utils/locations";
import { assignAddress, createSubnetFromCalculator, createVlan, deleteSubnet, deleteVlan, getAddressDetails, getHostEquipmentTree, getSubnetAddresses, listSubnets, listVlans, patchAddress, releaseAddress, updateSubnet, updateVlan } from "../api/ipam";
import type { HostEquipmentTreeLeaf, HostEquipmentTreeNode, IPAddressDetails, Subnet, Vlan } from "../types";

type StatusFilter = "all" | "free" | "used" | "reserved";
type EditStatus = "free" | "used" | "reserved" | "service";

const tones = {
  free: { bg: "#4c7a47", fg: "#d9f6d4" },
  used: { bg: "#7d4343", fg: "#ffd7d7" },
  reserved: { bg: "#79652d", fg: "#fff0b8" },
  service: { bg: "#58457e", fg: "#efe2ff" },
  gateway: { bg: "#38658d", fg: "#d8efff" },
  network: { bg: "#2d2d2d", fg: "#d0d0d0" },
  broadcast: { bg: "#242424", fg: "#d0d0d0" }
} as const;

function err(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function validIp(ip: string) {
  const parts = ip.trim().split(".");
  return parts.length === 4 && parts.every((part) => part !== "" && Number(part) >= 0 && Number(part) <= 255);
}

function ipToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => ((acc << 8) | Number(part)) >>> 0, 0);
}

function intToIp(n: number) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function calcSubnet(ip: string, cidrRaw: string) {
  const cidr = Number(cidrRaw);
  if (!validIp(ip) || !Number.isInteger(cidr) || cidr < 0 || cidr > 32) return null;
  const mask = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
  const ni = ipToInt(ip) & mask;
  const bc = (ni | (~mask >>> 0)) >>> 0;
  const total = Math.pow(2, 32 - cidr);
  const hosts = cidr <= 30 ? total - 2 : cidr === 31 ? 2 : 1;
  return { cidr, network: intToIp(ni), broadcast: intToIp(bc), mask: intToIp(mask), firstHost: intToIp(cidr === 32 ? ni : ni + 1), lastHost: intToIp(cidr === 32 ? bc : Math.max(ni, bc - 1)), total, hosts, size: cidr >= 24 ? "Небольшая сеть" : cidr >= 16 ? "Средняя сеть" : "Большая сеть" };
}

function flattenTree(nodes: HostEquipmentTreeNode[]) {
  const map = new Map<string, HostEquipmentTreeLeaf>();
  const walk = (items: HostEquipmentTreeNode[]): SearchableTreeSelectOption[] =>
    items.map((item) => ({
      label: item.label,
      value: item.value,
      children: [
        ...walk(item.children),
        ...item.equipment.map((leaf) => {
          map.set(leaf.value, leaf);
          return { label: `${leaf.location_full_path ? `${leaf.location_full_path} / ` : ""}${leaf.label}`, value: leaf.value };
        })
      ]
    }));
  return { options: walk(nodes), map };
}

export default function IPAMPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const canOperate = hasPermission(user, "engineering", "write");
  const canAdmin = hasPermission(user, "engineering", "write");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sidebarTab, setSidebarTab] = useState<"subnets" | "vlans">("subnets");
  const [selectedSubnetId, setSelectedSubnetId] = useState<number | null>(Number(params.get("subnet_id") || 0) || null);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(params.get("offset") ? Number(params.get("offset")) : null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorDone, setCalculatorDone] = useState(false);
  const [calculator, setCalculator] = useState({ network_address_input: "10.10.0.0", cidr: "24", name: "", vlan_id: "", gateway_ip: "", description: "", location_id: "", vrf: "" });
  const [vlanDialog, setVlanDialog] = useState<{
    mode: "create" | "edit";
    vlanId?: number;
    vlan_number: string;
    name: string;
    purpose: string;
    description: string;
    location_id: string;
    is_active: string;
  } | null>(null);
  const [subnetDialog, setSubnetDialog] = useState<{
    subnetId: number;
    cidr: string;
    vlan_id: string;
    gateway_ip: string;
    name: string;
    description: string;
    location_id: string;
    vrf: string;
    is_active: string;
  } | null>(null);
  const [form, setForm] = useState({ status: "free" as EditStatus, hostname: "", dns_name: "", mac_address: "", comment: "", equipment_value: "", equipment_interface_id: "" });

  const calc = useMemo(() => calcSubnet(calculator.network_address_input, calculator.cidr), [calculator.network_address_input, calculator.cidr]);
  const locationsQuery = useQuery({ queryKey: ["ipam-locations"], queryFn: () => fetchLocationsTree(false) });
  const vlansQuery = useQuery({ queryKey: ["ipam-vlans"], queryFn: () => listVlans({ page: 1, page_size: 200, sort: "vlan_number" }) });
  const subnetsQuery = useQuery({ queryKey: ["ipam-subnets"], queryFn: () => listSubnets({ page: 1, page_size: 200, sort: "network_address" }) });
  const hostTreeQuery = useQuery({ queryKey: ["ipam-host-tree"], queryFn: () => getHostEquipmentTree({}) });
  const addressQuery = useQuery({ queryKey: ["ipam-address", selectedSubnetId, selectedOffset], enabled: Boolean(selectedSubnetId && selectedOffset !== null), queryFn: () => getAddressDetails(selectedSubnetId!, selectedOffset!) });
  const gridQuery = useQuery({ queryKey: ["ipam-grid", selectedSubnetId], enabled: Boolean(selectedSubnetId), queryFn: () => getSubnetAddresses(selectedSubnetId!, { mode: "grid", include_service: true }) });
  const listQuery = useQuery({ queryKey: ["ipam-list", selectedSubnetId, search, status], enabled: Boolean(selectedSubnetId), queryFn: () => getSubnetAddresses(selectedSubnetId!, { mode: "grid", include_service: true, q: search || undefined, status: status === "all" ? undefined : status }) });

  const { options: locationOptions } = useMemo(() => buildLocationLookups(locationsQuery.data || []), [locationsQuery.data]);
  const { options: hostOptions, map: hostMap } = useMemo(() => flattenTree(hostTreeQuery.data || []), [hostTreeQuery.data]);
  const subnets = subnetsQuery.data?.items || [];
  const vlans = vlansQuery.data?.items || [];
  const selectedSubnet = useMemo(() => subnets.find((item) => item.id === selectedSubnetId) || subnets[0] || null, [selectedSubnetId, subnets]);
  const selectedEquipment = form.equipment_value ? hostMap.get(form.equipment_value) || null : null;
  const gridItems = (gridQuery.data?.items || []).slice(0, 256);
  const rows = (listQuery.data?.items || []).slice(0, 256);
  const serviceLocked = Boolean(addressQuery.data?.is_service);
  const ui = useMemo(() => ({
    panelBg: isDark ? "#0b1220" : "#ffffff",
    panelBorder: alpha(isDark ? "#7ea2d6" : "#24406f", isDark ? 0.14 : 0.12),
    innerBg: isDark ? "#0f1728" : "#f7fbff",
    innerBgStrong: isDark ? "#111a2c" : "#eef4fb",
    selectedBg: isDark ? alpha("#153250", 0.6) : alpha("#dcecff", 0.95),
    itemBorder: alpha(isDark ? "#7ea2d6" : "#24406f", 0.12),
    selectedBorder: alpha(isDark ? "#5ea8ff" : "#3a7bd5", 0.6),
    title: isDark ? "#8fd0ff" : "#1c5fb8",
    text: isDark ? "#d3e8ff" : "#1c2430",
    muted: isDark ? "#6d88aa" : "#6b7b91",
    icon: isDark ? "#b7d9ff" : "#315d97",
    danger: isDark ? "#ff7b7b" : "#d65151",
    chipBg: isDark ? alpha("#4b79b7", 0.18) : alpha("#3a7bd5", 0.12),
    chipFg: isDark ? "#7ebeff" : "#245da8",
    selectedGridBorder: isDark ? "#d8edff" : "#2f6fed",
    unselectedGridBorder: alpha(isDark ? "#ffffff" : "#24406f", isDark ? 0.06 : 0.08),
    dialogBg: isDark ? "#162132" : "#ffffff",
    calcBg: isDark ? "#0d1727" : "#f6fafe",
  }), [isDark]);

  useEffect(() => {
    if (!selectedSubnetId && subnets[0]) setSelectedSubnetId(subnets[0].id);
  }, [selectedSubnetId, subnets]);

  useEffect(() => {
    const item = addressQuery.data;
    if (!item) return;
    setForm({
      status: item.status === "gateway" || item.status === "network" || item.status === "broadcast" ? "free" : item.status,
      hostname: item.hostname || "",
      dns_name: item.dns_name || "",
      mac_address: item.mac_address || "",
      comment: item.comment || "",
      equipment_value: item.equipment_source && item.equipment_item_id ? `${item.equipment_source}:${item.equipment_item_id}` : "",
      equipment_interface_id: item.equipment_interface_id ? String(item.equipment_interface_id) : ""
    });
  }, [addressQuery.data]);

  useEffect(() => {
    if (selectedEquipment && !selectedEquipment.network_interfaces.some((item) => String(item.id) === form.equipment_interface_id)) {
      setForm((prev) => ({ ...prev, equipment_interface_id: selectedEquipment.network_interfaces[0] ? String(selectedEquipment.network_interfaces[0].id) : "" }));
    }
  }, [form.equipment_interface_id, selectedEquipment]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ipam-vlans"] });
    qc.invalidateQueries({ queryKey: ["ipam-subnets"] });
    qc.invalidateQueries({ queryKey: ["ipam-grid"] });
    qc.invalidateQueries({ queryKey: ["ipam-list"] });
    qc.invalidateQueries({ queryKey: ["ipam-address"] });
    qc.invalidateQueries({ queryKey: ["ipam-host-tree"] });
    qc.invalidateQueries({ queryKey: ["cabinet-item-ipam-summary"] });
  };

  const openCreateVlanDialog = () => setVlanDialog({ mode: "create", vlan_number: "", name: "", purpose: "", description: "", location_id: "", is_active: "true" });
  const openEditVlanDialog = (vlan: Vlan) =>
    setVlanDialog({
      mode: "edit",
      vlanId: vlan.id,
      vlan_number: String(vlan.vlan_number),
      name: vlan.name,
      purpose: vlan.purpose || "",
      description: vlan.description || "",
      location_id: vlan.location_id ? String(vlan.location_id) : "",
      is_active: vlan.is_active ? "true" : "false"
    });
  const openEditSubnetDialog = (subnet: Subnet) =>
    setSubnetDialog({
      subnetId: subnet.id,
      cidr: subnet.cidr,
      vlan_id: subnet.vlan_id ? String(subnet.vlan_id) : "",
      gateway_ip: subnet.gateway_ip || "",
      name: subnet.name || "",
      description: subnet.description || "",
      location_id: subnet.location_id ? String(subnet.location_id) : "",
      vrf: subnet.vrf || "",
      is_active: subnet.is_active ? "true" : "false"
    });

  const createSubnetMutation = useMutation({
    mutationFn: async () => {
      if (!calc || !calculator.name.trim()) throw new Error("Заполните корректно калькулятор и название подсети.");
      return createSubnetFromCalculator({ network_address_input: calculator.network_address_input.trim(), cidr: calc.cidr, vlan_id: calculator.vlan_id ? Number(calculator.vlan_id) : null, gateway_ip: calculator.gateway_ip.trim() || calc.firstHost, name: calculator.name.trim(), description: calculator.description.trim() || null, location_id: calculator.location_id ? Number(calculator.location_id) : null, vrf: calculator.vrf.trim() || null, is_active: true });
    },
    onSuccess: (subnet) => {
      refresh();
      setCalculatorOpen(false);
      setCalculatorDone(false);
      setSelectedSubnetId(subnet.id);
      setSelectedOffset(null);
      setCalculator({ network_address_input: "10.10.0.0", cidr: "24", name: "", vlan_id: "", gateway_ip: "", description: "", location_id: "", vrf: "" });
    },
    onError: (error) => setErrorMessage(err(error, "Не удалось создать подсеть"))
  });

  const vlanMutation = useMutation({
    mutationFn: async () => {
      if (!vlanDialog) throw new Error("VLAN dialog is closed.");
      const payload = {
        vlan_number: Number(vlanDialog.vlan_number),
        name: vlanDialog.name.trim(),
        purpose: vlanDialog.purpose.trim() || null,
        description: vlanDialog.description.trim() || null,
        location_id: vlanDialog.location_id ? Number(vlanDialog.location_id) : null,
        is_active: vlanDialog.is_active === "true"
      };
      return vlanDialog.mode === "create" ? createVlan(payload) : updateVlan(vlanDialog.vlanId!, payload);
    },
    onSuccess: () => {
      refresh();
      setVlanDialog(null);
    },
    onError: (error) => setErrorMessage(err(error, "Не удалось сохранить VLAN"))
  });

  const deleteVlanMutation = useMutation({
    mutationFn: (vlanId: number) => deleteVlan(vlanId),
    onSuccess: () => refresh(),
    onError: (error) => setErrorMessage(err(error, "Не удалось удалить VLAN"))
  });

  const subnetMutation = useMutation({
    mutationFn: async () => {
      if (!subnetDialog) throw new Error("Subnet dialog is closed.");
      return updateSubnet(subnetDialog.subnetId, {
        vlan_id: subnetDialog.vlan_id ? Number(subnetDialog.vlan_id) : null,
        gateway_ip: subnetDialog.gateway_ip.trim() || null,
        name: subnetDialog.name.trim() || null,
        description: subnetDialog.description.trim() || null,
        location_id: subnetDialog.location_id ? Number(subnetDialog.location_id) : null,
        vrf: subnetDialog.vrf.trim() || null,
        is_active: subnetDialog.is_active === "true"
      });
    },
    onSuccess: () => {
      refresh();
      setSubnetDialog(null);
    },
    onError: (error) => setErrorMessage(err(error, "Не удалось сохранить подсеть"))
  });

  const deleteSubnetMutation = useMutation({
    mutationFn: (subnetId: number) => deleteSubnet(subnetId),
    onSuccess: (_, subnetId) => {
      refresh();
      if (selectedSubnetId === subnetId) {
        const nextSubnet = subnets.find((item) => item.id !== subnetId) || null;
        setSelectedSubnetId(nextSubnet?.id || null);
        setSelectedOffset(null);
        const next = new URLSearchParams(params);
        if (nextSubnet) next.set("subnet_id", String(nextSubnet.id));
        else next.delete("subnet_id");
        next.delete("offset");
        setParams(next);
      }
    },
    onError: (error) => setErrorMessage(err(error, "Не удалось удалить подсеть"))
  });

  const saveAddressMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubnet || selectedOffset === null) throw new Error("Адрес не выбран.");
      if (form.status === "used") {
        if (!selectedEquipment || !form.equipment_interface_id) throw new Error("Для занятого адреса выберите оборудование и интерфейс.");
        return assignAddress(selectedSubnet.id, selectedOffset, { hostname: form.hostname || undefined, dns_name: form.dns_name || undefined, comment: form.comment || undefined, mac_address: form.mac_address || undefined, equipment_source: selectedEquipment.equipment_source, equipment_item_id: selectedEquipment.equipment_item_id, equipment_instance_id: selectedEquipment.equipment_instance_id || null, equipment_interface_id: Number(form.equipment_interface_id) });
      }
      if (form.status === "free") return releaseAddress(selectedSubnet.id, selectedOffset);
      return patchAddress(selectedSubnet.id, selectedOffset, { status: form.status, hostname: form.hostname || null, dns_name: form.dns_name || null, comment: form.comment || null, mac_address: form.mac_address || null, equipment_source: null, equipment_item_id: null, equipment_instance_id: null, equipment_interface_id: null });
    },
    onSuccess: () => refresh(),
    onError: (error) => setErrorMessage(err(error, "Не удалось сохранить адрес"))
  });

  const pickSubnet = (id: number) => {
    setSelectedSubnetId(id);
    setSelectedOffset(null);
    const next = new URLSearchParams(params);
    next.set("subnet_id", String(id));
    next.delete("offset");
    setParams(next);
  };

  const pickAddress = (item: IPAddressDetails) => {
    setSelectedOffset(item.ip_offset);
    const next = new URLSearchParams(params);
    if (selectedSubnetId) next.set("subnet_id", String(selectedSubnetId));
    next.set("offset", String(item.ip_offset));
    setParams(next);
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>IPAM / Сеть</Typography>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "270px minmax(0,1fr) 300px" } }}>
        <Card sx={{ bgcolor: ui.panelBg, color: ui.text, border: `1px solid ${ui.panelBorder}`, boxShadow: "none" }}>
          <CardContent sx={{ display: "grid", gap: 1.5 }}>
            <Stack direction="row" spacing={1}>
              <AppButton variant={sidebarTab === "subnets" ? "contained" : "outlined"} size="small" onClick={() => setSidebarTab("subnets")}>Подсети</AppButton>
              <AppButton variant={sidebarTab === "vlans" ? "contained" : "outlined"} size="small" onClick={() => setSidebarTab("vlans")}>VLAN</AppButton>
            </Stack>
            <TextField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск IP или хоста..." fullWidth />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: ui.muted, textTransform: "uppercase" }}>
                {sidebarTab === "subnets" ? "Подсети" : "VLAN"}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <EntityImportExportIconActions
                  basePath={sidebarTab === "subnets" ? "/ipam/subnets" : "/ipam/vlans"}
                  filenamePrefix={sidebarTab === "subnets" ? "ipam-subnets" : "ipam-vlans"}
                  exportParams={sidebarTab === "subnets" ? { sort: "network_address" } : { sort: "vlan_number" }}
                  canWrite={canAdmin}
                  onCommitted={refresh}
                  size="small"
                />
                {canAdmin ? (
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (sidebarTab === "subnets") setCalculatorOpen(true);
                      else openCreateVlanDialog();
                    }}
                    sx={{ color: ui.icon, border: `1px solid ${alpha(isDark ? "#7ea2d6" : "#24406f", 0.2)}`, bgcolor: alpha(isDark ? "#7ea2d6" : "#24406f", isDark ? 0.08 : 0.05) }}
                  >
                    <AddRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Stack>
            </Stack>
            <Box sx={{ maxHeight: 760, overflowY: "auto", display: "grid", gap: 1 }}>
              {subnetsQuery.isLoading || vlansQuery.isLoading ? <Box sx={{ py: 6, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box> : null}
              {sidebarTab === "subnets" ? subnets.map((item) => (
                <Box key={item.id} onClick={() => pickSubnet(item.id)} sx={{ p: 1.4, borderRadius: 2, cursor: "pointer", border: `1px solid ${selectedSubnet?.id === item.id ? ui.selectedBorder : ui.itemBorder}`, bgcolor: selectedSubnet?.id === item.id ? ui.selectedBg : ui.innerBg }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 700, color: ui.title }}>{item.cidr}</Typography>
                        {item.vlan_number ? <Chip size="small" label={`V${item.vlan_number}`} sx={{ bgcolor: ui.chipBg, color: ui.chipFg }} /> : null}
                      </Stack>
                      <Typography sx={{ mt: 0.5 }}>{item.name || "Без названия"}</Typography>
                      <Typography sx={{ mt: 0.25, fontSize: 12, color: ui.muted }}>{item.description || item.vlan_name || "Без описания"}</Typography>
                    </Box>
                    {canAdmin ? (
                      <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
                        <IconButton size="small" onClick={(event) => { event.stopPropagation(); openEditSubnetDialog(item); }} sx={{ color: ui.icon }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(event) => { event.stopPropagation(); if (window.confirm("Удалить подсеть?")) deleteSubnetMutation.mutate(item.id); }} sx={{ color: ui.danger }}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : null}
                  </Stack>
                </Box>
              )) : vlans.map((item) => (
                <Box key={item.id} onClick={() => { const subnet = subnets.find((subnetItem) => subnetItem.vlan_id === item.id); if (subnet) pickSubnet(subnet.id); }} sx={{ p: 1.4, borderRadius: 2, cursor: "pointer", border: `1px solid ${ui.itemBorder}`, bgcolor: ui.innerBg }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, color: ui.title }}>{`VLAN ${item.vlan_number}`}</Typography>
                      <Typography sx={{ mt: 0.5 }}>{item.name}</Typography>
                      <Typography sx={{ mt: 0.25, fontSize: 12, color: ui.muted }}>{item.purpose || item.description || "Без описания"}</Typography>
                    </Box>
                    {canAdmin ? (
                      <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
                        <IconButton size="small" onClick={(event) => { event.stopPropagation(); openEditVlanDialog(item); }} sx={{ color: ui.icon }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(event) => { event.stopPropagation(); if (window.confirm("Удалить VLAN?")) deleteVlanMutation.mutate(item.id); }} sx={{ color: ui.danger }}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : null}
                  </Stack>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: ui.panelBg, color: ui.text, border: `1px solid ${ui.panelBorder}`, boxShadow: "none" }}>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: ui.title }}>{selectedSubnet?.cidr || "Подсеть не выбрана"}</Typography>
                <Typography sx={{ color: ui.muted }}>{selectedSubnet?.name || selectedSubnet?.description || "Выберите подсеть слева"}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha("#5b9a57", 0.12), minWidth: 92 }}><Typography sx={{ fontSize: 28, fontWeight: 800, color: "#5b9a57" }}>{gridQuery.data?.summary.free || 0}</Typography><Typography sx={{ fontSize: 11, color: ui.muted }}>Свободно</Typography></Box>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha("#b85050", 0.12), minWidth: 92 }}><Typography sx={{ fontSize: 28, fontWeight: 800, color: "#b85050" }}>{gridQuery.data?.summary.used || 0}</Typography><Typography sx={{ fontSize: 11, color: ui.muted }}>Занято</Typography></Box>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha("#b19239", 0.12), minWidth: 92 }}><Typography sx={{ fontSize: 28, fontWeight: 800, color: "#b19239" }}>{gridQuery.data?.summary.reserved || 0}</Typography><Typography sx={{ fontSize: 11, color: ui.muted }}>Резерв</Typography></Box>
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>{(["all", "free", "used", "reserved"] as StatusFilter[]).map((item) => <AppButton key={item} size="small" variant={status === item ? "contained" : "outlined"} onClick={() => setStatus(item)}>{item === "all" ? "все" : item === "free" ? "своб." : item === "used" ? "занят." : "резерв"}</AppButton>)}</Stack>
            {selectedSubnet && selectedSubnet.prefix !== 24 ? <Alert severity="info">Для {selectedSubnet.cidr} показаны первые 256 адресов из {gridQuery.data?.summary.total || 0}.</Alert> : null}
            <Box sx={{ borderRadius: 3, border: `1px solid ${ui.panelBorder}`, bgcolor: ui.innerBg, p: 1, overflow: "auto" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(16, 28px)", gap: 0.5, width: "max-content" }}>
                {gridItems.map((item) => <Box key={`${item.subnet_id}:${item.ip_offset}`} title={`${item.ip_address}${item.hostname ? ` · ${item.hostname}` : ""} (${item.status})`} onClick={() => pickAddress(item)} sx={{ width: 28, height: 28, borderRadius: 0.75, cursor: "pointer", bgcolor: tones[item.status].bg, border: `2px solid ${selectedOffset === item.ip_offset ? ui.selectedGridBorder : ui.unselectedGridBorder}`, "&:hover": { filter: "brightness(1.08)" } }} />)}
              </Box>
            </Box>
            <Box sx={{ borderRadius: 3, border: `1px solid ${ui.panelBorder}`, overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.1, display: "flex", justifyContent: "space-between", bgcolor: ui.innerBgStrong }}><Typography sx={{ fontSize: 12, color: ui.muted }}>СПИСОК АДРЕСОВ</Typography><Typography sx={{ fontSize: 12, color: ui.muted }}>{rows.length} записей</Typography></Box>
              <Box sx={{ maxHeight: 360, overflow: "auto" }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell sx={{ bgcolor: ui.innerBgStrong, color: ui.muted }}>IP</TableCell><TableCell sx={{ bgcolor: ui.innerBgStrong, color: ui.muted }}>Статус</TableCell><TableCell sx={{ bgcolor: ui.innerBgStrong, color: ui.muted }}>Хост</TableCell><TableCell sx={{ bgcolor: ui.innerBgStrong, color: ui.muted }}>Offset</TableCell></TableRow></TableHead>
                  <TableBody>{rows.map((item) => <TableRow key={`${item.subnet_id}:${item.ip_offset}:row`} hover selected={selectedOffset === item.ip_offset} onClick={() => pickAddress(item)} sx={{ cursor: "pointer" }}><TableCell sx={{ color: ui.title, fontWeight: 700 }}>{item.ip_address}</TableCell><TableCell><Chip size="small" label={item.status} sx={{ bgcolor: tones[item.status].bg, color: tones[item.status].fg }} /></TableCell><TableCell sx={{ color: ui.text }}>{item.hostname || "—"}</TableCell><TableCell sx={{ color: ui.muted }}>{`.${item.ip_offset}`}</TableCell></TableRow>)}</TableBody>
                </Table>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: ui.panelBg, color: ui.text, border: `1px solid ${ui.panelBorder}`, boxShadow: "none" }}>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            {addressQuery.data ? (
              <>
                <Typography sx={{ fontSize: 12, color: ui.muted }}>IP-АДРЕС</Typography>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: ui.title }}>{addressQuery.data.ip_address}</Typography>
                <FormControl size="small" fullWidth disabled={serviceLocked}><InputLabel>Статус</InputLabel><Select label="Статус" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as EditStatus }))}><MenuItem value="free">свободен</MenuItem><MenuItem value="used">занят</MenuItem><MenuItem value="reserved">резерв</MenuItem><MenuItem value="service">служ.</MenuItem></Select></FormControl>
                <TextField size="small" label="Имя хоста" value={form.hostname} onChange={(e) => setForm((prev) => ({ ...prev, hostname: e.target.value }))} disabled={serviceLocked} />
                <TextField size="small" label="DNS" value={form.dns_name} onChange={(e) => setForm((prev) => ({ ...prev, dns_name: e.target.value }))} disabled={serviceLocked} />
                <TextField size="small" label="MAC" value={form.mac_address} onChange={(e) => setForm((prev) => ({ ...prev, mac_address: e.target.value }))} disabled={serviceLocked} />
                <TextField size="small" label="Комментарий" value={form.comment} onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))} disabled={serviceLocked} multiline minRows={3} />
                <SearchableTreeSelectField label="Хост / оборудование" value={form.equipment_value} options={hostOptions} onChange={(next) => setForm((prev) => ({ ...prev, equipment_value: String(next), equipment_interface_id: "" }))} emptyOptionLabel="Не выбрано" leafOnly disabled={serviceLocked || form.status !== "used"} />
                <FormControl size="small" fullWidth disabled={serviceLocked || form.status !== "used" || !selectedEquipment}><InputLabel>Интерфейс</InputLabel><Select label="Интерфейс" value={form.equipment_interface_id} onChange={(e) => setForm((prev) => ({ ...prev, equipment_interface_id: String(e.target.value) }))}>{(selectedEquipment?.network_interfaces || []).map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.interface_name}</MenuItem>)}</Select></FormControl>
                <AppButton startIcon={<SaveRoundedIcon />} variant="contained" color="success" onClick={() => saveAddressMutation.mutate()} disabled={!canOperate || serviceLocked || saveAddressMutation.isPending}>✓ Сохранить</AppButton>
                <Box sx={{ display: "grid", gap: 0.5, pt: 1, borderTop: `1px solid ${ui.panelBorder}` }}>
                  <Typography sx={{ display: "flex", justifyContent: "space-between", color: ui.muted }}><span>Offset</span><span>{`.${addressQuery.data.ip_offset}`}</span></Typography>
                  <Typography sx={{ display: "flex", justifyContent: "space-between", color: ui.muted }}><span>Сеть</span><span>{selectedSubnet?.cidr || "-"}</span></Typography>
                  <Typography sx={{ display: "flex", justifyContent: "space-between", color: ui.muted }}><span>Шлюз</span><span>{selectedSubnet?.gateway_ip || "-"}</span></Typography>
                </Box>
              </>
            ) : <Typography sx={{ color: ui.muted }}>Выберите адрес в сетке или таблице.</Typography>}
          </CardContent>
        </Card>
      </Box>

      <Dialog open={calculatorOpen} onClose={() => setCalculatorOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: ui.dialogBg, color: ui.text, border: `1px solid ${ui.panelBorder}` } }}>
        <DialogTitle>IP-калькулятор</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0,1fr) 96px" }}>
            <TextField label="Сетевой адрес" value={calculator.network_address_input} onChange={(e) => setCalculator((prev) => ({ ...prev, network_address_input: e.target.value }))} />
            <TextField label="CIDR" value={calculator.cidr} onChange={(e) => setCalculator((prev) => ({ ...prev, cidr: e.target.value }))} />
          </Box>
          <AppButton variant="contained" onClick={() => { setCalculatorDone(true); if (calc && !calculator.gateway_ip) setCalculator((prev) => ({ ...prev, gateway_ip: calc.firstHost })); }} disabled={!calc}>⚡ Вычислить</AppButton>
          {calculatorDone && calc ? (
            <>
              <Box sx={{ borderRadius: 3, border: `1px solid ${ui.panelBorder}`, bgcolor: ui.calcBg, p: 2, display: "grid", gap: 1, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                <Typography>Адрес сети<br />{`${calc.network}/${calc.cidr}`}</Typography>
                <Typography>Маска<br />{calc.mask}</Typography>
                <Typography>Шлюз (1й хост)<br />{calc.firstHost}</Typography>
                <Typography>Broadcast<br />{calc.broadcast}</Typography>
                <Typography>Последний хост<br />{calc.lastHost}</Typography>
                <Typography>Кол-во хостов<br />{calc.hosts}</Typography>
                <Typography>Всего адресов<br />{calc.total}</Typography>
                <Typography>Тип<br />{calc.size}</Typography>
              </Box>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                <TextField label="Название подсети *" value={calculator.name} onChange={(e) => setCalculator((prev) => ({ ...prev, name: e.target.value }))} />
                <FormControl fullWidth><InputLabel>VLAN</InputLabel><Select label="VLAN" value={calculator.vlan_id} onChange={(e) => setCalculator((prev) => ({ ...prev, vlan_id: String(e.target.value) }))}><MenuItem value="">Не выбрано</MenuItem>{vlans.map((item) => <MenuItem key={item.id} value={String(item.id)}>{`VLAN ${item.vlan_number} / ${item.name}`}</MenuItem>)}</Select></FormControl>
                <TextField label={`Шлюз (по умолч. ${calc.firstHost})`} value={calculator.gateway_ip} onChange={(e) => setCalculator((prev) => ({ ...prev, gateway_ip: e.target.value }))} />
                <FormControl fullWidth><InputLabel>Локация</InputLabel><Select label="Локация" value={calculator.location_id} onChange={(e) => setCalculator((prev) => ({ ...prev, location_id: String(e.target.value) }))}><MenuItem value="">Не выбрано</MenuItem>{locationOptions.map((item) => <MenuItem key={item.value} value={String(item.value)}>{item.label}</MenuItem>)}</Select></FormControl>
                <TextField label="VRF" value={calculator.vrf} onChange={(e) => setCalculator((prev) => ({ ...prev, vrf: e.target.value }))} />
                <TextField label="Описание" value={calculator.description} onChange={(e) => setCalculator((prev) => ({ ...prev, description: e.target.value }))} />
              </Box>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <AppButton onClick={() => setCalculatorOpen(false)}>Отмена</AppButton>
          <AppButton variant="contained" onClick={() => createSubnetMutation.mutate()} disabled={!calculatorDone || !calc || !calculator.name.trim() || createSubnetMutation.isPending}>✓ Создать подсеть</AppButton>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(vlanDialog)} onClose={() => setVlanDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: ui.dialogBg, color: ui.text, border: `1px solid ${ui.panelBorder}` } }}>
        <DialogTitle>{vlanDialog?.mode === "edit" ? "Редактирование VLAN" : "Создание VLAN"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          <TextField label="Номер VLAN" type="number" value={vlanDialog?.vlan_number || ""} onChange={(e) => setVlanDialog((prev) => (prev ? { ...prev, vlan_number: e.target.value } : prev))} />
          <TextField label="Название" value={vlanDialog?.name || ""} onChange={(e) => setVlanDialog((prev) => (prev ? { ...prev, name: e.target.value } : prev))} />
          <TextField label="Назначение" value={vlanDialog?.purpose || ""} onChange={(e) => setVlanDialog((prev) => (prev ? { ...prev, purpose: e.target.value } : prev))} />
          <TextField label="Описание" value={vlanDialog?.description || ""} onChange={(e) => setVlanDialog((prev) => (prev ? { ...prev, description: e.target.value } : prev))} multiline minRows={3} />
          <FormControl fullWidth><InputLabel>Локация</InputLabel><Select label="Локация" value={vlanDialog?.location_id || ""} onChange={(e) => setVlanDialog((prev) => (prev ? { ...prev, location_id: String(e.target.value) } : prev))}><MenuItem value="">Не выбрано</MenuItem>{locationOptions.map((item) => <MenuItem key={item.value} value={String(item.value)}>{item.label}</MenuItem>)}</Select></FormControl>
          <FormControl fullWidth><InputLabel>Статус</InputLabel><Select label="Статус" value={vlanDialog?.is_active || "true"} onChange={(e) => setVlanDialog((prev) => (prev ? { ...prev, is_active: String(e.target.value) } : prev))}><MenuItem value="true">Активен</MenuItem><MenuItem value="false">Неактивен</MenuItem></Select></FormControl>
        </DialogContent>
        <DialogActions>
          <AppButton onClick={() => setVlanDialog(null)}>Отмена</AppButton>
          <AppButton variant="contained" onClick={() => vlanMutation.mutate()} disabled={!vlanDialog?.vlan_number.trim() || !vlanDialog?.name.trim() || vlanMutation.isPending}>Сохранить</AppButton>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(subnetDialog)} onClose={() => setSubnetDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: ui.dialogBg, color: ui.text, border: `1px solid ${ui.panelBorder}` } }}>
        <DialogTitle>Редактирование подсети</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          <TextField label="CIDR" value={subnetDialog?.cidr || ""} InputProps={{ readOnly: true }} helperText="CIDR недоступен для редактирования" />
          <FormControl fullWidth><InputLabel>VLAN</InputLabel><Select label="VLAN" value={subnetDialog?.vlan_id || ""} onChange={(e) => setSubnetDialog((prev) => (prev ? { ...prev, vlan_id: String(e.target.value) } : prev))}><MenuItem value="">Не выбрано</MenuItem>{vlans.map((item) => <MenuItem key={item.id} value={String(item.id)}>{`VLAN ${item.vlan_number} / ${item.name}`}</MenuItem>)}</Select></FormControl>
          <TextField label="Шлюз" value={subnetDialog?.gateway_ip || ""} onChange={(e) => setSubnetDialog((prev) => (prev ? { ...prev, gateway_ip: e.target.value } : prev))} />
          <TextField label="Название" value={subnetDialog?.name || ""} onChange={(e) => setSubnetDialog((prev) => (prev ? { ...prev, name: e.target.value } : prev))} />
          <TextField label="Описание" value={subnetDialog?.description || ""} onChange={(e) => setSubnetDialog((prev) => (prev ? { ...prev, description: e.target.value } : prev))} multiline minRows={3} />
          <FormControl fullWidth><InputLabel>Локация</InputLabel><Select label="Локация" value={subnetDialog?.location_id || ""} onChange={(e) => setSubnetDialog((prev) => (prev ? { ...prev, location_id: String(e.target.value) } : prev))}><MenuItem value="">Не выбрано</MenuItem>{locationOptions.map((item) => <MenuItem key={item.value} value={String(item.value)}>{item.label}</MenuItem>)}</Select></FormControl>
          <TextField label="VRF" value={subnetDialog?.vrf || ""} onChange={(e) => setSubnetDialog((prev) => (prev ? { ...prev, vrf: e.target.value } : prev))} />
          <FormControl fullWidth><InputLabel>Статус</InputLabel><Select label="Статус" value={subnetDialog?.is_active || "true"} onChange={(e) => setSubnetDialog((prev) => (prev ? { ...prev, is_active: String(e.target.value) } : prev))}><MenuItem value="true">Активна</MenuItem><MenuItem value="false">Неактивна</MenuItem></Select></FormControl>
        </DialogContent>
        <DialogActions>
          <AppButton onClick={() => setSubnetDialog(null)}>Отмена</AppButton>
          <AppButton variant="contained" onClick={() => subnetMutation.mutate()} disabled={subnetMutation.isPending}>Сохранить</AppButton>
        </DialogActions>
      </Dialog>

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
