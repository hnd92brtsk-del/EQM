import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { type ColumnDef } from "@tanstack/react-table";
import { type TFunction } from "i18next";

import { type ColumnMeta } from "../../components/DataTable";
import {
  type DialogState,
  type FieldOption,
  type TreeFieldOption,
} from "../../components/EntityDialog";
import { AppButton } from "../../components/ui/AppButton";
import { type IOSignal, type IOSignalUpdate } from "../../api/ioSignals";

export const ioSignalTypeOptions: FieldOption[] = [
  { value: "AI", label: "AI" },
  { value: "AO", label: "AO" },
  { value: "DI", label: "DI" },
  { value: "DO", label: "DO" },
];

export type TreeSelectNode = {
  id: number;
  name: string;
  children?: TreeSelectNode[];
};

export type IOSignalLookupMaps = {
  dataTypeBreadcrumbs: Map<number | string, string>;
  signalKindBreadcrumbs: Map<number | string, string>;
  equipmentCategoryBreadcrumbs: Map<number | string, string>;
  measurementUnitBreadcrumbs: Map<number | string, string>;
};

export type IOSignalEditorResources = {
  signalTypeOptions: FieldOption[];
  signalKindLeafOptions: FieldOption[];
  measurementUnitLeafOptions: FieldOption[];
  dataTypeTreeOptions: TreeFieldOption[];
  equipmentCategoryTreeOptions: TreeFieldOption[];
};

const ioColumnMeta: Record<string, ColumnMeta<IOSignal>> = {
  channelIndex: {
    headerSx: { width: 96 },
    cellSx: { width: 96, whiteSpace: "nowrap" },
  },
  dataType: {
    headerSx: { width: 156 },
    cellSx: { width: 156 },
  },
  tag: {
    headerSx: { width: 104 },
    cellSx: { width: 104, whiteSpace: "nowrap" },
  },
  signal: {
    headerSx: { width: 128 },
    cellSx: { width: 128 },
  },
  plcAbsoluteAddress: {
    headerSx: { width: 148 },
    cellSx: { width: 148, whiteSpace: "nowrap" },
  },
  signalType: {
    headerSx: { width: 96 },
    cellSx: { width: 96, whiteSpace: "nowrap" },
  },
  signalKind: {
    headerSx: { width: 168 },
    cellSx: { width: 168 },
  },
  equipmentCategory: {
    headerSx: { width: 248 },
    cellSx: { width: 248 },
  },
  connectionPoint: {
    headerSx: { width: 152 },
    cellSx: { width: 152, whiteSpace: "nowrap" },
  },
  rangeFrom: {
    headerSx: { width: 116 },
    cellSx: { width: 116, whiteSpace: "nowrap" },
  },
  rangeTo: {
    headerSx: { width: 116 },
    cellSx: { width: 116, whiteSpace: "nowrap" },
  },
  fullRange: {
    headerSx: { width: 148 },
    cellSx: { width: 148 },
  },
  units: {
    headerSx: { width: 156 },
    cellSx: { width: 156 },
  },
  status: {
    headerSx: { width: 104 },
    cellSx: { width: 104, whiteSpace: "nowrap" },
  },
  actions: {
    headerSx: { width: 120 },
    cellSx: { width: 120, whiteSpace: "nowrap" },
  },
};

const formatTextValue = (value?: string | null) => (value?.trim() ? value : "-");

const normalizeNullableString = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizeNullableNumber = (value: unknown) => {
  if (value === "" || value === undefined || value === null) {
    return null;
  }
  return Number(value);
};

export function buildTreeSelectOptions(nodes: TreeSelectNode[]): TreeFieldOption[] {
  return nodes.map((node) => ({
    value: node.id,
    label: node.name,
    children: buildTreeSelectOptions(node.children || []),
  }));
}

