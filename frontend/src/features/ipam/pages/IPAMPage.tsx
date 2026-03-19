import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { ErrorSnackbar } from "../../../components/ErrorSnackbar";
import { SearchableTreeSelectField, type SearchableTreeSelectOption } from "../../../components/SearchableTreeSelectField";
import { AppButton } from "../../../components/ui/AppButton";
import { useAuth } from "../../../context/AuthContext";
import { buildLocationLookups, fetchLocationsTree } from "../../../utils/locations";
import { assignAddress, createSubnetFromCalculator, exportSubnetCsv, getAddressDetails, getHostEquipmentTree, getSubnetAddresses, listSubnets, listVlans, patchAddress, releaseAddress } from "../api/ipam";
import type { HostEquipmentTreeLeaf, HostEquipmentTreeNode, IPAddressDetails } from "../types";

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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const canOperate = user?.role === "admin" || user?.role === "engineer";
  const canAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sidebarTab, setSidebarTab] = useState<"subnets" | "vlans">("subnets");
  const [selectedSubnetId, setSelectedSubnetId] = useState<number | null>(Number(params.get("subnet_id") || 0) || null);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(params.get("offset") ? Number(params.get("offset")) : null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorDone, setCalculatorDone] = useState(false);
  const [calculator, setCalculator] = useState({ network_address_input: "10.10.0.0", cidr: "24", name: "", vlan_id: "", gateway_ip: "", description: "", location_id: "", vrf: "" });
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
    qc.invalidateQueries({ queryKey: ["ipam-subnets"] });
    qc.invalidateQueries({ queryKey: ["ipam-grid"] });
    qc.invalidateQueries({ queryKey: ["ipam-list"] });
    qc.invalidateQueries({ queryKey: ["ipam-address"] });
    qc.invalidateQueries({ queryKey: ["ipam-host-tree"] });
    qc.invalidateQueries({ queryKey: ["cabinet-item-ipam-summary"] });
  };

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
        <Stack direction="row" spacing={1}>
          {canAdmin ? <AppButton startIcon={<AddRoundedIcon />} variant="contained" onClick={() => setCalculatorOpen(true)}>+ Подсеть</AppButton> : null}
          <AppButton startIcon={<DownloadRoundedIcon />} variant="outlined" onClick={() => selectedSubnet && exportSubnetCsv(selectedSubnet.id)} disabled={!selectedSubnet}>CSV</AppButton>
        </Stack>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "270px minmax(0,1fr) 300px" } }}>
        <Card sx={{ bgcolor: "#0b1220", color: "#d3e8ff", border: `1px solid ${alpha("#7ea2d6", 0.14)}`, boxShadow: "none" }}>
          <CardContent sx={{ display: "grid", gap: 1.5 }}>
            <Stack direction="row" spacing={1}>
              <AppButton variant={sidebarTab === "subnets" ? "contained" : "outlined"} size="small" onClick={() => setSidebarTab("subnets")}>Подсети</AppButton>
              <AppButton variant={sidebarTab === "vlans" ? "contained" : "outlined"} size="small" onClick={() => setSidebarTab("vlans")}>VLAN</AppButton>
            </Stack>
            <TextField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск IP или хоста..." fullWidth />
            <Box sx={{ maxHeight: 760, overflowY: "auto", display: "grid", gap: 1 }}>
              {subnetsQuery.isLoading || vlansQuery.isLoading ? <Box sx={{ py: 6, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box> : null}
              {sidebarTab === "subnets" ? subnets.map((item) => (
                <Box key={item.id} onClick={() => pickSubnet(item.id)} sx={{ p: 1.4, borderRadius: 2, cursor: "pointer", border: `1px solid ${selectedSubnet?.id === item.id ? alpha("#5ea8ff", 0.6) : alpha("#7ea2d6", 0.12)}`, bgcolor: selectedSubnet?.id === item.id ? alpha("#153250", 0.6) : "#0f1728" }}>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 700, color: "#8fd0ff" }}>{item.cidr}</Typography>{item.vlan_number ? <Chip size="small" label={`V${item.vlan_number}`} sx={{ bgcolor: alpha("#4b79b7", 0.18), color: "#7ebeff" }} /> : null}</Stack>
                  <Typography sx={{ mt: 0.5 }}>{item.name || "Без названия"}</Typography>
                  <Typography sx={{ mt: 0.25, fontSize: 12, color: "#6d88aa" }}>{item.description || item.vlan_name || "Без описания"}</Typography>
                </Box>
              )) : vlans.map((item) => (
                <Box key={item.id} onClick={() => { const subnet = subnets.find((subnetItem) => subnetItem.vlan_id === item.id); if (subnet) pickSubnet(subnet.id); }} sx={{ p: 1.4, borderRadius: 2, cursor: "pointer", border: `1px solid ${alpha("#7ea2d6", 0.12)}`, bgcolor: "#0f1728" }}>
                  <Typography sx={{ fontWeight: 700, color: "#8fd0ff" }}>{`VLAN ${item.vlan_number}`}</Typography>
                  <Typography sx={{ mt: 0.5 }}>{item.name}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: "#0b1220", color: "#d3e8ff", border: `1px solid ${alpha("#7ea2d6", 0.14)}`, boxShadow: "none" }}>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#8fd0ff" }}>{selectedSubnet?.cidr || "Подсеть не выбрана"}</Typography>
                <Typography sx={{ color: "#6d88aa" }}>{selectedSubnet?.name || selectedSubnet?.description || "Выберите подсеть слева"}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha("#5b9a57", 0.12), minWidth: 92 }}><Typography sx={{ fontSize: 28, fontWeight: 800, color: "#5b9a57" }}>{gridQuery.data?.summary.free || 0}</Typography><Typography sx={{ fontSize: 11, color: "#6d88aa" }}>Свободно</Typography></Box>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha("#b85050", 0.12), minWidth: 92 }}><Typography sx={{ fontSize: 28, fontWeight: 800, color: "#b85050" }}>{gridQuery.data?.summary.used || 0}</Typography><Typography sx={{ fontSize: 11, color: "#6d88aa" }}>Занято</Typography></Box>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha("#b19239", 0.12), minWidth: 92 }}><Typography sx={{ fontSize: 28, fontWeight: 800, color: "#b19239" }}>{gridQuery.data?.summary.reserved || 0}</Typography><Typography sx={{ fontSize: 11, color: "#6d88aa" }}>Резерв</Typography></Box>
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>{(["all", "free", "used", "reserved"] as StatusFilter[]).map((item) => <AppButton key={item} size="small" variant={status === item ? "contained" : "outlined"} onClick={() => setStatus(item)}>{item === "all" ? "все" : item === "free" ? "своб." : item === "used" ? "занят." : "резерв"}</AppButton>)}</Stack>
            {selectedSubnet && selectedSubnet.prefix !== 24 ? <Alert severity="info">Для {selectedSubnet.cidr} показаны первые 256 адресов из {gridQuery.data?.summary.total || 0}.</Alert> : null}
            <Box sx={{ borderRadius: 3, border: `1px solid ${alpha("#7ea2d6", 0.14)}`, bgcolor: "#0f1728", p: 1, overflow: "auto" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(16, 28px)", gap: 0.5, width: "max-content" }}>
                {gridItems.map((item) => <Box key={`${item.subnet_id}:${item.ip_offset}`} title={`${item.ip_address}${item.hostname ? ` · ${item.hostname}` : ""} (${item.status})`} onClick={() => pickAddress(item)} sx={{ width: 28, height: 28, borderRadius: 0.75, cursor: "pointer", bgcolor: tones[item.status].bg, border: `2px solid ${selectedOffset === item.ip_offset ? "#d8edff" : alpha("#ffffff", 0.06)}`, "&:hover": { filter: "brightness(1.18)" } }} />)}
              </Box>
            </Box>
            <Box sx={{ borderRadius: 3, border: `1px solid ${alpha("#7ea2d6", 0.14)}`, overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.1, display: "flex", justifyContent: "space-between", bgcolor: "#111a2c" }}><Typography sx={{ fontSize: 12, color: "#6d88aa" }}>СПИСОК АДРЕСОВ</Typography><Typography sx={{ fontSize: 12, color: "#6d88aa" }}>{rows.length} записей</Typography></Box>
              <Box sx={{ maxHeight: 360, overflow: "auto" }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell sx={{ bgcolor: "#111a2c", color: "#6d88aa" }}>IP</TableCell><TableCell sx={{ bgcolor: "#111a2c", color: "#6d88aa" }}>Статус</TableCell><TableCell sx={{ bgcolor: "#111a2c", color: "#6d88aa" }}>Хост</TableCell><TableCell sx={{ bgcolor: "#111a2c", color: "#6d88aa" }}>Offset</TableCell></TableRow></TableHead>
                  <TableBody>{rows.map((item) => <TableRow key={`${item.subnet_id}:${item.ip_offset}:row`} hover selected={selectedOffset === item.ip_offset} onClick={() => pickAddress(item)} sx={{ cursor: "pointer" }}><TableCell sx={{ color: "#cfe7ff", fontWeight: 700 }}>{item.ip_address}</TableCell><TableCell><Chip size="small" label={item.status} sx={{ bgcolor: tones[item.status].bg, color: tones[item.status].fg }} /></TableCell><TableCell sx={{ color: "#b3c7e6" }}>{item.hostname || "—"}</TableCell><TableCell sx={{ color: "#7ea2d6" }}>{`.${item.ip_offset}`}</TableCell></TableRow>)}</TableBody>
                </Table>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: "#0b1220", color: "#d3e8ff", border: `1px solid ${alpha("#7ea2d6", 0.14)}`, boxShadow: "none" }}>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            {addressQuery.data ? (
              <>
                <Typography sx={{ fontSize: 12, color: "#6d88aa" }}>IP-АДРЕС</Typography>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: "#79d4ff" }}>{addressQuery.data.ip_address}</Typography>
                <FormControl size="small" fullWidth disabled={serviceLocked}><InputLabel>Статус</InputLabel><Select label="Статус" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as EditStatus }))}><MenuItem value="free">свободен</MenuItem><MenuItem value="used">занят</MenuItem><MenuItem value="reserved">резерв</MenuItem><MenuItem value="service">служ.</MenuItem></Select></FormControl>
                <TextField size="small" label="Имя хоста" value={form.hostname} onChange={(e) => setForm((prev) => ({ ...prev, hostname: e.target.value }))} disabled={serviceLocked} />
                <TextField size="small" label="DNS" value={form.dns_name} onChange={(e) => setForm((prev) => ({ ...prev, dns_name: e.target.value }))} disabled={serviceLocked} />
                <TextField size="small" label="MAC" value={form.mac_address} onChange={(e) => setForm((prev) => ({ ...prev, mac_address: e.target.value }))} disabled={serviceLocked} />
                <TextField size="small" label="Комментарий" value={form.comment} onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))} disabled={serviceLocked} multiline minRows={3} />
                <SearchableTreeSelectField label="Хост / оборудование" value={form.equipment_value} options={hostOptions} onChange={(next) => setForm((prev) => ({ ...prev, equipment_value: String(next), equipment_interface_id: "" }))} emptyOptionLabel="Не выбрано" leafOnly disabled={serviceLocked || form.status !== "used"} />
                <FormControl size="small" fullWidth disabled={serviceLocked || form.status !== "used" || !selectedEquipment}><InputLabel>Интерфейс</InputLabel><Select label="Интерфейс" value={form.equipment_interface_id} onChange={(e) => setForm((prev) => ({ ...prev, equipment_interface_id: String(e.target.value) }))}>{(selectedEquipment?.network_interfaces || []).map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.interface_name}</MenuItem>)}</Select></FormControl>
                <AppButton startIcon={<SaveRoundedIcon />} variant="contained" color="success" onClick={() => saveAddressMutation.mutate()} disabled={!canOperate || serviceLocked || saveAddressMutation.isPending}>✓ Сохранить</AppButton>
                <Box sx={{ display: "grid", gap: 0.5, pt: 1, borderTop: `1px solid ${alpha("#7ea2d6", 0.12)}` }}>
                  <Typography sx={{ display: "flex", justifyContent: "space-between", color: "#6d88aa" }}><span>Offset</span><span>{`.${addressQuery.data.ip_offset}`}</span></Typography>
                  <Typography sx={{ display: "flex", justifyContent: "space-between", color: "#6d88aa" }}><span>Сеть</span><span>{selectedSubnet?.cidr || "-"}</span></Typography>
                  <Typography sx={{ display: "flex", justifyContent: "space-between", color: "#6d88aa" }}><span>Шлюз</span><span>{selectedSubnet?.gateway_ip || "-"}</span></Typography>
                </Box>
              </>
            ) : <Typography sx={{ color: "#6d88aa" }}>Выберите адрес в сетке или таблице.</Typography>}
          </CardContent>
        </Card>
      </Box>

      <Dialog open={calculatorOpen} onClose={() => setCalculatorOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: "#162132", color: "#d3e8ff", border: `1px solid ${alpha("#7ea2d6", 0.14)}` } }}>
        <DialogTitle>IP-калькулятор</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0,1fr) 96px" }}>
            <TextField label="Сетевой адрес" value={calculator.network_address_input} onChange={(e) => setCalculator((prev) => ({ ...prev, network_address_input: e.target.value }))} />
            <TextField label="CIDR" value={calculator.cidr} onChange={(e) => setCalculator((prev) => ({ ...prev, cidr: e.target.value }))} />
          </Box>
          <AppButton variant="contained" onClick={() => { setCalculatorDone(true); if (calc && !calculator.gateway_ip) setCalculator((prev) => ({ ...prev, gateway_ip: calc.firstHost })); }} disabled={!calc}>⚡ Вычислить</AppButton>
          {calculatorDone && calc ? (
            <>
              <Box sx={{ borderRadius: 3, border: `1px solid ${alpha("#7ea2d6", 0.14)}`, bgcolor: "#0d1727", p: 2, display: "grid", gap: 1, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
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

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
