import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Autocomplete,
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
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { uploadEquipmentTypeDatasheet, uploadEquipmentTypePhoto } from "../api/equipmentTypeMedia";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { ProtectedImage } from "../components/ProtectedImage";
import { ProtectedDownloadLink } from "../components/ProtectedDownloadLink";

type EquipmentType = {
  id: number;
  name: string;
  article?: string | null;
  nomenclature_number: string;
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

type Manufacturer = { id: number; name: string };
type EquipmentCategory = { id: number; name: string };
type NetworkPort = { type: string; count: number };
type SerialPort = { type: string; count: number };

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
const legacyNetworkPortValues = new Set(["RS-485", "RS-232"]);
const photoExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const datasheetExtensions = [".pdf", ".xlsx", ".doc", ".docx"];
const maxPhotoSize = 500 * 1024;
const maxDatasheetSize = 5 * 1024 * 1024;

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
    queryKey: ["manufacturers-options"],
    queryFn: () =>
      listEntity<Manufacturer>("/manufacturers", {
        page: 1,
        page_size: 200,
        is_deleted: false
      })
  });

  const equipmentCategoriesQuery = useQuery({
    queryKey: ["equipment-categories-options"],
    queryFn: () =>
      listEntity<EquipmentCategory>("/equipment-categories", {
        page: 1,
        page_size: 200,
        is_deleted: false
      })
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
    manufacturersQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [manufacturersQuery.data?.items]);

  const equipmentCategoryMap = useMemo(() => {
    const map = new Map<number, string>();
    equipmentCategoriesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [equipmentCategoriesQuery.data?.items]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["equipment-types"] });
    queryClient.invalidateQueries({ queryKey: ["manufacturers-options"] });
    queryClient.invalidateQueries({ queryKey: ["equipment-categories-options"] });
  };

  const handleDialogClose = () => {
    setDialog(null);
    resetMediaFiles();
  };

  const saveEquipmentType = async (payload: Partial<EquipmentType>, equipmentId?: number) => {
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
        header: t("common.fields.manufacturer"),
        cell: ({ row }) =>
          manufacturerMap.get(row.original.manufacturer_id) || row.original.manufacturer_id
      },
      {
        header: t("common.fields.equipmentCategory"),
        cell: ({ row }) => {
          const currentId = row.original.equipment_category_id;
          if (!canWrite) {
            return currentId ? equipmentCategoryMap.get(currentId) || currentId : "-";
          }
          const options = equipmentCategoriesQuery.data?.items || [];
          const currentOption =
            options.find((option) => option.id === currentId) || null;
          return (
            <Autocomplete
              options={options}
              value={currentOption}
              onChange={(_, option) =>
                updateMutation.mutate({
                  id: row.original.id,
                  payload: { equipment_category_id: option ? option.id : null }
                })
              }
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField {...params} variant="standard" placeholder={t("actions.notSelected")} />
              )}
              size="small"
            />
          );
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
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    { name: "nomenclature_number", label: t("common.fields.nomenclature"), type: "text" },
                    { name: "article", label: t("pagesUi.equipmentTypes.fields.article"), type: "text" },
                    {
                      name: "manufacturer_id",
                      label: t("common.fields.manufacturer"),
                      type: "select",
                      options:
                        manufacturersQuery.data?.items.map((m) => ({
                          label: m.name,
                          value: m.id
                        })) || []
                    },
                    {
                      name: "equipment_category_id",
                      label: t("common.fields.equipmentCategory"),
                      type: "select",
                      options:
                        equipmentCategoriesQuery.data?.items.map((category) => ({
                          label: category.name,
                          value: category.id
                        })) || []
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
                      options: buildNetworkPortOptions(row.original.network_ports),
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
                  ],
                  values: row.original,
                  renderExtra: renderMediaInputs,
                  onSave: (values) => {
                    if (
                      values.is_network &&
                      (values.network_ports || []).some(
                        (item: NetworkPort) => legacyNetworkPortValues.has(item?.type)
                      )
                    ) {
                      setErrorMessage(t("pagesUi.equipmentTypes.validation.networkPortsDisallowSerial"));
                      return;
                    }
                    const manufacturerId =
                      values.manufacturer_id === "" || values.manufacturer_id === undefined
                        ? undefined
                        : Number(values.manufacturer_id);
                    const equipmentCategoryId =
                      values.equipment_category_id === "" || values.equipment_category_id === undefined
                        ? undefined
                        : Number(values.equipment_category_id);
                    saveEquipmentType(
                      {
                        name: values.name,
                        nomenclature_number: values.nomenclature_number,
                        article: values.article || null,
                        manufacturer_id: manufacturerId,
                        equipment_category_id: equipmentCategoryId,
                        is_channel_forming: values.is_channel_forming,
                        ai_count: Number(values.ai_count || 0),
                        di_count: Number(values.di_count || 0),
                        ao_count: Number(values.ao_count || 0),
                        do_count: Number(values.do_count || 0),
                        is_network: values.is_network,
                        network_ports: values.is_network
                          ? (values.network_ports || [])
                              .filter((item: NetworkPort) => item?.type)
                              .map((item: NetworkPort) => ({
                                type: item.type,
                                count: Number(item.count || 0)
                              }))
                          : undefined,
                        has_serial_interfaces: values.has_serial_interfaces,
                        serial_ports: values.has_serial_interfaces
                          ? (values.serial_ports || [])
                              .filter((item: SerialPort) => item?.type)
                              .map((item: SerialPort) => ({
                                type: item.type,
                                count: Number(item.count || 0)
                              }))
                          : [],
                        unit_price_rub: values.unit_price_rub === "" ? undefined : values.unit_price_rub
                      },
                      row.original.id
                    );
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
    equipmentCategoriesQuery.data?.items,
    manufacturerMap,
    manufacturersQuery.data?.items,
    restoreMutation,
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
              <InputLabel>{t("common.fields.channelForming")}</InputLabel>
              <Select
                label={t("common.fields.channelForming")}
                value={channelFormingFilter}
                onChange={(event) => {
                  setChannelFormingFilter(event.target.value as "" | "true" | "false");
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                <MenuItem value="true">{t("common.yes")}</MenuItem>
                <MenuItem value="false">{t("common.no")}</MenuItem>
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
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  resetMediaFiles();
                  setDialog({
                    open: true,
                    title: t("pagesUi.equipmentTypes.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      { name: "nomenclature_number", label: t("common.fields.nomenclature"), type: "text" },
                      { name: "article", label: t("pagesUi.equipmentTypes.fields.article"), type: "text" },
                      {
                        name: "manufacturer_id",
                        label: t("common.fields.manufacturer"),
                        type: "select",
                        options:
                          manufacturersQuery.data?.items.map((m) => ({
                            label: m.name,
                            value: m.id
                          })) || []
                      },
                    {
                      name: "equipment_category_id",
                      label: t("common.fields.equipmentCategory"),
                      type: "select",
                      options:
                        equipmentCategoriesQuery.data?.items.map((category) => ({
                          label: category.name,
                          value: category.id
                        })) || []
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
                        options: networkPortOptions,
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
                    ],
                    values: {
                      name: "",
                      article: "",
                      nomenclature_number: "",
                      manufacturer_id: "",
                      equipment_category_id: "",
                      is_channel_forming: false,
                      ai_count: 0,
                      di_count: 0,
                      ao_count: 0,
                      do_count: 0,
                      is_network: false,
                      network_ports: [],
                      has_serial_interfaces: false,
                      serial_ports: [],
                      unit_price_rub: ""
                    },
                    renderExtra: renderMediaInputs,
                    onSave: (values) => {
                      try {
                        if (
                          values.is_network &&
                          (values.network_ports || []).some(
                            (item: NetworkPort) => legacyNetworkPortValues.has(item?.type)
                          )
                        ) {
                          setErrorMessage(t("pagesUi.equipmentTypes.validation.networkPortsDisallowSerial"));
                          return;
                        }
                        const manufacturerId =
                          values.manufacturer_id === "" || values.manufacturer_id === undefined
                            ? undefined
                            : Number(values.manufacturer_id);
                        const equipmentCategoryId =
                          values.equipment_category_id === "" ||
                          values.equipment_category_id === undefined
                            ? undefined
                            : Number(values.equipment_category_id);
                        saveEquipmentType({
                          name: values.name,
                          nomenclature_number: values.nomenclature_number,
                          article: values.article || null,
                          manufacturer_id: manufacturerId,
                          equipment_category_id: equipmentCategoryId,
                          is_channel_forming: values.is_channel_forming,
                          ai_count: Number(values.ai_count || 0),
                          di_count: Number(values.di_count || 0),
                          ao_count: Number(values.ao_count || 0),
                          do_count: Number(values.do_count || 0),
                          is_network: values.is_network,
                          network_ports: values.is_network
                            ? (values.network_ports || [])
                                .filter((item: NetworkPort) => item?.type)
                                .map((item: NetworkPort) => ({
                                  type: item.type,
                                  count: Number(item.count || 0)
                                }))
                            : undefined,
                          has_serial_interfaces: values.has_serial_interfaces,
                          serial_ports: values.has_serial_interfaces
                            ? (values.serial_ports || [])
                                .filter((item: SerialPort) => item?.type)
                                .map((item: SerialPort) => ({
                                  type: item.type,
                                  count: Number(item.count || 0)
                                }))
                            : [],
                          unit_price_rub: values.unit_price_rub === "" ? undefined : values.unit_price_rub
                        });
                      } catch (error) {
                        setErrorMessage(
                          error instanceof Error
                            ? error.message
                            : t("pagesUi.equipmentTypes.errors.create")
                        );
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