export function buildIOSignalUpdatePayload(values: Record<string, unknown>): IOSignalUpdate {
  return {
    tag: normalizeNullableString(values.tag),
    signal: normalizeNullableString(values.signal),
    plc_absolute_address: normalizeNullableString(values.plc_absolute_address),
    data_type_id: normalizeNullableNumber(values.data_type_id),
    signal_kind_id: normalizeNullableNumber(values.signal_kind_id),
    equipment_category_id: normalizeNullableNumber(values.equipment_category_id),
    connection_point: normalizeNullableString(values.connection_point),
    range_from: normalizeNullableString(values.range_from),
    range_to: normalizeNullableString(values.range_to),
    full_range: normalizeNullableString(values.full_range),
    measurement_unit_id: normalizeNullableNumber(values.measurement_unit_id),
    is_active: Boolean(values.is_active),
  };
}

export function createIOSignalEditDialogState({
  t,
  signal,
  resources,
  onSave,
}: {
  t: TFunction;
  signal: IOSignal;
  resources: IOSignalEditorResources;
  onSave: (values: Record<string, unknown>) => Promise<void> | void;
}): DialogState {
  return {
    open: true,
    title: t("pagesUi.ioSignals.dialogs.editTitle"),
    fields: [
      {
        name: "signal_type",
        label: t("pagesUi.ioSignals.fields.signalType"),
        type: "select",
        options: resources.signalTypeOptions,
        disabledWhen: () => true,
      },
      {
        name: "channel_index",
        label: t("pagesUi.ioSignals.fields.channelIndex"),
        type: "number",
        disabledWhen: () => true,
      },
      { name: "tag", label: t("pagesUi.ioSignals.fields.tag"), type: "text" },
      { name: "signal", label: t("pagesUi.ioSignals.fields.signal"), type: "text" },
      {
        name: "plc_absolute_address",
        label: t("pagesUi.ioSignals.fields.plcAbsoluteAddress"),
        type: "text",
      },
      {
        name: "data_type_id",
        label: t("pagesUi.ioSignals.fields.dataType"),
        type: "treeSelect",
        treeOptions: resources.dataTypeTreeOptions,
        leafOnly: true,
      },
      {
        name: "signal_kind_id",
        label: t("pagesUi.ioSignals.fields.signalKind"),
        type: "select",
        options: resources.signalKindLeafOptions,
      },
      {
        name: "equipment_category_id",
        label: t("pagesUi.ioSignals.fields.fieldEquipment"),
        type: "treeSelect",
        treeOptions: resources.equipmentCategoryTreeOptions,
        leafOnly: true,
      },
      {
        name: "connection_point",
        label: t("pagesUi.ioSignals.fields.connectionPoint"),
        type: "text",
      },
      {
        name: "range_from",
        label: t("pagesUi.ioSignals.fields.rangeFrom"),
        type: "text",
      },
      {
        name: "range_to",
        label: t("pagesUi.ioSignals.fields.rangeTo"),
        type: "text",
      },
      {
        name: "full_range",
        label: t("pagesUi.ioSignals.fields.fullRange"),
        type: "text",
      },
      {
        name: "measurement_unit_id",
        label: t("pagesUi.ioSignals.fields.units"),
        type: "select",
        options: resources.measurementUnitLeafOptions,
      },
      { name: "is_active", label: t("pagesUi.ioSignals.fields.status"), type: "checkbox" },
    ],
    values: {
      ...signal,
      data_type_id: signal.data_type_id ?? "",
      signal_kind_id: signal.signal_kind_id ?? "",
      equipment_category_id: signal.equipment_category_id ?? "",
      measurement_unit_id: signal.measurement_unit_id ?? "",
      plc_absolute_address: signal.plc_absolute_address ?? "",
      connection_point: signal.connection_point ?? "",
      range_from: signal.range_from ?? "",
      range_to: signal.range_to ?? "",
      full_range: signal.full_range ?? "",
    },
    onSave,
  };
}

