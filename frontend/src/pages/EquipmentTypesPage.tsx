import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Box,Card,
  CardContent,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TablePagination,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState, type FieldConfig, type TreeFieldOption } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { uploadEquipmentTypeDatasheet, uploadEquipmentTypePhoto } from "../api/equipmentTypeMedia";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { ProtectedImage } from "../components/ProtectedImage";
import { ProtectedDownloadLink } from "../components/ProtectedDownloadLink";
import { SearchableSelectField } from "../components/SearchableSelectField";

type EquipmentType = {
  id: number;
  name: string;
  article?: string | null;
  nomenclature_number: string;
  role_in_power_chain?: PowerRole | null;
  power_attributes?: PowerAttributes | null;
  current_type?: string | null;
  supply_voltage?: string | null;
  current_consumption_a?: number | null;
  top_current_type?: string | null;
  top_supply_voltage?: string | null;
  bottom_current_type?: string | null;
  bottom_supply_voltage?: string | null;
  current_value_a?: number | null;
  mount_type?: string | null;
  mount_width_mm?: number | null;
  power_role?: string | null;
  output_voltage?: string | null;
  max_output_current_a?: number | null;
  manufacturer_id: number;
  equipment_category_id?: number | null;
  is_channel_forming: boolean;
  channel_count: number;
  ai_count: number;
  di_count: number;
  ao_count: number;
  do_count: number;
  is_network: boolean;
  network_ports?: { type: string; count: number }[] | null;
  has_serial_interfaces: boolean;
  serial_ports?: { type: string; count: number }[] | null;
  unit_price_rub?: number | null;
  photo_url?: string | null;
  datasheet_url?: string | null;
  datasheet_name?: string | null;
  is_deleted: boolean;
  created_at?: string;
};

type Manufacturer = {
  id: number;
  name: string;
  parent_id?: number | null;
  full_path?: string | null;
};
type EquipmentCategory = {
  id: number;
  name: string;
  parent_id?: number | null;
  full_path?: string | null;
};
type NetworkPort = { type: string; count: number };
type SerialPort = { type: string; count: number };
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
type ElectricalFields = {
  role_in_power_chain?: PowerRole | null;
  current_type?: string | null;
  supply_voltage?: string | null;
  top_current_type?: string | null;
  top_supply_voltage?: string | null;
  bottom_current_type?: string | null;
  bottom_supply_voltage?: string | null;
  current_value_a?: number | null;
  mount_type?: string | null;
  mount_width_mm?: number | null;
};

async function fetchAllDictionaryOptions<T>(path: string): Promise<T[]> {
  const pageSize = 200;
  let page = 1;
  let items: T[] = [];
  while (true) {
    const data = await listEntity<T>(path, {
      page,
      page_size: pageSize,
      is_deleted: false
    });
    items = items.concat(data.items);
    if (items.length >= data.total) {
      break;
    }
    page += 1;
  }
  return items;
}

