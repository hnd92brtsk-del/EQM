import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TablePagination,
  TextField,
  Typography
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { buildLocationLookups, fetchLocationsTree } from "../utils/locations";

const pageSizeOptions = [10, 20, 50, 100];

const InfoRow = ({ label, value }: { label: string; value?: ReactNode }) => {
  const displayValue =
    value === null || value === undefined || value === "" ? "-" : value;
  return (
    <Box sx={{ display: "grid" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{displayValue}</Typography>
    </Box>
  );
};

const formatNetworkPorts = (
  ports: { type: string; count: number }[] | null | undefined
): string => {
  if (!Array.isArray(ports) || ports.length === 0) {
    return "-";
  }
  const formatted = ports
    .filter((item) => item?.type)
    .map((item) => `${item.type}[${item.count ?? 0}]`)
    .filter(Boolean);
  return formatted.length ? formatted.join(", ") : "-";
};

const formatSerialPorts = (
  ports: { type: string; count: number }[] | null | undefined
): string => {
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
  network_ports?: { type: string; count: number }[] | null;
  serial_ports?: { type: string; count: number }[] | null;
  is_channel_forming?: boolean;
  channel_count?: number | null;
  can_edit_quantity?: boolean;
  manufacturer_name?: string | null;
  location_full_path?: string | null;
  created_at?: string;
};

type Cabinet = { id: number; name: string };
type Assembly = { id: number; name: string };

type EquipmentType = {
  id: number;
  name: string;
  is_channel_forming: boolean;
  is_network: boolean;
  has_serial_interfaces: boolean;
  channel_count?: number | null;
  ai_count?: number | null;
  di_count?: number | null;
  ao_count?: number | null;
  do_count?: number | null;
};
type Manufacturer = { id: number; name: string };

type EquipmentGroup = {
  key: string;
  equipment_type_id: number;
  equipment_type_name: string;
  manufacturer_name: string;
  article: string;
  inventory_number: string;
  network_ports?: { type: string; count: number }[] | null;
  serial_ports?: { type: string; count: number }[] | null;
  is_channel_forming?: boolean;
  channel_count?: number | null;
  can_edit_quantity: boolean;
  quantity_sum: number;
  items: EquipmentInOperationItem[];
};

type ContainerGroup = {
  key: string;
  container_id: number;
  container_name: string;
  container_type: EquipmentInOperationItem["source"];
  container_type_label: string;
  factory_number: string;
  inventory_number: string;
  location_full_path: string;
  items: EquipmentInOperationItem[];
  equipmentGroups: EquipmentGroup[];
  created_at_min: number;
  created_at_max: number;
  quantity_sum: number;
  equipment_name_sort: string;
  manufacturer_name_sort: string;
};

export default function CabinetItemsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [containerFilter, setContainerFilter] = useState<string>("");
  const [equipmentFilter, setEquipmentFilter] = useState<number | "">("");
  const [manufacturerFilter, setManufacturerFilter] = useState<number | "">("");
  const [locationFilter, setLocationFilter] = useState<number | "">("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentInOperationItem | null>(null);
  const [editQuantity, setEditQuantity] = useState(0);

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

  const itemsQuery = useQuery({
    queryKey: [
      "equipment-in-operation",
      page,
      pageSize,
      q,
      sort,
      containerFilter,
      equipmentFilter,
      manufacturerFilter,
      locationFilter,
      showDeleted
    ],
    queryFn: () =>
      listEntity<EquipmentInOperationItem>("/equipment-in-operation", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        filters: {
          cabinet_id: containerType === "cabinet" ? containerId : undefined,
          assembly_id: containerType === "assembly" ? containerId : undefined,
          equipment_type_id: equipmentFilter || undefined,
          manufacturer_id: manufacturerFilter || undefined,
          location_id: locationFilter || undefined
        },
        is_deleted: showDeleted ? true : false
      })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-options"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: 200 })
  });

  const assembliesQuery = useQuery({
    queryKey: ["assemblies-options"],
    queryFn: () => listEntity<Assembly>("/assemblies", { page: 1, page_size: 200 })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-options"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: 200 })
  });

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers-options"],
    queryFn: () => listEntity<Manufacturer>("/manufacturers", { page: 1, page_size: 200 })
  });

  const locationsTreeQuery = useQuery({
    queryKey: ["locations-tree-options", false],
    queryFn: () => fetchLocationsTree(false)
  });

  const { options: locationOptions } = useMemo(
    () => buildLocationLookups(locationsTreeQuery.data || []),
    [locationsTreeQuery.data]
  );

  useEffect(() => {
    if (itemsQuery.error) {
      setErrorMessage(
        itemsQuery.error instanceof Error
          ? itemsQuery.error.message
          : t("pagesUi.cabinetItems.errors.load")
      );
    }
  }, [itemsQuery.error, t]);


  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["equipment-in-operation"] });
  };

  const deleteMutation = useMutation({
    mutationFn: ({ id, source }: { id: number; source: EquipmentInOperationItem["source"] }) =>
      deleteEntity(source === "cabinet" ? "/cabinet-items" : "/assembly-items", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, source }: { id: number; source: EquipmentInOperationItem["source"] }) =>
      restoreEntity(source === "cabinet" ? "/cabinet-items" : "/assembly-items", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.restore"))
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment-in-operation"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.updateQuantity"))
  });

  const movementMutation = useMutation({
    mutationFn: (payload: any) => createEntity("/movements", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-in-operation"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-items"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      setDialog(null);
    },
    onError: (error) => {
      if (error instanceof Error && /not found|404/i.test(error.message)) {
        setErrorMessage(t("common.notImplemented"));
        return;
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("pagesUi.warehouseItems.errors.actionFailed")
      );
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

  const shouldForceQtyOne = (values: Record<string, any>) => {
    const equipmentId = Number(values.equipment_type_id);
    const equipment = equipmentFlagsMap.get(equipmentId);
    return Boolean(
      equipment?.is_channel_forming || equipment?.is_network || equipment?.has_serial_interfaces
    );
  };

  const openAddFinishedDialog = () => {
    setDialog({
      open: true,
      title: t("pagesUi.cabinetItems.dialogs.addFinishedTitle"),
      fields: [
        {
          name: "equipment_type_id",
          label: t("common.fields.equipment"),
          type: "select",
          options:
            equipmentTypesQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || [],
          onChange: (value) => {
            const equipment = equipmentFlagsMap.get(Number(value));
            if (
              equipment?.is_channel_forming ||
              equipment?.is_network ||
              equipment?.has_serial_interfaces
            ) {
              return { quantity: 1 };
            }
            return {};
          }
        },
        {
          name: "container_id",
          label: t("common.fields.cabinetAssembly"),
          type: "select",
          options: containerOptions
        },
        {
          name: "quantity",
          label: t("common.fields.quantity"),
          type: "number",
          disabledWhen: (values) => shouldForceQtyOne(values)
        },
        { name: "comment", label: t("common.fields.comment"), type: "text" }
      ],
      values: {
        equipment_type_id: "",
        container_id: "",
        quantity: 1,
        comment: ""
      },
      onSave: (values) => {
        const equipmentTypeId = values.equipment_type_id ? Number(values.equipment_type_id) : 0;
        const containerValue = String(values.container_id || "");
        const [containerType, containerIdValue] = containerValue.split(":");
        const containerId = Number(containerIdValue);
        const quantity = shouldForceQtyOne(values) ? 1 : Number(values.quantity);

        if (
          !equipmentTypeId ||
          !containerValue ||
          !containerId ||
          !Number.isFinite(quantity) ||
          quantity < 1
        ) {
          setErrorMessage(t("validation.requiredFields"));
          return;
        }

        movementMutation.mutate({
          movement_type: containerType === "assembly" ? "direct_to_assembly" : "direct_to_cabinet",
          equipment_type_id: equipmentTypeId,
          to_cabinet_id: containerType === "cabinet" ? containerId : undefined,
          to_assembly_id: containerType === "assembly" ? containerId : undefined,
          quantity,
          comment: values.comment || undefined
        });
      }
    });
  };

  const containerGroups = useMemo<ContainerGroup[]>(() => {
    const items = itemsQuery.data?.items || [];
    const containerMap = new Map<string, ContainerGroup>();

    items.forEach((item) => {
      const containerKey = `${item.source}:${item.container_id}`;
      const createdAtMs = item.created_at ? new Date(item.created_at).getTime() : 0;
      const equipmentName =
        item.equipment_type_name ||
        equipmentMap.get(item.equipment_type_id) ||
        String(item.equipment_type_id);
      const manufacturerName = item.manufacturer_name || "-";
      let group = containerMap.get(containerKey);

      if (!group) {
        group = {
          key: containerKey,
          container_id: item.container_id,
          container_name: item.container_name || "-",
          container_type: item.source,
          container_type_label:
            item.source === "assembly"
              ? t("common.fields.assembly")
              : t("common.fields.cabinet"),
          factory_number: item.container_factory_number || "-",
          inventory_number: item.container_inventory_number || "-",
          location_full_path: item.location_full_path || "-",
          items: [],
          equipmentGroups: [],
          created_at_min: createdAtMs,
          created_at_max: createdAtMs,
          quantity_sum: 0,
          equipment_name_sort: equipmentName,
          manufacturer_name_sort: manufacturerName
        };
        containerMap.set(containerKey, group);
      }

      group.items.push(item);
      group.quantity_sum += item.quantity || 0;
      if (createdAtMs) {
        group.created_at_min = Math.min(group.created_at_min, createdAtMs);
        group.created_at_max = Math.max(group.created_at_max, createdAtMs);
      }
      if (equipmentName && group.equipment_name_sort) {
        if (equipmentName.localeCompare(group.equipment_name_sort, i18n.language) < 0) {
          group.equipment_name_sort = equipmentName;
        }
      }
      if (manufacturerName && group.manufacturer_name_sort) {
        if (manufacturerName.localeCompare(group.manufacturer_name_sort, i18n.language) < 0) {
          group.manufacturer_name_sort = manufacturerName;
        }
      }
      if (item.location_full_path) {
        group.location_full_path = item.location_full_path;
      }
      if (item.container_factory_number) {
        group.factory_number = item.container_factory_number;
      }
      if (item.container_inventory_number) {
        group.inventory_number = item.container_inventory_number;
      }
    });

    const containers = Array.from(containerMap.values());

    containers.forEach((container) => {
      const equipmentGroupsMap = new Map<string, EquipmentGroup>();

      container.items.forEach((item) => {
        const equipmentName =
          item.equipment_type_name ||
          equipmentMap.get(item.equipment_type_id) ||
          String(item.equipment_type_id);
        const manufacturerName = item.manufacturer_name || "-";
        const groupKey = String(item.equipment_type_id || equipmentName);
        let equipmentGroup = equipmentGroupsMap.get(groupKey);

        if (!equipmentGroup) {
          equipmentGroup = {
            key: groupKey,
            equipment_type_id: item.equipment_type_id,
            equipment_type_name: equipmentName,
            manufacturer_name: manufacturerName,
            article: item.equipment_type_article || "-",
            inventory_number: item.equipment_type_inventory_number || "-",
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

        equipmentGroup.can_edit_quantity =
          equipmentGroup.can_edit_quantity && (item.can_edit_quantity ?? true);
        if (item.is_channel_forming) {
          equipmentGroup.is_channel_forming = true;
        }
        if (item.channel_count !== undefined && item.channel_count !== null) {
          equipmentGroup.channel_count = item.channel_count;
        }
        equipmentGroup.quantity_sum += item.quantity || 0;
        equipmentGroup.items.push(item);
      });

      container.equipmentGroups = Array.from(equipmentGroupsMap.values()).sort((a, b) =>
        a.equipment_type_name.localeCompare(b.equipment_type_name, i18n.language)
      );
    });

    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    const sortDirection = sort.startsWith("-") ? -1 : 1;

    containers.sort((a, b) => {
      if (sortField === "quantity") {
        return sortDirection * (a.quantity_sum - b.quantity_sum);
      }
      if (sortField === "equipment_type_name") {
        return (
          sortDirection *
          (a.equipment_name_sort || "").localeCompare(b.equipment_name_sort || "", i18n.language)
        );
      }
      if (sortField === "manufacturer_name") {
        return (
          sortDirection *
          (a.manufacturer_name_sort || "").localeCompare(
            b.manufacturer_name_sort || "",
            i18n.language
          )
        );
      }

      const aDate =
        sortDirection < 0 ? a.created_at_max || a.created_at_min : a.created_at_min || a.created_at_max;
      const bDate =
        sortDirection < 0 ? b.created_at_max || b.created_at_min : b.created_at_min || b.created_at_max;
      return sortDirection * (aDate - bDate);
    });

    return containers;
  }, [equipmentMap, i18n.language, itemsQuery.data?.items, sort, t]);

  const totalContainers = containerGroups.length;
  const pagedContainers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return containerGroups.slice(start, start + pageSize);
  }, [containerGroups, page, pageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalContainers / pageSize));
    if (page > maxPage) {
      setPage(1);
    }
  }, [page, pageSize, totalContainers]);

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
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
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

            <FormControl fullWidth>
              <InputLabel>{t("common.fields.cabinetAssembly")}</InputLabel>
              <Select
                label={t("common.fields.cabinetAssembly")}
                value={containerFilter}
                onChange={(event) => {
                  setContainerFilter(event.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {containerOptions.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("common.fields.equipment")}</InputLabel>
              <Select
                label={t("common.fields.equipment")}
                value={equipmentFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setEquipmentFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {equipmentTypesQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("common.fields.manufacturer")}</InputLabel>
              <Select
                label={t("common.fields.manufacturer")}
                value={manufacturerFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setManufacturerFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {manufacturersQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("common.fields.location")}</InputLabel>
              <Select
                label={t("common.fields.location")}
                value={locationFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setLocationFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {locationOptions.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showDeleted}
                  onChange={(event) => {
                    setShowDeleted(event.target.checked);
                    setPage(1);
                  }}
                />
              }
              label={t("common.showDeleted")}
            />
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <AppButton variant="contained" onClick={openAddFinishedDialog}>
                {t("pagesUi.cabinetItems.actions.addFinished")}
              </AppButton>
            )}
          </Box>

          <Box sx={{ display: "grid", gap: 1 }}>
            {pagedContainers.map((container) => (
              <Accordion key={container.key} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px, 2fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(200px, 1fr)",
                      gap: 2,
                      alignItems: "center",
                      width: "100%"
                    }}
                  >
                    <Box sx={{ display: "grid" }}>
                      <Typography sx={{ fontWeight: 600 }}>{container.container_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {container.container_type_label}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "grid" }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("common.fields.factoryNumber")}
                      </Typography>
                      <Typography variant="body2">{container.factory_number || "-"}</Typography>
                    </Box>
                    <Box sx={{ display: "grid" }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("common.fields.nomenclatureNumber")}
                      </Typography>
                      <Typography variant="body2">{container.inventory_number || "-"}</Typography>
                    </Box>
                    <Box sx={{ display: "grid" }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("common.fields.location")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {container.location_full_path || "-"}
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {container.equipmentGroups.map((group) => {
                      const singleItem = group.items.length === 1 ? group.items[0] : null;
                      const equipmentDetails = equipmentFlagsMap.get(group.equipment_type_id);
                      const channelCount =
                        group.channel_count ?? equipmentDetails?.channel_count ?? null;
                      const aiCount = equipmentDetails?.ai_count ?? 0;
                      const diCount = equipmentDetails?.di_count ?? 0;
                      const aoCount = equipmentDetails?.ao_count ?? 0;
                      const doCount = equipmentDetails?.do_count ?? 0;
                      const channelParts: string[] = [];
                      if (channelCount) {
                        channelParts.push(`${t("common.fields.channelCount")}: ${channelCount}`);
                      }
                      if (aiCount || diCount || aoCount || doCount) {
                        channelParts.push(
                          `AI ${aiCount} / DI ${diCount} / AO ${aoCount} / DO ${doCount}`
                        );
                      }
                      const channelValue = channelParts.length
                        ? `${t("common.yes")}, ${channelParts.join(", ")}`
                        : t("common.yes");
                      return (
                        <Accordion
                          key={`${container.key}:${group.key}`}
                          disableGutters
                          elevation={0}
                          sx={{ border: "1px solid", borderColor: "divider" }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns:
                                  "minmax(220px, 2fr) minmax(160px, 1fr) minmax(140px, 1fr) minmax(160px, 1fr) minmax(80px, 0.5fr) auto",
                                gap: 2,
                                alignItems: "center",
                                width: "100%"
                              }}
                            >
                              <Typography>{group.equipment_type_name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {group.manufacturer_name || "-"}
                              </Typography>
                              <Box sx={{ display: "grid" }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("pagesUi.equipmentTypes.fields.article")}
                                </Typography>
                                <Typography variant="body2">{group.article || "-"}</Typography>
                              </Box>
                              <Box sx={{ display: "grid" }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("common.fields.nomenclature")}
                                </Typography>
                                <Typography variant="body2">{group.inventory_number || "-"}</Typography>
                              </Box>
                              <Typography sx={{ fontWeight: 600 }}>{group.quantity_sum}</Typography>
                              {canWrite && singleItem && singleItem.can_edit_quantity !== false ? (
                                <Box
                                  sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <AppButton
                                    size="small"
                                    startIcon={<EditRoundedIcon />}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditItem(singleItem);
                                      setEditQuantity(singleItem.quantity);
                                      setEditOpen(true);
                                    }}
                                  >
                                    {t("actions.edit")}
                                  </AppButton>
                                  <AppButton
                                    size="small"
                                    color={singleItem.is_deleted ? "success" : "error"}
                                    startIcon={
                                      singleItem.is_deleted ? (
                                        <RestoreRoundedIcon />
                                      ) : (
                                        <DeleteOutlineRoundedIcon />
                                      )
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (singleItem.is_deleted) {
                                        restoreMutation.mutate({
                                          id: singleItem.id,
                                          source: singleItem.source
                                        });
                                      } else {
                                        deleteMutation.mutate({
                                          id: singleItem.id,
                                          source: singleItem.source
                                        });
                                      }
                                    }}
                                  >
                                    {singleItem.is_deleted ? t("actions.restore") : t("actions.delete")}
                                  </AppButton>
                                </Box>
                              ) : canWrite && singleItem ? (
                                <Box
                                  sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <AppButton
                                    size="small"
                                    color={singleItem.is_deleted ? "success" : "error"}
                                    startIcon={
                                      singleItem.is_deleted ? (
                                        <RestoreRoundedIcon />
                                      ) : (
                                        <DeleteOutlineRoundedIcon />
                                      )
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (singleItem.is_deleted) {
                                        restoreMutation.mutate({
                                          id: singleItem.id,
                                          source: singleItem.source
                                        });
                                      } else {
                                        deleteMutation.mutate({
                                          id: singleItem.id,
                                          source: singleItem.source
                                        });
                                      }
                                    }}
                                  >
                                    {singleItem.is_deleted ? t("actions.restore") : t("actions.delete")}
                                  </AppButton>
                                </Box>
                              ) : null}
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Grid container spacing={2} alignItems="stretch">
                              <Grid item xs={12} md={5}>
                                <Box sx={{ display: "grid", gap: 1 }}>
                                  <Typography variant="subtitle2">
                                    {t("pagesUi.cabinetItems.sections.fields")}
                                  </Typography>
                                  <InfoRow
                                    label={t("common.fields.manufacturer")}
                                    value={group.manufacturer_name || "-"}
                                  />
                                  <InfoRow
                                    label={t("pagesUi.equipmentTypes.fields.article")}
                                    value={group.article || "-"}
                                  />
                                  <InfoRow
                                    label={t("common.fields.nomenclature")}
                                    value={group.inventory_number || "-"}
                                  />
                                  <InfoRow
                                    label={t("common.fields.quantity")}
                                    value={
                                      group.can_edit_quantity
                                        ? group.quantity_sum
                                        : `${group.quantity_sum} (${t("pagesUi.cabinetItems.placeholders.quantityLocked")})`
                                    }
                                  />
                                </Box>
                              </Grid>
                              <Grid item xs={12} md="auto">
                                <Divider sx={{ display: { xs: "block", md: "none" } }} />
                                <Divider
                                  orientation="vertical"
                                  flexItem
                                  sx={{ display: { xs: "none", md: "block" } }}
                                />
                              </Grid>
                              <Grid item xs={12} md>
                                <Box sx={{ display: "grid", gap: 1 }}>
                                  <Typography variant="subtitle2">
                                    {t("pagesUi.cabinetItems.sections.properties")}
                                  </Typography>
                                  <InfoRow
                                    label={t("common.fields.portsInterfaces")}
                                    value={formatNetworkPorts(group.network_ports)}
                                  />
                                  <InfoRow
                                    label={t("pagesUi.equipmentTypes.fields.hasSerialInterfaces")}
                                    value={formatSerialPorts(group.serial_ports)}
                                  />
                                  {group.is_channel_forming ? (
                                    <InfoRow
                                      label={t("common.fields.channelForming")}
                                      value={channelValue}
                                    />
                                  ) : null}
                                </Box>
                              </Grid>
                            </Grid>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                              {t("pagesUi.cabinetItems.placeholders.details")}
                            </Typography>
                            {/* TODO: render item-level rows inside the equipment group. */}
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                    {container.equipmentGroups.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t("dashboard.common.no_data")}
                      </Typography>
                    ) : null}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
            {pagedContainers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("dashboard.common.no_data")}
              </Typography>
            ) : null}
          </Box>
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
            count={totalContainers}
            page={page - 1}
            onPageChange={(_, value) => setPage(value + 1)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            rowsPerPageOptions={pageSizeOptions}
          />
        </CardContent>
      </Card>

      {canWrite && (
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
      )}

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}



