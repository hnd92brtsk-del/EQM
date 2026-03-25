import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { LOOKUP_QUERY_STALE_TIME } from "../api/queryDefaults";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { buildLocationLookups, fetchLocationsTree } from "../utils/locations";
import { ProtectedImage } from "../components/ProtectedImage";
import { ProtectedDownloadLink } from "../components/ProtectedDownloadLink";
import { getCabinetItemIPAMSummary } from "../features/ipam/api/ipam";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { SearchableSelectField } from "../components/SearchableSelectField";
import { DigitalTwinIcon } from "../icons";

const InfoRow = ({ label, value }: { label: string; value?: ReactNode }) => {
  const displayValue = value === null || value === undefined || value === "" ? "-" : value;
  return (
    <Box sx={{ display: "grid" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{displayValue}</Typography>
    </Box>
  );
};

const formatNetworkPorts = (ports: { type: string; count: number }[] | null | undefined): string => {
  if (!Array.isArray(ports) || ports.length === 0) {
    return "-";
  }
  const formatted = ports
    .filter((item) => item?.type)
    .map((item) => `${item.type}[${item.count ?? 0}]`)
    .filter(Boolean);
  return formatted.length ? formatted.join(", ") : "-";
};

const formatSerialPorts = (ports: { type: string; count: number }[] | null | undefined): string => {
  if (!Array.isArray(ports) || ports.length === 0) {
    return "-";
  }
  const formatted = ports
    .filter((item) => item?.type)
    .map((item) => {
      const count = Number(item.count ?? 0);
      return count > 0 ? `${item.type}-${count}` : item.type;
    })
    .filter(Boolean);
  return formatted.length ? formatted.join(", ") : "-";
};

const getFileIcon = (filename?: string | null) => {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "pdf":
      return <PictureAsPdfRoundedIcon fontSize="small" />;
    case "xlsx":
      return <TableChartRoundedIcon fontSize="small" />;
    case "doc":
    case "docx":
      return <DescriptionRoundedIcon fontSize="small" />;
    default:
      return <InsertDriveFileOutlinedIcon fontSize="small" />;
  }
};

type EquipmentInOperationItem = {
  id: number;
  source: "cabinet" | "assembly";
  container_id: number;
  container_name: string;
  container_factory_number?: string | null;
  container_inventory_number?: string | null;
  equipment_type_id: number;
  quantity: number;
  is_deleted: boolean;
  equipment_type_name?: string | null;
  equipment_type_article?: string | null;
  equipment_type_inventory_number?: string | null;
  equipment_type_photo_url?: string | null;
  equipment_type_datasheet_url?: string | null;
  equipment_type_datasheet_name?: string | null;
  network_ports?: { type: string; count: number }[] | null;
  serial_ports?: { type: string; count: number }[] | null;
  is_channel_forming?: boolean;
  channel_count?: number | null;
  can_edit_quantity?: boolean;
  manufacturer_name?: string | null;
  location_full_path?: string | null;
  created_at?: string;
};

type EquipmentInOperationContainer = {
  source: "cabinet" | "assembly";
  container_id: number;
  container_name: string;
  container_factory_number?: string | null;
  container_inventory_number?: string | null;
  location_full_path?: string | null;
  container_is_deleted: boolean;
  is_empty: boolean;
  quantity_sum: number;
  active_items_count: number;
  deleted_items_count: number;
  equipment_type_name_sort?: string | null;
  manufacturer_name_sort?: string | null;
  created_at?: string | null;
};

type EquipmentInOperationLocationNode = {
  location_id: number;
  location_name: string;
  location_full_path: string;
  active_containers_count: number;
  deleted_containers_count: number;
  quantity_sum: number;
  children: EquipmentInOperationLocationNode[];
  containers: EquipmentInOperationContainer[];
};

type Cabinet = { id: number; name: string };
type Assembly = { id: number; name: string };
type PowerRole = "source" | "consumer" | "converter" | "passive";
type PowerAttributes = {
  role_in_power_chain?: PowerRole | null;
  current_type?: string | null;
  supply_voltage?: string | null;
  top_current_type?: string | null;
  top_supply_voltage?: string | null;
  bottom_current_type?: string | null;
  bottom_supply_voltage?: string | null;
  current_value_a?: number | null;
};

type EquipmentType = {
  id: number;
  name: string;
  is_channel_forming: boolean;
  is_network: boolean;
  has_serial_interfaces: boolean;
  role_in_power_chain?: PowerRole | null;
  power_attributes?: PowerAttributes | null;
  channel_count?: number | null;
  ai_count?: number | null;
  di_count?: number | null;
  ao_count?: number | null;
  do_count?: number | null;
};

type Manufacturer = { id: number; name: string };

type CabinetItemIPAMSummary = {
  eligible_for_ipam: boolean;
  network_interfaces_count: number;
  linked_ip_addresses: string[];
  linked_subnets: string[];
  current_ip_links_count: number;
};

type EquipmentGroup = {
  key: string;
  equipment_type_id: number;
  equipment_type_name: string;
  manufacturer_name: string;
  article: string;
  inventory_number: string;
  photo_url?: string | null;
  datasheet_url?: string | null;
  datasheet_name?: string | null;
  network_ports?: { type: string; count: number }[] | null;
  serial_ports?: { type: string; count: number }[] | null;
  is_channel_forming?: boolean;
  channel_count?: number | null;
  can_edit_quantity: boolean;
  quantity_sum: number;
  items: EquipmentInOperationItem[];
};

type DetailFilters = {
  q: string;
  showDeleted: boolean;
  equipmentFilter: number | "";
  manufacturerFilter: number | "";
  locationFilter: number | "";
};

type ExpandedGroupKeysByContainer = Record<string, string[]>;

const getContainerKey = (container: Pick<EquipmentInOperationContainer, "source" | "container_id">) =>
  `${container.source}:${container.container_id}`;

const powerRoleLabels: Record<PowerRole, string> = {
  source: "Источник",
  consumer: "Потребитель",
  converter: "Преобразователь",
  passive: "Пассивный"
};

function formatEquipmentPowerSummary(equipment?: EquipmentType | null): string {
  const role = equipment?.power_attributes?.role_in_power_chain || equipment?.role_in_power_chain;
  if (!role) {
    return "Питание: не задано";
  }
  if (role === "passive") {
    return `Питание: ${powerRoleLabels[role]}`;
  }
  if (role === "converter") {
    const attrs = equipment?.power_attributes;
    return [
      `Питание: ${powerRoleLabels[role]}`,
      `верх ${attrs?.top_current_type || "-"} ${attrs?.top_supply_voltage || "-"}`,
      `низ ${attrs?.bottom_current_type || "-"} ${attrs?.bottom_supply_voltage || "-"}`,
      `ток ${attrs?.current_value_a ?? "-"} А`
    ].join(" | ");
  }
  const attrs = equipment?.power_attributes;
  return [
    `Питание: ${powerRoleLabels[role]}`,
    attrs?.current_type || "-",
    attrs?.supply_voltage || "-",
    `${attrs?.current_value_a ?? "-"} А`
  ].join(" | ");
}

function collectLocationIds(nodes: EquipmentInOperationLocationNode[]): number[] {
  return nodes.flatMap((node) => [node.location_id, ...collectLocationIds(node.children)]);
}

function collectContainers(nodes: EquipmentInOperationLocationNode[]): EquipmentInOperationContainer[] {
  return nodes.flatMap((node) => [...node.containers, ...collectContainers(node.children)]);
}

function buildEquipmentGroups(
  items: EquipmentInOperationItem[],
  equipmentMap: Map<number, string>,
  language: string
): EquipmentGroup[] {
  const equipmentGroupsMap = new Map<string, EquipmentGroup>();

  items.forEach((item) => {
    const equipmentName =
      item.equipment_type_name || equipmentMap.get(item.equipment_type_id) || String(item.equipment_type_id);
    const manufacturerName = item.manufacturer_name || "-";
    const isUniqueInstance = item.can_edit_quantity === false;
    const groupKey = isUniqueInstance
      ? `${item.equipment_type_id}:${item.source}:${item.id}`
      : String(item.equipment_type_id || equipmentName);
    let equipmentGroup = equipmentGroupsMap.get(groupKey);

    if (!equipmentGroup) {
      equipmentGroup = {
        key: groupKey,
        equipment_type_id: item.equipment_type_id,
        equipment_type_name: equipmentName,
        manufacturer_name: manufacturerName,
        article: item.equipment_type_article || "-",
        inventory_number: item.equipment_type_inventory_number || "-",
        photo_url: item.equipment_type_photo_url || null,
        datasheet_url: item.equipment_type_datasheet_url || null,
        datasheet_name: item.equipment_type_datasheet_name || null,
        network_ports: item.network_ports,
        serial_ports: item.serial_ports,
        is_channel_forming: item.is_channel_forming,
        channel_count: item.channel_count ?? null,
        can_edit_quantity: item.can_edit_quantity ?? true,
        quantity_sum: 0,
        items: []
      };
      equipmentGroupsMap.set(groupKey, equipmentGroup);
    }

    equipmentGroup.can_edit_quantity = equipmentGroup.can_edit_quantity && (item.can_edit_quantity ?? true);
    if (item.is_channel_forming) {
      equipmentGroup.is_channel_forming = true;
    }
    if (item.channel_count !== undefined && item.channel_count !== null) {
      equipmentGroup.channel_count = item.channel_count;
    }
    equipmentGroup.quantity_sum += item.quantity || 0;
    equipmentGroup.items.push(item);
  });

  return Array.from(equipmentGroupsMap.values()).sort((a, b) =>
    a.equipment_type_name.localeCompare(b.equipment_type_name, language)
  );
}

async function fetchAllEquipmentInOperationItems(params: {
  q?: string;
  is_deleted: boolean;
  cabinet_id?: number;
  assembly_id?: number;
  equipment_type_id?: number;
  manufacturer_id?: number;
  location_id?: number;
}): Promise<EquipmentInOperationItem[]> {
  const pageSize = 200;
  let page = 1;
  let items: EquipmentInOperationItem[] = [];

  while (true) {
    const response = await listEntity<EquipmentInOperationItem>("/equipment-in-operation", {
      page,
      page_size: pageSize,
      q: params.q,
      is_deleted: params.is_deleted,
      filters: {
        cabinet_id: params.cabinet_id,
        assembly_id: params.assembly_id,
        equipment_type_id: params.equipment_type_id,
        manufacturer_id: params.manufacturer_id,
        location_id: params.location_id
      }
    });
    items = items.concat(response.items);
    if (items.length >= response.total) {
      break;
    }
    page += 1;
  }

  return items;
}

async function fetchEquipmentInOperationTree(params: {
  q?: string;
  sort?: string;
  is_deleted: boolean;
  include_deleted?: boolean;
  cabinet_id?: number;
  assembly_id?: number;
  equipment_type_id?: number;
  manufacturer_id?: number;
  location_id?: number;
}): Promise<EquipmentInOperationLocationNode[]> {
  const search = new URLSearchParams();
  if (params.q) {
    search.set("q", params.q);
  }
  if (params.sort) {
    search.set("sort", params.sort);
  }
  search.set("is_deleted", String(params.is_deleted));
  if (params.include_deleted) {
    search.set("include_deleted", "true");
  }
  if (params.cabinet_id) {
    search.set("cabinet_id", String(params.cabinet_id));
  }
  if (params.assembly_id) {
    search.set("assembly_id", String(params.assembly_id));
  }
  if (params.equipment_type_id) {
    search.set("equipment_type_id", String(params.equipment_type_id));
  }
  if (params.manufacturer_id) {
    search.set("manufacturer_id", String(params.manufacturer_id));
  }
  if (params.location_id) {
    search.set("location_id", String(params.location_id));
  }

  const query = search.toString();
  return apiFetch<EquipmentInOperationLocationNode[]>(`/equipment-in-operation/tree${query ? `?${query}` : ""}`);
}

function IPAMSummaryBlock({
  itemId,
  visible,
  onOpenIPAM
}: {
  itemId: number;
  visible: boolean;
  onOpenIPAM: () => void;
}) {
  const { t } = useTranslation();
  const summaryQuery = useQuery({
    queryKey: ["cabinet-item-ipam-summary", itemId],
    enabled: visible,
    queryFn: () => getCabinetItemIPAMSummary(itemId)
  });

  if (!visible || summaryQuery.isLoading || !summaryQuery.data) {
    return null;
  }

  const summary = summaryQuery.data as CabinetItemIPAMSummary;
  if (!summary.eligible_for_ipam && summary.current_ip_links_count === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        mt: 2,
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        display: "grid",
        gap: 1
      }}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <Typography variant="subtitle2">{t("pagesUi.cabinetItems.ipam.title")}</Typography>
        <Chip
          size="small"
          color={summary.eligible_for_ipam ? "success" : "default"}
          label={
            summary.eligible_for_ipam
              ? t("pagesUi.cabinetItems.ipam.eligible")
              : t("pagesUi.cabinetItems.ipam.notEligible")
          }
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {t("pagesUi.cabinetItems.ipam.interfaces", { count: summary.network_interfaces_count })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("pagesUi.cabinetItems.ipam.ipCount", { count: summary.current_ip_links_count })}
      </Typography>
      {summary.linked_ip_addresses.length ? (
        <Typography variant="body2">{summary.linked_ip_addresses.join(", ")}</Typography>
      ) : null}
      <Box>
        <AppButton variant="outlined" size="small" onClick={onOpenIPAM}>
          {t("pagesUi.cabinetItems.ipam.open")}
        </AppButton>
      </Box>
    </Box>
  );
}