function buildTreeOptions(
  items: Array<{ id: number; name: string; parent_id?: number | null }>
): TreeFieldOption[] {
  const nodeMap = new Map<number, TreeFieldOption>();
  const parentIds = new Set<number>();

  items.forEach((item) => {
    nodeMap.set(item.id, { label: item.name, value: item.id, children: [] });
    if (item.parent_id) {
      parentIds.add(item.parent_id);
    }
  });

  const roots: TreeFieldOption[] = [];
  items.forEach((item) => {
    const node = nodeMap.get(item.id)!;
    if (item.parent_id && nodeMap.has(item.parent_id)) {
      const parent = nodeMap.get(item.parent_id)!;
      parent.children = [...(parent.children || []), node];
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: TreeFieldOption[]): TreeFieldOption[] =>
    nodes
      .map((node) => ({
        ...node,
        children: node.children?.length ? sortNodes(node.children) : undefined,
        disabled: parentIds.has(Number(node.value))
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

  return sortNodes(roots);
}

const pageSizeOptions = [10, 20, 50, 100];
const networkPortOptions: { label: string; value: string; disabled?: boolean }[] = [
  { label: "RJ-45 (8p8c)", value: "RJ-45 (8p8c)" },
  { label: "LC", value: "LC" },
  { label: "SC", value: "SC" },
  { label: "FC", value: "FC" },
  { label: "ST", value: "ST" }
];
const serialPortOptions = [
  { label: "RS-485", value: "RS-485" },
  { label: "RS-232", value: "RS-232" },
  { label: "RS-485(DB-9)", value: "RS-485(DB-9)" },
  { label: "COM", value: "COM" }
];
const mountTypeOptions = [
  { label: "DIN-рейка", value: "din-rail" },
  { label: "Стенка", value: "wall" },
  { label: "Другое", value: "other" }
];
const powerRoleOptions = [
  { label: "Потребитель", value: "consumer" },
  { label: "Источник", value: "source" },
  { label: "Преобразователь", value: "converter" },
  { label: "Пассивный", value: "passive" }
];
const legacyNetworkPortValues = new Set(["RS-485", "RS-232"]);
const photoExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const datasheetExtensions = [".pdf", ".xlsx", ".doc", ".docx"];
const maxPhotoSize = 500 * 1024;
const maxDatasheetSize = 5 * 1024 * 1024;

const getPowerRoleLabel = (role?: string | null) =>
  powerRoleOptions.find((item) => item.value === role)?.label || "-";

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

const formatSerialPorts = (ports: SerialPort[] | null | undefined, enabled: boolean) => {
  if (!enabled || !Array.isArray(ports) || ports.length === 0) {
    return "-";
  }
  const formatted = ports
    .filter((item) => item?.type)
    .map((item) => {
      const count = Number(item.count ?? 0);
      return count > 0 ? `${item.type}×${count}` : item.type;
    })
    .filter(Boolean);
  return formatted.length ? formatted.join(", ") : "-";
};

const getEquipmentElectricalFields = (equipment: EquipmentType): ElectricalFields => {
  const attributes = equipment.power_attributes;
  return {
    role_in_power_chain:
      (attributes?.role_in_power_chain || equipment.role_in_power_chain || equipment.power_role) as
        | PowerRole
        | null
        | undefined,
    current_type: attributes?.current_type ?? equipment.current_type ?? null,
    supply_voltage: attributes?.supply_voltage ?? equipment.supply_voltage ?? null,
    top_current_type: attributes?.top_current_type ?? equipment.top_current_type ?? null,
    top_supply_voltage: attributes?.top_supply_voltage ?? equipment.top_supply_voltage ?? null,
    bottom_current_type: attributes?.bottom_current_type ?? equipment.bottom_current_type ?? null,
    bottom_supply_voltage: attributes?.bottom_supply_voltage ?? equipment.bottom_supply_voltage ?? null,
    current_value_a:
      attributes?.current_value_a ??
      equipment.current_value_a ??
      equipment.current_consumption_a ??
      equipment.max_output_current_a ??
      null,
    mount_type: equipment.mount_type ?? null,
    mount_width_mm: equipment.mount_width_mm ?? null
  };
};

const buildPowerTooltipContent = (electrical: ElectricalFields) => {
  const role = electrical.role_in_power_chain;
  if (!role || role === "passive") {
    return `Роль: ${getPowerRoleLabel(role)}\nЭлектропараметры не заполняются`;
  }
  if (role === "converter") {
    return [
      `Роль: ${getPowerRoleLabel(role)}`,
      `Верхняя сторона: ${electrical.top_current_type || "-"}, ${electrical.top_supply_voltage || "-"}`,
      `Нижняя сторона: ${electrical.bottom_current_type || "-"}, ${electrical.bottom_supply_voltage || "-"}`,
      `Ток, А: ${electrical.current_value_a ?? "-"}`
    ].join("\n");
  }
  return [
    `Роль: ${getPowerRoleLabel(role)}`,
    `Род тока: ${electrical.current_type || "-"}`,
    `Напряжение: ${electrical.supply_voltage || "-"}`,
    `${role === "source" ? "Ток, А" : "Потребление, А"}: ${electrical.current_value_a ?? "-"}`
  ].join("\n");
};

const buildPowerDialogFields = (
  currentTypeOptions: { value: string; label: string }[],
  supplyVoltageOptions: { value: string; label: string }[]
): FieldConfig[] => [
  {
    name: "role_in_power_chain",
    label: "Роль в цепи питания",
    type: "select",
    options: powerRoleOptions
  },
  {
    name: "current_type",
    label: "Род тока",
    type: "select",
    options: currentTypeOptions,
    visibleWhen: (values) => values.role_in_power_chain === "source" || values.role_in_power_chain === "consumer"
  },
  {
    name: "supply_voltage",
    label: "Напряжение питания, В",
    type: "select",
    options: supplyVoltageOptions,
    visibleWhen: (values) => values.role_in_power_chain === "source" || values.role_in_power_chain === "consumer"
  },
  {
    name: "current_value_a",
    label: "Потребление / ток, А",
    type: "number",
    min: 0,
    step: "any",
    visibleWhen: (values) => values.role_in_power_chain === "source" || values.role_in_power_chain === "consumer"
  },
  {
    name: "top_current_type",
    label: "Род тока верхняя сторона",
    type: "select",
    options: currentTypeOptions,
    visibleWhen: (values) => values.role_in_power_chain === "converter"
  },
  {
    name: "top_supply_voltage",
    label: "Напряжение верхняя сторона, В",
    type: "select",
    options: supplyVoltageOptions,
    visibleWhen: (values) => values.role_in_power_chain === "converter"
  },
  {
    name: "bottom_current_type",
    label: "Род тока нижняя сторона",
    type: "select",
    options: currentTypeOptions,
    visibleWhen: (values) => values.role_in_power_chain === "converter"
  },
  {
    name: "bottom_supply_voltage",
    label: "Напряжение нижняя сторона, В",
    type: "select",
    options: supplyVoltageOptions,
    visibleWhen: (values) => values.role_in_power_chain === "converter"
  },
  {
    name: "converter_current_value_a",
    label: "Ток, А",
    type: "number",
    min: 0,
    step: "any",
    visibleWhen: (values) => values.role_in_power_chain === "converter",
    onChange: (value) => ({ current_value_a: value })
  }
];

export default function EquipmentTypesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [manufacturerFilter, setManufacturerFilter] = useState<number | "">("");
  const [channelFormingFilter, setChannelFormingFilter] = useState<"" | "true" | "false">("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [datasheetFile, setDatasheetFile] = useState<File | null>(null);
  const photoFileRef = useRef<File | null>(null);
  const datasheetFileRef = useRef<File | null>(null);

  const currentTypeOptions = useMemo(
    () => [
      { value: "Постоянный", label: t("pagesUi.equipmentTypes.options.currentType.direct") },
      { value: "Переменный", label: t("pagesUi.equipmentTypes.options.currentType.alternating") },
      { value: "N/A", label: t("pagesUi.equipmentTypes.options.currentType.na") }
    ],
    [t]
  );

  const supplyVoltageOptions = useMemo(
    () => [
      { value: "220В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v220") },
      { value: "24В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v24") },
      { value: "220В/24В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v220v24") },
      { value: "12В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v12") },
      { value: "9В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v9") },
      { value: "5В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v5") },
      { value: "3В", label: t("pagesUi.equipmentTypes.options.supplyVoltage.v3") },
      { value: "N/A", label: t("pagesUi.equipmentTypes.options.supplyVoltage.na") }
    ],
    [t]
  );

  const onPickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    console.log("[ET] picked photo", file?.name, file?.size);
    if (file && validateFile(file, maxPhotoSize, photoExtensions)) {
      photoFileRef.current = file;
      setPhotoFile(file);
    } else {
      photoFileRef.current = null;
      setPhotoFile(null);
    }
    event.currentTarget.value = "";
  };

  const onPickDatasheet = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    console.log("[ET] picked datasheet", file?.name, file?.size);
    if (file && validateFile(file, maxDatasheetSize, datasheetExtensions)) {
      datasheetFileRef.current = file;
      setDatasheetFile(file);
    } else {
      datasheetFileRef.current = null;
      setDatasheetFile(null);
    }
    event.currentTarget.value = "";
  };

  const validateFile = (file: File, maxSize: number, allowedExts: string[]) => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    if (!allowedExts.includes(extension)) {
      setErrorMessage(t("errors.invalidFormat"));
      return false;
    }
    if (file.size > maxSize) {
      setErrorMessage(t("errors.fileTooLarge"));
      return false;
    }
    return true;
  };

  const resetMediaFiles = () => {
    photoFileRef.current = null;
    datasheetFileRef.current = null;
    setPhotoFile(null);
    setDatasheetFile(null);
  };

  const buildNetworkPortOptions = (ports?: NetworkPort[] | null) => {
    const options = [...networkPortOptions];
    const legacy = new Set(
      (ports || []).map((item) => item.type).filter((type) => legacyNetworkPortValues.has(type))
    );
    legacy.forEach((value) => {
      options.push({ label: value, value, disabled: true });
    });
    return options;
  };

  const sortOptions = useMemo(
    () => [
      { value: "name", label: t("pagesUi.equipmentTypes.sort.byNameAsc") },
      { value: "-name", label: t("pagesUi.equipmentTypes.sort.byNameDesc") },
      { value: "nomenclature_number", label: t("pagesUi.equipmentTypes.sort.byNomenclatureAsc") },
      { value: "-nomenclature_number", label: t("pagesUi.equipmentTypes.sort.byNomenclatureDesc") },
      { value: "created_at", label: t("pagesUi.equipmentTypes.sort.byCreatedOldest") },
      { value: "-created_at", label: t("pagesUi.equipmentTypes.sort.byCreatedNewest") }
    ],
    [t]
  );

  const equipmentQuery = useQuery({
    queryKey: [
      "equipment-types",
      page,
      pageSize,
      q,
      sort,
      manufacturerFilter,
      channelFormingFilter,
      showDeleted
    ],
    queryFn: () =>
      listEntity<EquipmentType>("/equipment-types", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          manufacturer_id: manufacturerFilter || undefined,
          is_channel_forming:
            channelFormingFilter === "" ? undefined : channelFormingFilter === "true"
        }
      })
  });

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers-flat-options"],
    queryFn: () => fetchAllDictionaryOptions<Manufacturer>("/manufacturers")
  });

  const equipmentCategoriesQuery = useQuery({
    queryKey: ["equipment-categories-flat-options"],
    queryFn: () => fetchAllDictionaryOptions<EquipmentCategory>("/equipment-categories")
  });

  useEffect(() => {
    if (equipmentQuery.error) {
      setErrorMessage(
        equipmentQuery.error instanceof Error
          ? equipmentQuery.error.message
          : t("pagesUi.equipmentTypes.errors.load")
      );
    }
  }, [equipmentQuery.error, t]);

  const manufacturerMap = useMemo(() => {
    const map = new Map<number, string>();
    manufacturersQuery.data?.forEach((item) => map.set(item.id, item.full_path || item.name));
    return map;
  }, [manufacturersQuery.data]);

  const equipmentCategoryMap = useMemo(() => {
    const map = new Map<number, string>();
    equipmentCategoriesQuery.data?.forEach((item) => map.set(item.id, item.full_path || item.name));
    return map;
  }, [equipmentCategoriesQuery.data]);

  const manufacturerOptions = useMemo(
    () =>
      (manufacturersQuery.data || [])
        .filter((item) => item.parent_id !== null && item.parent_id !== undefined)
        .map((item) => ({
          id: item.id,
          name: item.name,
          full_path: item.full_path || item.name
        })),
    [manufacturersQuery.data]
  );

  const equipmentCategoryOptions = useMemo(
    () => {
      const items = equipmentCategoriesQuery.data || [];
      return items
        .filter((item) => !items.some((candidate) => candidate.parent_id === item.id))
        .map((item) => ({
          id: item.id,
          name: item.name,
          full_path: item.full_path || item.name
        }));
    },
    [equipmentCategoriesQuery.data]
  );

  const manufacturerTreeOptions = useMemo(
    () =>
      buildTreeOptions(
        (manufacturersQuery.data || []).map((item) => ({
          id: item.id,
          name: item.name,
          parent_id: item.parent_id
        }))
      ),
    [manufacturersQuery.data]
  );

  const equipmentCategoryTreeOptions = useMemo(
    () =>
      buildTreeOptions(
        (equipmentCategoriesQuery.data || []).map((item) => ({
          id: item.id,
          name: item.name,
          parent_id: item.parent_id
        }))
      ),
    [equipmentCategoriesQuery.data]
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["equipment-types"] });
    queryClient.invalidateQueries({ queryKey: ["manufacturers-options"] });
    queryClient.invalidateQueries({ queryKey: ["equipment-categories-options"] });
  };

  const handleDialogClose = () => {
    setDialog(null);
    resetMediaFiles();
  };

  const powerDialogFields = useMemo(
    () => buildPowerDialogFields(currentTypeOptions, supplyVoltageOptions),
    [currentTypeOptions, supplyVoltageOptions]
  );

  const buildDialogFields = (networkPorts?: NetworkPort[] | null): FieldConfig[] => [
    { name: "name", label: t("common.fields.name"), type: "text" },
    { name: "nomenclature_number", label: t("common.fields.nomenclature"), type: "text" },
    { name: "article", label: t("pagesUi.equipmentTypes.fields.article"), type: "text" },
    ...powerDialogFields,
    {
      name: "mount_type",
      label: "Тип монтажа",
      type: "select",
      options: mountTypeOptions
    },
    {
      name: "mount_width_mm",
      label: "Ширина монтажа, мм",
      type: "number",
      min: 0
    },
    {
      name: "manufacturer_id",
      label: t("common.fields.manufacturer"),
      type: "treeSelect",
      treeOptions: manufacturerTreeOptions,
      leafOnly: true
    },
    {
      name: "equipment_category_id",
      label: t("common.fields.equipmentCategory"),
      type: "treeSelect",
      treeOptions: equipmentCategoryTreeOptions,
      leafOnly: true
    },
    {
      name: "is_channel_forming",
      label: t("common.fields.channelForming"),
      type: "checkbox"
    },
    {
      name: "ai_count",
      label: "AI",
      type: "number",
      visibleWhen: (values) => Boolean(values.is_channel_forming)
    },
    {
      name: "di_count",
      label: "DI",
      type: "number",
      visibleWhen: (values) => Boolean(values.is_channel_forming)
    },
    {
      name: "ao_count",
      label: "AO",
      type: "number",
      visibleWhen: (values) => Boolean(values.is_channel_forming)
    },
    {
      name: "do_count",
      label: "DO",
      type: "number",
      visibleWhen: (values) => Boolean(values.is_channel_forming)
    },
    {
      name: "is_network",
      label: t("common.fields.isNetwork"),
      type: "checkbox"
    },
    {
      name: "network_ports",
      label: t("common.fields.portsInterfaces"),
      type: "ports",
      options: buildNetworkPortOptions(networkPorts),
      visibleWhen: (values) => Boolean(values.is_network)
    },
    {
      name: "has_serial_interfaces",
      label: t("pagesUi.equipmentTypes.fields.hasSerialInterfaces"),
      type: "checkbox"
    },
    {
      name: "serial_ports",
      label: t("pagesUi.equipmentTypes.serialPorts.title"),
      type: "ports",
      options: serialPortOptions,
      visibleWhen: (values) => Boolean(values.has_serial_interfaces),
      portsLabels: {
        title: t("pagesUi.equipmentTypes.serialPorts.title"),
        add: t("pagesUi.equipmentTypes.serialPorts.add"),
        portType: t("pagesUi.equipmentTypes.serialPorts.portType"),
        count: t("pagesUi.equipmentTypes.serialPorts.count")
      }
    },
    { name: "unit_price_rub", label: t("common.fields.priceRub"), type: "number" }
  ];

  const buildDialogValues = (equipment?: EquipmentType) => {
    const electrical = equipment ? getEquipmentElectricalFields(equipment) : {};
    return {
      ...(equipment || {}),
      article: equipment?.article || "",
      role_in_power_chain: electrical.role_in_power_chain || "passive",
      current_type: electrical.current_type || "",
      supply_voltage: electrical.supply_voltage || "",
      top_current_type: electrical.top_current_type || "",
      top_supply_voltage: electrical.top_supply_voltage || "",
      bottom_current_type: electrical.bottom_current_type || "",
      bottom_supply_voltage: electrical.bottom_supply_voltage || "",
      current_value_a: electrical.current_value_a ?? "",
      converter_current_value_a: electrical.current_value_a ?? "",
      mount_type: equipment?.mount_type || "",
      mount_width_mm: equipment?.mount_width_mm ?? "",
      manufacturer_id:
        equipment && manufacturerOptions.some((item) => item.id === equipment.manufacturer_id)
          ? equipment.manufacturer_id
          : "",
      equipment_category_id:
        equipment && equipmentCategoryOptions.some((item) => item.id === equipment.equipment_category_id)
          ? equipment.equipment_category_id
          : "",
      is_channel_forming: equipment?.is_channel_forming ?? false,
      ai_count: equipment?.ai_count ?? 0,
      di_count: equipment?.di_count ?? 0,
      ao_count: equipment?.ao_count ?? 0,
      do_count: equipment?.do_count ?? 0,
      is_network: equipment?.is_network ?? false,
      network_ports: equipment?.network_ports || [],
      has_serial_interfaces: equipment?.has_serial_interfaces ?? false,
      serial_ports: equipment?.serial_ports || [],
      unit_price_rub: equipment?.unit_price_rub ?? ""
    };
  };

  const buildEquipmentTypePayload = (values: Record<string, any>) => {
    if (
      values.is_network &&
      ((values.network_ports as NetworkPort[] | undefined) || []).some((item) =>
        legacyNetworkPortValues.has(item?.type)
      )
    ) {
      throw new Error(t("pagesUi.equipmentTypes.validation.networkPortsDisallowSerial"));
    }

    const parseNullableNumber = (value: unknown, errorKey: string) => {
      if (value === "" || value === undefined || value === null) {
        return null;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(t(errorKey));
      }
      return parsed;
    };

    const manufacturerId =
      values.manufacturer_id === "" || values.manufacturer_id === undefined
        ? undefined
        : Number(values.manufacturer_id);
    const equipmentCategoryId =
      values.equipment_category_id === "" || values.equipment_category_id === undefined
        ? undefined
        : Number(values.equipment_category_id);
    const currentValue = parseNullableNumber(
      values.current_value_a,
      "pagesUi.equipmentTypes.validation.currentConsumptionInvalid"
    );

    const role = (values.role_in_power_chain ? String(values.role_in_power_chain) : "passive") as PowerRole;

    return {
      name: String(values.name || ""),
      nomenclature_number: String(values.nomenclature_number || ""),
      article: values.article ? String(values.article) : null,
      role_in_power_chain: role,
      power_attributes: {
        role_in_power_chain: role,
        current_type: values.current_type ? String(values.current_type) : null,
        supply_voltage: values.supply_voltage ? String(values.supply_voltage) : null,
        top_current_type: values.top_current_type ? String(values.top_current_type) : null,
        top_supply_voltage: values.top_supply_voltage ? String(values.top_supply_voltage) : null,
        bottom_current_type: values.bottom_current_type ? String(values.bottom_current_type) : null,
        bottom_supply_voltage: values.bottom_supply_voltage ? String(values.bottom_supply_voltage) : null,
        current_value_a: currentValue
      },
      mount_type: values.mount_type ? String(values.mount_type) : null,
      mount_width_mm:
        values.mount_width_mm === "" || values.mount_width_mm === undefined
          ? null
          : Number(values.mount_width_mm),
      manufacturer_id: manufacturerId,
      equipment_category_id: equipmentCategoryId,
      is_channel_forming: Boolean(values.is_channel_forming),
      ai_count: Number(values.ai_count || 0),
      di_count: Number(values.di_count || 0),
      ao_count: Number(values.ao_count || 0),
      do_count: Number(values.do_count || 0),
      is_network: Boolean(values.is_network),
      network_ports: values.is_network
        ? (((values.network_ports as NetworkPort[] | undefined) || [])
            .filter((item) => item?.type)
            .map((item) => ({
              type: item.type,
              count: Number(item.count || 0)
            })))
        : undefined,
      has_serial_interfaces: Boolean(values.has_serial_interfaces),
      serial_ports: values.has_serial_interfaces
        ? (((values.serial_ports as SerialPort[] | undefined) || [])
            .filter((item) => item?.type)
            .map((item) => ({
              type: item.type,
              count: Number(item.count || 0)
            })))
        : [],
      unit_price_rub:
        values.unit_price_rub === "" || values.unit_price_rub === undefined
          ? undefined
          : Number(values.unit_price_rub)
    } satisfies Partial<EquipmentType>;
  };

  const saveEquipmentType = async (
    payload: Partial<EquipmentType>,
    equipmentId?: number
  ): Promise<EquipmentType> => {
    const fallbackMessage = equipmentId
      ? t("pagesUi.equipmentTypes.errors.update")
      : t("pagesUi.equipmentTypes.errors.create");
    const photo = photoFileRef.current;
    const datasheet = datasheetFileRef.current;
    const isEdit = Boolean(equipmentId);
    const editId = equipmentId ?? null;
    console.log("[ET] submit start", {
      isEdit,
      editId,
      hasPhoto: Boolean(photo),
      hasDatasheet: Boolean(datasheet)
    });
    try {
      const result = equipmentId
        ? await updateMutation.mutateAsync({ id: equipmentId, payload })
        : await createMutation.mutateAsync(payload);
      console.log("[ET] saved", result);
      const targetId = equipmentId ?? result.id;
      console.log("[ET] id for upload", targetId);
      if (photo || datasheet) {
        if (photo) {
          console.log("[ET] uploading photo...", {
            id: targetId,
            name: photo?.name,
            size: photo?.size
          });
          await uploadEquipmentTypePhoto(targetId, photo);
          console.log("[ET] uploaded photo OK");
        }
        if (datasheet) {
          console.log("[ET] uploading datasheet...", {
            id: targetId,
            name: datasheet?.name,
            size: datasheet?.size
          });
          await uploadEquipmentTypeDatasheet(targetId, datasheet);
          console.log("[ET] uploaded datasheet OK");
        }
      }
      refresh();
      return result;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : fallbackMessage;
      setErrorMessage(`Upload failed: ${message}`);
      throw error;
    }
  };

  const renderMediaInputs = () => (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography variant="subtitle2">{t("common.fields.photo")}</Typography>
      <Button component="label" variant="outlined" size="small">
        {t("pagesUi.equipmentTypes.actions.uploadPhoto")}
        <input
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPickPhoto}
        />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {photoFile ? photoFile.name : "-"}
      </Typography>
      <Typography variant="subtitle2">{t("common.fields.datasheet")}</Typography>
      <Button component="label" variant="outlined" size="small">
        {t("pagesUi.equipmentTypes.actions.uploadDatasheet")}
        <input
          hidden
          type="file"
          accept=".pdf,.xlsx,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onPickDatasheet}
        />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {datasheetFile ? datasheetFile.name : "-"}
      </Typography>
    </Box>
  );

  useEffect(() => {
    if (!dialog?.open) {
      return;
    }
    setDialog((prev) => (prev ? { ...prev, renderExtra: renderMediaInputs } : prev));
  }, [datasheetFile, dialog?.open, photoFile]);

  const createMutation = useMutation({
    mutationFn: (payload: Partial<EquipmentType>) => createEntity<EquipmentType>("/equipment-types", payload)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<EquipmentType> }) =>
      updateEntity<EquipmentType>("/equipment-types", id, payload)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/equipment-types", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.equipmentTypes.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/equipment-types", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.equipmentTypes.errors.restore"))
  });

  const columns = useMemo<ColumnDef<EquipmentType>[]>(() => {
    const base: ColumnDef<EquipmentType>[] = [
      { header: t("common.fields.name"), accessorKey: "name" },
      {
        header: t("common.fields.photo"),
        cell: ({ row }) => (
          <ProtectedImage
            url={row.original.photo_url || null}
            alt={row.original.name}
            width={44}
            height={44}
            previewOnHover={true}
            previewMaxWidth={700}
            previewMaxHeight={700}
            fallback="-"
          />
        )
      },
      {
        header: t("common.fields.datasheet"),
        cell: ({ row }) => (
          <ProtectedDownloadLink
            url={row.original.datasheet_url || null}
            filename={row.original.datasheet_name}
            icon={getFileIcon(row.original.datasheet_name)}
            size="small"
          />
        )
      },
      {
        header: t("pagesUi.equipmentTypes.fields.article"),
        cell: ({ row }) => row.original.article || "-"
      },
      { header: t("common.fields.nomenclature"), accessorKey: "nomenclature_number" },
      {
        header: "Питание",
        cell: ({ row }) => {
          const electrical = getEquipmentElectricalFields(row.original);
          return (
            <Tooltip title={<Typography whiteSpace="pre-line">{buildPowerTooltipContent(electrical)}</Typography>}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <InfoOutlinedIcon fontSize="small" color="action" />
                <Typography variant="body2">{getPowerRoleLabel(electrical.role_in_power_chain)}</Typography>
              </Box>
            </Tooltip>
          );
        }
      },
      {
        header: t("common.fields.manufacturer"),
        cell: ({ row }) =>
          manufacturerMap.get(row.original.manufacturer_id) || row.original.manufacturer_id
      },
      {
        header: t("common.fields.equipmentCategory"),
        cell: ({ row }) => {
          const currentId = row.original.equipment_category_id;
          return currentId ? equipmentCategoryMap.get(currentId) || currentId : "-";
        }
      },
      {
        header: t("pagesUi.equipmentTypes.columns.channelsDetailed"),
        cell: ({ row }) => {
          if (!row.original.is_channel_forming) {
            return t("common.no");
          }
          const ai = row.original.ai_count || 0;
          const di = row.original.di_count || 0;
          const ao = row.original.ao_count || 0;
          const doCount = row.original.do_count || 0;
          const total = ai + di + ao + doCount;
          const fallbackAi = total === 0 && row.original.channel_count > 0 ? row.original.channel_count : ai;
          return `AI ${fallbackAi} / DI ${di} / AO ${ao} / DO ${doCount}`;
        }
      },
      {
        header: t("common.fields.portsInterfaces"),
        cell: ({ row }) => {
          if (!row.original.is_network || !row.original.network_ports?.length) {
            return "-";
          }
          return row.original.network_ports
            .filter((item) => item.type)
            .map((item) => `${item.type}[${item.count ?? 0}]`)
            .join(", ");
        }
      },
      {
        header: t("pagesUi.equipmentTypes.fields.hasSerialInterfaces"),
        cell: ({ row }) =>
          formatSerialPorts(row.original.serial_ports, row.original.has_serial_interfaces)
      },
      {
        header: t("common.fields.priceRub"),
        cell: ({ row }) =>
          row.original.unit_price_rub === null || row.original.unit_price_rub === undefined
            ? "-"
            : row.original.unit_price_rub
      }
    ];

    if (canWrite) {
      base.push({
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() => {
                resetMediaFiles();
                setDialog({
                  open: true,
                  title: t("pagesUi.equipmentTypes.dialogs.editTitle"),
                  fields: buildDialogFields(row.original.network_ports),
                  values: buildDialogValues(row.original),
                  renderExtra: renderMediaInputs,
                  onSave: async (values) => {
                    try {
                      await saveEquipmentType(buildEquipmentTypePayload(values), row.original.id);
                    } catch (error) {
                      setErrorMessage(
                        error instanceof Error ? error.message : t("pagesUi.equipmentTypes.errors.update")
                      );
                      throw error;
                    }
                  }
                });
              }}
            >
              {t("actions.edit")}
            </AppButton>
            <AppButton
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={
                row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />
              }
              onClick={() =>
                row.original.is_deleted
                  ? restoreMutation.mutate(row.original.id)
                  : deleteMutation.mutate(row.original.id)
              }
            >
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </AppButton>
          </Box>
        )
      });
    }

    return base;
  }, [
    canWrite,
    deleteMutation,
    equipmentCategoryMap,
    equipmentCategoryOptions,
    equipmentCategoryTreeOptions,
    manufacturerMap,
    manufacturerOptions,
    manufacturerTreeOptions,
    restoreMutation,
    buildDialogFields,
    buildDialogValues,
    buildEquipmentTypePayload,
    renderMediaInputs,
    resetMediaFiles,
    saveEquipmentType,
    t,
    updateMutation
  ]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pagesUi.equipmentTypes.title")}</Typography>
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

            <SearchableSelectField
              label={t("common.fields.manufacturer")}
              value={manufacturerFilter}
              options={manufacturerOptions.map((item) => ({
                value: item.id,
                label: item.full_path || item.name
              }))}
              onChange={(nextValue) => {
                setManufacturerFilter(nextValue === "" ? "" : Number(nextValue));
                setPage(1);
              }}
              emptyOptionLabel={t("common.all")}
              fullWidth
            />

            <SearchableSelectField
              label={t("common.fields.channelForming")}
              value={channelFormingFilter}
              options={[
                { value: "true", label: t("common.yes") },
                { value: "false", label: t("common.no") }
              ]}
              onChange={(nextValue) => {
                setChannelFormingFilter(nextValue as "" | "true" | "false");
                setPage(1);
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
                    setPage(1);
                  }}
                />
              }
              label={t("common.showDeleted")}
            />
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  resetMediaFiles();
                  setDialog({
                    open: true,
                    title: t("pagesUi.equipmentTypes.dialogs.createTitle"),
                    fields: buildDialogFields(),
                    values: buildDialogValues(),
                    renderExtra: renderMediaInputs,
                    onSave: async (values) => {
                      try {
                        await saveEquipmentType(buildEquipmentTypePayload(values));
                      } catch (error) {
                        setErrorMessage(
                          error instanceof Error ? error.message : t("pagesUi.equipmentTypes.errors.create")
                        );
                        throw error;
                      }
                    }
                  });
                }}
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable data={equipmentQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
            count={equipmentQuery.data?.total || 0}
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

      {dialog && <EntityDialog state={dialog} onClose={handleDialogClose} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}