export function buildIOSignalColumns({
  t,
  canWrite,
  lookupMaps,
  onEdit,
}: {
  t: TFunction;
  canWrite: boolean;
  lookupMaps: IOSignalLookupMaps;
  onEdit?: (signal: IOSignal) => void;
}): ColumnDef<IOSignal>[] {
  const columns: ColumnDef<IOSignal>[] = [
    {
      id: "channelIndex",
      header: t("pagesUi.ioSignals.columns.channelIndex"),
      meta: ioColumnMeta.channelIndex,
      cell: ({ row }) => `${row.original.signal_type}-${row.original.channel_index}`,
    },
    {
      id: "dataType",
      header: t("pagesUi.ioSignals.columns.dataType"),
      meta: ioColumnMeta.dataType,
      cell: ({ row }) =>
        row.original.data_type_full_path ||
        (row.original.data_type_id
          ? lookupMaps.dataTypeBreadcrumbs.get(row.original.data_type_id) || row.original.data_type_id
          : "-"),
    },
    {
      id: "tag",
      header: t("pagesUi.ioSignals.columns.tag"),
      accessorKey: "tag",
      meta: ioColumnMeta.tag,
    },
    {
      id: "signal",
      header: t("pagesUi.ioSignals.columns.signal"),
      accessorKey: "signal",
      meta: ioColumnMeta.signal,
    },
    {
      id: "plcAbsoluteAddress",
      header: t("pagesUi.ioSignals.columns.plcAbsoluteAddress"),
      meta: ioColumnMeta.plcAbsoluteAddress,
      cell: ({ row }) => formatTextValue(row.original.plc_absolute_address),
    },
    {
      id: "signalType",
      header: t("pagesUi.ioSignals.columns.signalType"),
      accessorKey: "signal_type",
      meta: ioColumnMeta.signalType,
    },
    {
      id: "signalKind",
      header: t("pagesUi.ioSignals.columns.signalKind"),
      meta: ioColumnMeta.signalKind,
      cell: ({ row }) =>
        row.original.signal_kind_id
          ? lookupMaps.signalKindBreadcrumbs.get(row.original.signal_kind_id) || row.original.signal_kind_id
          : "-",
    },
    {
      id: "fieldEquipment",
      header: t("pagesUi.ioSignals.columns.fieldEquipment"),
      meta: ioColumnMeta.equipmentCategory,
      cell: ({ row }) =>
        row.original.equipment_category_full_path ||
        (row.original.equipment_category_id
          ? lookupMaps.equipmentCategoryBreadcrumbs.get(row.original.equipment_category_id) ||
            row.original.equipment_category_id
          : "-"),
    },
    {
      id: "connectionPoint",
      header: t("pagesUi.ioSignals.columns.connectionPoint"),
      meta: ioColumnMeta.connectionPoint,
      cell: ({ row }) => formatTextValue(row.original.connection_point),
    },
    {
      id: "rangeFrom",
      header: t("pagesUi.ioSignals.columns.rangeFrom"),
      meta: ioColumnMeta.rangeFrom,
      cell: ({ row }) => formatTextValue(row.original.range_from),
    },
    {
      id: "rangeTo",
      header: t("pagesUi.ioSignals.columns.rangeTo"),
      meta: ioColumnMeta.rangeTo,
      cell: ({ row }) => formatTextValue(row.original.range_to),
    },
    {
      id: "fullRange",
      header: t("pagesUi.ioSignals.columns.fullRange"),
      meta: ioColumnMeta.fullRange,
      cell: ({ row }) => formatTextValue(row.original.full_range),
    },
    {
      id: "units",
      header: t("pagesUi.ioSignals.columns.units"),
      meta: ioColumnMeta.units,
      cell: ({ row }) =>
        row.original.measurement_unit_full_path ||
        (row.original.measurement_unit_id
          ? lookupMaps.measurementUnitBreadcrumbs.get(row.original.measurement_unit_id) ||
            row.original.measurement_unit_id
          : "-"),
    },
    {
      id: "status",
      header: t("common.status.label"),
      meta: ioColumnMeta.status,
      cell: ({ row }) => (
        <span className="status-pill">
          {row.original.is_active ? t("common.status.active") : t("common.status.inactive")}
        </span>
      ),
    },
  ];

  if (canWrite && onEdit) {
    columns.push({
      id: "actions",
      header: t("actions.actions"),
      meta: ioColumnMeta.actions,
      cell: ({ row }) => (
        <AppButton size="small" startIcon={<EditRoundedIcon />} onClick={() => onEdit(row.original)}>
          {t("actions.edit")}
        </AppButton>
      ),
    });
  }

  return columns;
}