function StatCell({
  label,
  value,
  color = "text.primary"
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <Box sx={{ display: "grid", justifyItems: "end", minWidth: 88 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, textAlign: "right" }} color={color}>
        {value}
      </Typography>
    </Box>
  );
}

function ContainerAccordion({
  container,
  expanded,
  onExpandedChange,
  expandedGroupKeys,
  onExpandedGroupKeysChange,
  canWrite,
  detailFilters,
  equipmentMap,
  equipmentFlagsMap,
  onEditItem,
  onDeleteItem,
  onRestoreItem,
  onAddToCabinet,
  equipmentOptions,
  onErrorMessage
}: {
  container: EquipmentInOperationContainer;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  expandedGroupKeys: string[];
  onExpandedGroupKeysChange: (groupKeys: string[]) => void;
  canWrite: boolean;
  detailFilters: DetailFilters;
  equipmentMap: Map<number, string>;
  equipmentFlagsMap: Map<number, EquipmentType>;
  onEditItem: (item: EquipmentInOperationItem) => void;
  onDeleteItem: (item: EquipmentInOperationItem) => void;
  onRestoreItem: (item: EquipmentInOperationItem) => void;
  onAddToCabinet: (payload: { cabinetId: number; equipmentTypeId: number; quantity: number }) => void;
  equipmentOptions: { value: number; label: string }[];
  onErrorMessage: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | "">("");
  const [inlineQuantity, setInlineQuantity] = useState(1);

  const detailQuery = useQuery({
    queryKey: [
      "equipment-in-operation-container-items",
      container.source,
      container.container_id,
      detailFilters.showDeleted,
      detailFilters.q,
      detailFilters.equipmentFilter,
      detailFilters.manufacturerFilter,
      detailFilters.locationFilter
    ],
    enabled: expanded,
    queryFn: () =>
      fetchAllEquipmentInOperationItems({
        q: detailFilters.q || undefined,
        is_deleted: detailFilters.showDeleted ? true : false,
        cabinet_id: container.source === "cabinet" ? container.container_id : undefined,
        assembly_id: container.source === "assembly" ? container.container_id : undefined,
        equipment_type_id: detailFilters.equipmentFilter || undefined,
        manufacturer_id: detailFilters.manufacturerFilter || undefined,
        location_id: detailFilters.locationFilter || undefined
      })
  });

  useEffect(() => {
    if (detailQuery.error) {
      onErrorMessage(
        detailQuery.error instanceof Error ? detailQuery.error.message : t("pagesUi.cabinetItems.errors.load")
      );
    }
  }, [detailQuery.error, onErrorMessage, t]);

  const equipmentGroups = useMemo(
    () => buildEquipmentGroups(detailQuery.data || [], equipmentMap, i18n.language),
    [detailQuery.data, equipmentMap, i18n.language]
  );
  const selectedEquipment = selectedEquipmentId === "" ? undefined : equipmentFlagsMap.get(Number(selectedEquipmentId));
  const forceQtyOne = Boolean(
    selectedEquipment?.is_channel_forming || selectedEquipment?.is_network || selectedEquipment?.has_serial_interfaces
  );
  const effectiveQuantity = forceQtyOne ? 1 : inlineQuantity;
  const canAdd = container.source === "cabinet" && selectedEquipmentId !== "" && Number.isFinite(effectiveQuantity) && effectiveQuantity >= 1;

  const handleAddDialogOpen = () => {
    setAddDialogOpen(true);
    setSelectedEquipmentId("");
    setInlineQuantity(1);
  };

  const handleAddDialogClose = () => {
    setAddDialogOpen(false);
    setSelectedEquipmentId("");
    setInlineQuantity(1);
  };

  const handleAdd = () => {
    if (!canAdd) {
      onErrorMessage(t("validation.requiredFields"));
      return;
    }
    onAddToCabinet({
      cabinetId: container.container_id,
      equipmentTypeId: Number(selectedEquipmentId),
      quantity: effectiveQuantity
    });
    handleAddDialogClose();
  };

  return (
    <Accordion
      key={`${container.source}:${container.container_id}`}
      disableGutters
      expanded={expanded}
      onChange={(_, isExpanded) => onExpandedChange(isExpanded)}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        sx={{
          "& .MuiAccordionSummary-expandIconWrapper": {
            width: 36,
            justifyContent: "center"
          },
          "& .MuiAccordionSummary-content": {
            minWidth: 0
          }
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(220px, 1.2fr) minmax(140px, 0.7fr) minmax(160px, 0.8fr) minmax(220px, 1fr) auto"
            },
            gap: 1.5,
            alignItems: "center",
            width: "100%"
          }}
        >
          <Box sx={{ display: "grid", minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {container.container_name}
              </Typography>
              <AppButton
                size="small"
                variant="outlined"
                startIcon={<DigitalTwinIcon />}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(
                    container.source === "assembly"
                      ? `/assemblies/${container.container_id}/composition`
                      : `/cabinets/${container.container_id}/composition`
                  );
                }}
              >
                Открыть состав
              </AppButton>
              {container.container_is_deleted ? (
                <Chip size="small" color="warning" label={t("common.status.deleted")} />
              ) : null}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {container.source === "assembly" ? t("common.fields.assembly") : t("common.fields.cabinet")}
            </Typography>
          </Box>
          <Box sx={{ display: "grid" }}>
            <Typography variant="caption" color="text.secondary">
              {t("common.fields.factoryNumber")}
            </Typography>
            <Typography variant="body2">{container.container_factory_number || "-"}</Typography>
          </Box>
          <Box sx={{ display: "grid" }}>
            <Typography variant="caption" color="text.secondary">
              {t("common.fields.nomenclatureNumber")}
            </Typography>
            <Typography variant="body2">{container.container_inventory_number || "-"}</Typography>
          </Box>
          <Box sx={{ display: "grid" }}>
            <Typography variant="caption" color="text.secondary">
              {t("common.fields.location")}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {container.location_full_path || "-"}
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(3, minmax(88px, 1fr))", lg: "repeat(3, minmax(88px, auto))" },
              gap: 1.5,
              justifyContent: "end"
            }}
          >
            <StatCell label={t("common.status.active")} value={container.active_items_count} />
            <StatCell label={t("common.status.deleted")} value={container.deleted_items_count} />
            <StatCell label={t("common.fields.quantity")} value={container.quantity_sum} />
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {detailQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            {t("common.loading")}
          </Typography>
        ) : null}

        {!detailQuery.isLoading && (equipmentGroups.length > 0 || (container.source === "cabinet" && canWrite)) ? (
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
            {equipmentGroups.length > 0 ? (
              <>
                <AppButton
                  variant="outlined"
                  size="small"
                  onClick={() => onExpandedGroupKeysChange(equipmentGroups.map((group) => group.key))}
                >
                  {t("pagesUi.cabinetItems.actions.expandAll")}
                </AppButton>
                <AppButton variant="outlined" size="small" onClick={() => onExpandedGroupKeysChange([])}>
                  {t("pagesUi.cabinetItems.actions.collapseAll")}
                </AppButton>
              </>
            ) : null}
            {container.source === "cabinet" && canWrite ? (
              <Tooltip title={t("pagesUi.cabinetItems.inline.addTooltip")}>
                <span>
                  <IconButton
                    size="small"
                    onClick={handleAddDialogOpen}
                    sx={{
                      color: theme.palette.mode === "light" ? "common.black" : "common.white",
                      border: "1px solid",
                      borderColor: "divider"
                    }}
                  >
                    <AddRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </Box>
        ) : null}

        {!detailQuery.isLoading && equipmentGroups.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("pagesUi.cabinetItems.empty.container")}
          </Typography>
        ) : null}

        {!detailQuery.isLoading && equipmentGroups.length > 0 ? (
          <Box sx={{ display: "grid", gap: 1 }}>
            {equipmentGroups.map((group) => {
              const singleItem = group.items.length === 1 ? group.items[0] : null;
              const equipmentDetails = equipmentFlagsMap.get(group.equipment_type_id);
              const channelCount = group.channel_count ?? equipmentDetails?.channel_count ?? null;
              const aiCount = equipmentDetails?.ai_count ?? 0;
              const diCount = equipmentDetails?.di_count ?? 0;
              const aoCount = equipmentDetails?.ao_count ?? 0;
              const doCount = equipmentDetails?.do_count ?? 0;
              const channelParts: string[] = [];
              if (channelCount) {
                channelParts.push(`${t("common.fields.channelCount")}: ${channelCount}`);
              }
              if (aiCount || diCount || aoCount || doCount) {
                channelParts.push(`AI ${aiCount} / DI ${diCount} / AO ${aoCount} / DO ${doCount}`);
              }
              const channelValue = channelParts.length
                ? `${t("common.yes")}, ${channelParts.join(", ")}`
                : t("common.yes");

              return (
                <Accordion
                  key={`${container.source}:${container.container_id}:${group.key}`}
                  disableGutters
                  elevation={0}
                  expanded={expandedGroupKeys.includes(group.key)}
                  onChange={(_, isExpanded) =>
                    onExpandedGroupKeysChange(
                      isExpanded
                        ? [...new Set([...expandedGroupKeys, group.key])]
                        : expandedGroupKeys.filter((key) => key !== group.key)
                    )
                  }
                  sx={{ border: "1px solid", borderColor: "divider" }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "minmax(240px, 2fr) minmax(112px, 0.6fr) auto"
                        },
                        gap: 1.5,
                        alignItems: "center",
                        width: "100%"
                      }}
                    >
                      <Typography>{group.equipment_type_name}</Typography>
                      <StatCell label={t("common.fields.quantity")} value={group.quantity_sum} />
                      <Box />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: "grid", gap: 1.25, mb: 2 }}>
                      {group.items.map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "minmax(160px, 1fr) minmax(112px, auto) auto" },
                            gap: 1.5,
                            alignItems: "center",
                            p: 1.25,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            backgroundColor: "background.paper"
                          }}
                        >
                          <Box sx={{ display: "grid", gap: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {`ID ${item.id}`}
                            </Typography>
                            {item.created_at ? (
                              <Typography variant="caption" color="text.secondary">
                                {new Date(item.created_at).toLocaleString(i18n.language)}
                              </Typography>
                            ) : null}
                          </Box>
                          <StatCell
                            label={t("common.fields.quantity")}
                            value={
                              item.can_edit_quantity === false
                                ? `${item.quantity} (${t("pagesUi.cabinetItems.placeholders.quantityLocked")})`
                                : item.quantity
                            }
                          />
                          <Box
                            sx={{ display: "flex", justifyContent: { xs: "flex-start", sm: "flex-end" }, gap: 0.5, flexWrap: "wrap" }}
                          >
                            <AppButton
                              size="small"
                              variant="outlined"
                              startIcon={<DigitalTwinIcon />}
                              onClick={() =>
                                navigate(
                                  item.source === "assembly"
                                    ? `/assemblies/${container.container_id}/composition`
                                    : `/cabinets/${container.container_id}/composition`
                                )
                              }
                            >
                              Состав
                            </AppButton>
                            {canWrite ? (
                              item.is_deleted ? (
                                <AppButton
                                  size="small"
                                  color="success"
                                  startIcon={<RestoreRoundedIcon fontSize="small" />}
                                  onClick={() => onRestoreItem(item)}
                                >
                                  {t("actions.restore")}
                                </AppButton>
                              ) : (
                                <>
                                  <Tooltip title={t("actions.edit")}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() => onEditItem(item)}
                                        disabled={item.can_edit_quantity === false}
                                      >
                                        <EditRoundedIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title={t("actions.delete")}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => onDeleteItem(item)}
                                      >
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </>
                              )
                            ) : null}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 260px" },
                        gap: 3,
                        alignItems: "start"
                      }}
                    >
                      <Box sx={{ display: "grid", gap: 1 }}>
                        <Typography variant="subtitle2">{t("pagesUi.cabinetItems.sections.info")}</Typography>
                        <InfoRow label={t("common.fields.manufacturer")} value={group.manufacturer_name || "-"} />
                        <InfoRow label={t("pagesUi.equipmentTypes.fields.article")} value={group.article || "-"} />
                        <InfoRow label={t("common.fields.nomenclature")} value={group.inventory_number || "-"} />
                        <InfoRow
                          label={t("common.fields.quantity")}
                          value={
                            group.can_edit_quantity
                              ? group.quantity_sum
                              : `${group.quantity_sum} (${t("pagesUi.cabinetItems.placeholders.quantityLocked")})`
                          }
                        />
                      </Box>
                      <Box sx={{ display: "grid", gap: 1 }}>
                        <Typography variant="subtitle2">{t("pagesUi.cabinetItems.sections.properties")}</Typography>
                        <InfoRow
                          label={t("common.fields.portsInterfaces")}
                          value={formatNetworkPorts(group.network_ports)}
                        />
                        <InfoRow
                          label={t("pagesUi.equipmentTypes.fields.hasSerialInterfaces")}
                          value={formatSerialPorts(group.serial_ports)}
                        />
                        <InfoRow
                          label={t("common.fields.datasheet")}
                          value={
                            <ProtectedDownloadLink
                              url={group.datasheet_url || null}
                              filename={group.datasheet_name}
                              icon={getFileIcon(group.datasheet_name)}
                              size="small"
                            />
                          }
                        />
                        {group.is_channel_forming ? (
                          <InfoRow label={t("common.fields.channelForming")} value={channelValue} />
                        ) : null}
                        {singleItem?.source === "cabinet" ? (
                          <IPAMSummaryBlock
                            itemId={singleItem.id}
                            visible={true}
                            onOpenIPAM={() => navigate(`/ipam?equipment_instance_id=${singleItem.id}`)}
                          />
                        ) : null}
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1,
                          justifyItems: { xs: "start", md: "end" },
                          textAlign: { xs: "left", md: "right" },
                          "& .MuiAvatar-root": { borderRadius: "8px" },
                          "& .MuiAvatar-img": { objectFit: "contain" }
                        }}
                      >
                        <Typography variant="subtitle2">{t("common.fields.photo")}</Typography>
                        <ProtectedImage
                          url={group.photo_url || null}
                          alt={group.equipment_type_name}
                          width={240}
                          height={180}
                          previewOnHover={true}
                          previewMaxWidth={700}
                          previewMaxHeight={700}
                          fallback={
                            <Typography variant="body2" color="text.secondary">
                              {t("pagesUi.cabinetItems.placeholders.noPhoto")}
                            </Typography>
                          }
                        />
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                      {t("pagesUi.cabinetItems.placeholders.details")}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        ) : null}

        {container.source === "cabinet" && canWrite ? (
          <Dialog open={addDialogOpen} onClose={handleAddDialogClose} fullWidth maxWidth="sm">
            <DialogTitle>
              {t("pagesUi.cabinetItems.inline.addDialogTitle", { name: container.container_name })}
            </DialogTitle>
            <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
              <SearchableSelectField
                label={t("common.fields.equipment")}
                value={selectedEquipmentId}
                options={equipmentOptions}
                onChange={(nextValue) => {
                  const nextEquipmentId = nextValue === "" ? "" : Number(nextValue);
                  setSelectedEquipmentId(nextEquipmentId);
                  const nextEquipment = nextEquipmentId === "" ? undefined : equipmentFlagsMap.get(Number(nextEquipmentId));
                  if (
                    nextEquipment?.is_channel_forming ||
                    nextEquipment?.is_network ||
                    nextEquipment?.has_serial_interfaces
                  ) {
                    setInlineQuantity(1);
                  }
                }}
                emptyOptionLabel={t("common.notSelected")}
                fullWidth
                size="small"
              />
              {selectedEquipment ? (
                <Typography variant="body2" color="text.secondary">
                  {formatEquipmentPowerSummary(selectedEquipment)}
                </Typography>
              ) : null}
              <TextField
                label={t("common.fields.quantity")}
                type="number"
                size="small"
                value={forceQtyOne ? 1 : inlineQuantity}
                onChange={(event) => setInlineQuantity(Number(event.target.value))}
                inputProps={{ min: 1 }}
                disabled={forceQtyOne}
                helperText={
                  forceQtyOne
                    ? t("pagesUi.cabinetItems.placeholders.quantityLocked")
                    : " "
                }
              />
            </DialogContent>
            <DialogActions>
              <AppButton variant="outlined" onClick={handleAddDialogClose}>
                {t("actions.cancel")}
              </AppButton>
              <AppButton onClick={handleAdd} disabled={!canAdd}>
                {t("pagesUi.cabinetItems.inline.add")}
              </AppButton>
            </DialogActions>
          </Dialog>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}

function LocationTreeNodeCard({
  node,
  level,
  expandedLocationIds,
  onToggleLocation,
  expandedContainerKeys,
  onToggleContainer,
  expandedGroupKeysByContainer,
  onExpandedGroupKeysChange,
  canWrite,
  detailFilters,
  equipmentMap,
  equipmentFlagsMap,
  onEditItem,
  onDeleteItem,
  onRestoreItem,
  onAddToCabinet,
  equipmentOptions,
  onErrorMessage
}: {
  node: EquipmentInOperationLocationNode;
  level: number;
  expandedLocationIds: number[];
  onToggleLocation: (locationId: number) => void;
  expandedContainerKeys: string[];
  onToggleContainer: (containerKey: string, expanded: boolean) => void;
  expandedGroupKeysByContainer: ExpandedGroupKeysByContainer;
  onExpandedGroupKeysChange: (containerKey: string, groupKeys: string[]) => void;
  canWrite: boolean;
  detailFilters: DetailFilters;
  equipmentMap: Map<number, string>;
  equipmentFlagsMap: Map<number, EquipmentType>;
  onEditItem: (item: EquipmentInOperationItem) => void;
  onDeleteItem: (item: EquipmentInOperationItem) => void;
  onRestoreItem: (item: EquipmentInOperationItem) => void;
  onAddToCabinet: (payload: { cabinetId: number; equipmentTypeId: number; quantity: number }) => void;
  equipmentOptions: { value: number; label: string }[];
  onErrorMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const expanded = expandedLocationIds.includes(node.location_id);
  const hasChildren = node.children.length > 0 || node.containers.length > 0;

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "auto 1fr", lg: "auto minmax(260px, 1fr) minmax(220px, 1fr) auto" },
          gap: 1.5,
          alignItems: "center",
          p: 1.5,
          pl: 1.5 + level * 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          backgroundColor: "background.paper"
        }}
      >
        {hasChildren ? (
          <IconButton size="small" onClick={() => onToggleLocation(node.location_id)}>
            {expanded ? <ExpandMoreRoundedIcon /> : <ChevronRightRoundedIcon />}
          </IconButton>
        ) : (
          <Box sx={{ width: 32 }} />
        )}
        <Box sx={{ display: "grid", minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {node.location_name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {node.location_full_path}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", lg: "block" } }}>
          {t("common.fields.location")}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(96px, auto))",
            gap: 1.5,
            justifyContent: "end"
          }}
        >
          <StatCell label={t("common.status.active")} value={node.active_containers_count} />
          <StatCell label={t("common.status.deleted")} value={node.deleted_containers_count} />
          <StatCell label={t("common.fields.quantity")} value={node.quantity_sum} />
        </Box>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ display: "grid", gap: 1, pl: { xs: 1.5, sm: 2.5 } }}>
          {node.children.map((child) => (
            <LocationTreeNodeCard
              key={`location:${child.location_id}`}
              node={child}
              level={level + 1}
              expandedLocationIds={expandedLocationIds}
              onToggleLocation={onToggleLocation}
              expandedContainerKeys={expandedContainerKeys}
              onToggleContainer={onToggleContainer}
              expandedGroupKeysByContainer={expandedGroupKeysByContainer}
              onExpandedGroupKeysChange={onExpandedGroupKeysChange}
              canWrite={canWrite}
              detailFilters={detailFilters}
              equipmentMap={equipmentMap}
              equipmentFlagsMap={equipmentFlagsMap}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onRestoreItem={onRestoreItem}
              onAddToCabinet={onAddToCabinet}
              equipmentOptions={equipmentOptions}
              onErrorMessage={onErrorMessage}
            />
          ))}

          {node.containers.map((container) => (
            <Box key={`${container.source}:${container.container_id}`} sx={{ pl: 1 }}>
              <ContainerAccordion
                container={container}
                expanded={expandedContainerKeys.includes(getContainerKey(container))}
                onExpandedChange={(isExpanded) => onToggleContainer(getContainerKey(container), isExpanded)}
                expandedGroupKeys={expandedGroupKeysByContainer[getContainerKey(container)] || []}
                onExpandedGroupKeysChange={(groupKeys) =>
                  onExpandedGroupKeysChange(getContainerKey(container), groupKeys)
                }
                canWrite={canWrite}
                detailFilters={detailFilters}
                equipmentMap={equipmentMap}
                equipmentFlagsMap={equipmentFlagsMap}
                equipmentOptions={equipmentOptions}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
                onRestoreItem={onRestoreItem}
                onAddToCabinet={onAddToCabinet}
                onErrorMessage={onErrorMessage}
              />
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function CabinetItemsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [containerFilter, setContainerFilter] = useState<string>("");
  const [equipmentFilter, setEquipmentFilter] = useState<number | "">("");
  const [manufacturerFilter, setManufacturerFilter] = useState<number | "">("");
  const [locationFilter, setLocationFilter] = useState<number | "">("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedLocationIds, setExpandedLocationIds] = useState<number[]>([]);
  const [expandedContainerKeys, setExpandedContainerKeys] = useState<string[]>([]);
  const [expandedGroupKeysByContainer, setExpandedGroupKeysByContainer] = useState<ExpandedGroupKeysByContainer>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentInOperationItem | null>(null);
  const [editQuantity, setEditQuantity] = useState(0);
  const debouncedQuery = useDebouncedValue(q, 300);

  const sortOptions = useMemo(
    () => [
      { value: "-created_at", label: t("pagesUi.cabinetItems.sort.byDateNewest") },
      { value: "created_at", label: t("pagesUi.cabinetItems.sort.byDateOldest") },
      { value: "-quantity", label: t("pagesUi.cabinetItems.sort.byQuantityDesc") },
      { value: "quantity", label: t("pagesUi.cabinetItems.sort.byQuantityAsc") },
      { value: "equipment_type_name", label: t("pagesUi.cabinetItems.sort.byEquipmentAsc") },
      { value: "-equipment_type_name", label: t("pagesUi.cabinetItems.sort.byEquipmentDesc") },
      { value: "manufacturer_name", label: t("pagesUi.cabinetItems.sort.byManufacturerAsc") },
      { value: "-manufacturer_name", label: t("pagesUi.cabinetItems.sort.byManufacturerDesc") }
    ],
    [t]
  );

  const [containerType, containerId] = useMemo(() => {
    if (!containerFilter) {
      return ["", 0] as const;
    }
    const [type, idValue] = containerFilter.split(":");
    return [type, Number(idValue)] as const;
  }, [containerFilter]);

  const detailFilters = useMemo(
    () => ({
      q: debouncedQuery,
      showDeleted,
      equipmentFilter,
      manufacturerFilter,
      locationFilter
    }),
    [debouncedQuery, equipmentFilter, locationFilter, manufacturerFilter, showDeleted]
  );

  const containersQuery = useQuery({
    queryKey: [
      "equipment-in-operation-tree",
      debouncedQuery,
      sort,
      containerFilter,
      equipmentFilter,
      manufacturerFilter,
      locationFilter,
      showDeleted
    ],
    queryFn: () =>
      fetchEquipmentInOperationTree({
        q: debouncedQuery || undefined,
        sort: sort || undefined,
        include_deleted: showDeleted,
        cabinet_id: containerType === "cabinet" ? containerId : undefined,
        assembly_id: containerType === "assembly" ? containerId : undefined,
        equipment_type_id: equipmentFilter || undefined,
        manufacturer_id: manufacturerFilter || undefined,
        location_id: locationFilter || undefined,
        is_deleted: showDeleted ? true : false
      })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-options"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: 200 }),
    staleTime: LOOKUP_QUERY_STALE_TIME
  });

  const assembliesQuery = useQuery({
    queryKey: ["assemblies-options"],
    queryFn: () => listEntity<Assembly>("/assemblies", { page: 1, page_size: 200 }),
    staleTime: LOOKUP_QUERY_STALE_TIME
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-options"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: 200 }),
    staleTime: LOOKUP_QUERY_STALE_TIME
  });

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers-options"],
    queryFn: () => listEntity<Manufacturer>("/manufacturers", { page: 1, page_size: 200 }),
    staleTime: LOOKUP_QUERY_STALE_TIME
  });

  const locationsTreeQuery = useQuery({
    queryKey: ["locations-tree-options", false],
    queryFn: () => fetchLocationsTree(false),
    staleTime: LOOKUP_QUERY_STALE_TIME
  });

  const { options: locationOptions } = useMemo(
    () => buildLocationLookups(locationsTreeQuery.data || []),
    [locationsTreeQuery.data]
  );

  useEffect(() => {
    if (containersQuery.error) {
      setErrorMessage(
        containersQuery.error instanceof Error ? containersQuery.error.message : t("pagesUi.cabinetItems.errors.load")
      );
    }
  }, [containersQuery.error, t]);

  const invalidateEquipmentQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["equipment-in-operation"] });
    queryClient.invalidateQueries({ queryKey: ["equipment-in-operation-containers"] });
    queryClient.invalidateQueries({ queryKey: ["equipment-in-operation-tree"] });
    queryClient.invalidateQueries({ queryKey: ["equipment-in-operation-container-items"] });
  };

  const restoreMutation = useMutation({
    mutationFn: ({ id, source }: { id: number; source: EquipmentInOperationItem["source"] }) =>
      restoreEntity(source === "cabinet" ? "/cabinet-items" : "/assembly-items", id),
    onSuccess: invalidateEquipmentQueries,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.restore"))
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, source }: { id: number; source: EquipmentInOperationItem["source"] }) =>
      deleteEntity(source === "cabinet" ? "/cabinet-items" : "/assembly-items", id),
    onSuccess: invalidateEquipmentQueries,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.delete"))
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      quantity,
      source
    }: {
      id: number;
      quantity: number;
      source: EquipmentInOperationItem["source"];
    }) => updateEntity(source === "cabinet" ? "/cabinet-items" : "/assembly-items", id, { quantity }),
    onSuccess: invalidateEquipmentQueries,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.updateQuantity"))
  });

  const movementMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createEntity("/movements", payload),
    onSuccess: () => {
      invalidateEquipmentQueries();
      queryClient.invalidateQueries({ queryKey: ["warehouse-items"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
    },
    onError: (error) => {
      if (error instanceof Error && /not found|404/i.test(error.message)) {
        setErrorMessage(t("common.notImplemented"));
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.warehouseItems.errors.actionFailed"));
    }
  });

  const equipmentMap = useMemo(() => {
    const map = new Map<number, string>();
    equipmentTypesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [equipmentTypesQuery.data?.items]);

  const equipmentFlagsMap = useMemo(() => {
    const map = new Map<number, EquipmentType>();
    equipmentTypesQuery.data?.items.forEach((item) => map.set(item.id, item));
    return map;
  }, [equipmentTypesQuery.data?.items]);
  const equipmentOptions = useMemo(
    () =>
      equipmentTypesQuery.data?.items.map((item) => ({
        value: item.id,
        label: `${item.name} — ${formatEquipmentPowerSummary(item)}`
      })) || [],
    [equipmentTypesQuery.data?.items]
  );

  const containerOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    cabinetsQuery.data?.items.forEach((item) =>
      options.push({
        value: `cabinet:${item.id}`,
        label: `${t("menu.cabinets")}: ${item.name}`
      })
    );
    assembliesQuery.data?.items.forEach((item) =>
      options.push({
        value: `assembly:${item.id}`,
        label: `${t("menu.assemblies")}: ${item.name}`
      })
    );
    options.sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    return options;
  }, [assembliesQuery.data?.items, cabinetsQuery.data?.items, i18n.language, t]);

  const locationNodes = containersQuery.data || [];
  const allLocationIds = useMemo(() => collectLocationIds(locationNodes), [locationNodes]);
  const allContainers = useMemo(() => collectContainers(locationNodes), [locationNodes]);
  const allContainerKeys = useMemo(() => allContainers.map((container) => getContainerKey(container)), [allContainers]);

  useEffect(() => {
    setExpandedLocationIds([]);
    setExpandedContainerKeys([]);
    setExpandedGroupKeysByContainer({});
  }, [q, sort, containerFilter, equipmentFilter, manufacturerFilter, locationFilter, showDeleted, locationNodes]);

  const toggleLocation = (locationId: number) => {
    setExpandedLocationIds((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId]
    );
  };

  const toggleContainer = (containerKey: string, expanded: boolean) => {
    setExpandedContainerKeys((prev) =>
      expanded ? [...new Set([...prev, containerKey])] : prev.filter((key) => key !== containerKey)
    );
    if (!expanded) {
      setExpandedGroupKeysByContainer((prev) => {
        if (!(containerKey in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[containerKey];
        return next;
      });
    }
  };

  const handleExpandedGroupKeysChange = (containerKey: string, groupKeys: string[]) => {
    setExpandedGroupKeysByContainer((prev) => {
      if (groupKeys.length === 0) {
        if (!(containerKey in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[containerKey];
        return next;
      }
      return { ...prev, [containerKey]: groupKeys };
    });
  };

  const expandAll = () => {
    setExpandedLocationIds(allLocationIds);
    setExpandedContainerKeys(allContainerKeys);
  };

  const collapseAll = () => {
    setExpandedLocationIds([]);
    setExpandedContainerKeys([]);
    setExpandedGroupKeysByContainer({});
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.cabinetItems")}</Typography>
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
              label={t("actions.search")}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>{t("common.sort")}</InputLabel>
              <Select label={t("common.sort")} value={sort} onChange={(event) => setSort(event.target.value)}>
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <SearchableSelectField
              label={t("common.fields.cabinetAssembly")}
              value={containerFilter}
              options={containerOptions}
              onChange={(nextValue) => setContainerFilter(String(nextValue))}
              emptyOptionLabel={t("common.all")}
              fullWidth
            />

            <SearchableSelectField
              label={t("common.fields.equipment")}
              value={equipmentFilter}
              options={equipmentOptions}
              onChange={(nextValue) => {
                setEquipmentFilter(nextValue === "" ? "" : Number(nextValue));
              }}
              emptyOptionLabel={t("common.all")}
              fullWidth
            />

            <SearchableSelectField
              label={t("common.fields.manufacturer")}
              value={manufacturerFilter}
              options={
                manufacturersQuery.data?.items.map((item) => ({
                  value: item.id,
                  label: item.name
                })) || []
              }
              onChange={(nextValue) => {
                setManufacturerFilter(nextValue === "" ? "" : Number(nextValue));
              }}
              emptyOptionLabel={t("common.all")}
              fullWidth
            />

            <SearchableSelectField
              label={t("common.fields.location")}
              value={locationFilter}
              options={locationOptions}
              onChange={(nextValue) => {
                setLocationFilter(nextValue === "" ? "" : Number(nextValue));
              }}
              emptyOptionLabel={t("common.all")}
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
                  }}
                />
              }
              label={t("common.showDeleted")}
            />
            <Box sx={{ flexGrow: 1 }} />
            <AppButton variant="outlined" size="small" onClick={expandAll} disabled={locationNodes.length === 0}>
              {t("pagesUi.cabinetItems.actions.expandAll")}
            </AppButton>
            <AppButton variant="outlined" size="small" onClick={collapseAll} disabled={locationNodes.length === 0}>
              {t("pagesUi.cabinetItems.actions.collapseAll")}
            </AppButton>
          </Box>

          <Box sx={{ display: "grid", gap: 1 }}>
            {locationNodes.map((node) => (
              <LocationTreeNodeCard
                key={`location:${node.location_id}`}
                node={node}
                level={0}
                expandedLocationIds={expandedLocationIds}
                onToggleLocation={toggleLocation}
                expandedContainerKeys={expandedContainerKeys}
                onToggleContainer={toggleContainer}
                expandedGroupKeysByContainer={expandedGroupKeysByContainer}
                onExpandedGroupKeysChange={handleExpandedGroupKeysChange}
                canWrite={canWrite}
                detailFilters={detailFilters}
                equipmentMap={equipmentMap}
                equipmentFlagsMap={equipmentFlagsMap}
                equipmentOptions={equipmentOptions}
                onEditItem={(item) => {
                  setEditItem(item);
                  setEditQuantity(item.quantity);
                  setEditOpen(true);
                }}
                onDeleteItem={(item) => deleteMutation.mutate({ id: item.id, source: item.source })}
                onRestoreItem={(item) => restoreMutation.mutate({ id: item.id, source: item.source })}
                onAddToCabinet={({ cabinetId, equipmentTypeId, quantity }) =>
                  movementMutation.mutate({
                    movement_type: "direct_to_cabinet",
                    equipment_type_id: equipmentTypeId,
                    to_cabinet_id: cabinetId,
                    quantity
                  })
                }
                onErrorMessage={(message) => setErrorMessage(message)}
              />
            ))}
            {!containersQuery.isLoading && locationNodes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("dashboard.common.no_data")}
              </Typography>
            ) : null}
          </Box>
        </CardContent>
      </Card>

      {canWrite ? (
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>{t("actions.edit")}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              label={t("common.fields.quantity")}
              type="number"
              value={editQuantity}
              onChange={(event) => setEditQuantity(Number(event.target.value))}
              inputProps={{ min: 0 }}
              disabled={editItem?.can_edit_quantity === false}
              helperText={
                editItem?.can_edit_quantity === false
                  ? t("pagesUi.cabinetItems.placeholders.quantityLocked")
                  : undefined
              }
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <AppButton onClick={() => setEditOpen(false)}>{t("actions.cancel")}</AppButton>
            <AppButton
              variant="contained"
              disabled={editItem?.can_edit_quantity === false}
              onClick={() => {
                if (editItem && editItem.can_edit_quantity !== false) {
                  updateMutation.mutate({
                    id: editItem.id,
                    quantity: editQuantity,
                    source: editItem.source
                  });
                }
                setEditOpen(false);
              }}
            >
              {t("actions.save")}
            </AppButton>
          </DialogActions>
        </Dialog>
      ) : null}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
