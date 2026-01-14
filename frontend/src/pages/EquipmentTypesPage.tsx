import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,Card,
  CardContent,
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
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";

type EquipmentType = {
  id: number;
  name: string;
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
  unit_price_rub?: number | null;
  is_deleted: boolean;
  created_at?: string;
};

type Manufacturer = { id: number; name: string };
type EquipmentCategory = { id: number; name: string };
type NetworkPort = { type: string; count: number };

const pageSizeOptions = [10, 20, 50, 100];
const networkPortOptions = [
  { label: "RJ-45 (8p8c)", value: "RJ-45 (8p8c)" },
  { label: "LC", value: "LC" },
  { label: "SC", value: "SC" },
  { label: "FC", value: "FC" },
  { label: "ST", value: "ST" },
  { label: "RS-485", value: "RS-485" },
  { label: "RS-232", value: "RS-232" }
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

  const createMutation = useMutation({
    mutationFn: (payload: Partial<EquipmentType>) => createEntity("/equipment-types", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.equipmentTypes.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<EquipmentType> }) =>
      updateEntity("/equipment-types", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.equipmentTypes.errors.update"))
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
        header: t("common.fields.priceRub"),
        cell: ({ row }) =>
          row.original.unit_price_rub === null || row.original.unit_price_rub === undefined
            ? "-"
            : row.original.unit_price_rub
      },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
        )
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
              onClick={() =>
                setDialog({
                  open: true,
                  title: t("pagesUi.equipmentTypes.dialogs.editTitle"),
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    { name: "nomenclature_number", label: t("common.fields.nomenclature"), type: "text" },
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
                    { name: "unit_price_rub", label: t("common.fields.priceRub"), type: "number" }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    const manufacturerId =
                      values.manufacturer_id === "" || values.manufacturer_id === undefined
                        ? undefined
                        : Number(values.manufacturer_id);
                    const equipmentCategoryId =
                      values.equipment_category_id === "" || values.equipment_category_id === undefined
                        ? undefined
                        : Number(values.equipment_category_id);
                    updateMutation.mutate({
                      id: row.original.id,
                      payload: {
                        name: values.name,
                        nomenclature_number: values.nomenclature_number,
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
                        unit_price_rub: values.unit_price_rub === "" ? undefined : values.unit_price_rub
                      }
                    });
                    setDialog(null);
                  }
                })
              }
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
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.equipmentTypes.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      { name: "nomenclature_number", label: t("common.fields.nomenclature"), type: "text" },
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
                      { name: "unit_price_rub", label: t("common.fields.priceRub"), type: "number" }
                    ],
                    values: {
                      name: "",
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
                      unit_price_rub: ""
                    },
                    onSave: (values) => {
                      try {
                        const manufacturerId =
                          values.manufacturer_id === "" || values.manufacturer_id === undefined
                            ? undefined
                            : Number(values.manufacturer_id);
                        const equipmentCategoryId =
                          values.equipment_category_id === "" ||
                          values.equipment_category_id === undefined
                            ? undefined
                            : Number(values.equipment_category_id);
                        createMutation.mutate({
                          name: values.name,
                          nomenclature_number: values.nomenclature_number,
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
                          unit_price_rub: values.unit_price_rub === "" ? undefined : values.unit_price_rub
                        });
                        setDialog(null);
                      } catch (error) {
                        setErrorMessage(
                          error instanceof Error
                            ? error.message
                            : t("pagesUi.equipmentTypes.errors.create")
                        );
                      }
                    }
                  })
                }
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

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}



