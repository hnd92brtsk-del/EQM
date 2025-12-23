import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
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

import { DataTable } from "../components/DataTable";
import { DictionariesTabs } from "../components/DictionariesTabs";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

type EquipmentType = {
  id: number;
  name: string;
  nomenclature_number: string;
  manufacturer_id: number;
  is_channel_forming: boolean;
  channel_count: number;
  unit_price_rub?: number | null;
  is_deleted: boolean;
  created_at?: string;
};

type Manufacturer = { id: number; name: string };

const sortOptions = [
  { value: "name", label: "По названию (А-Я)" },
  { value: "-name", label: "По названию (Я-А)" },
  { value: "nomenclature_number", label: "По номенклатуре (А-Я)" },
  { value: "-nomenclature_number", label: "По номенклатуре (Я-А)" },
  { value: "created_at", label: "По дате создания (старые)" },
  { value: "-created_at", label: "По дате создания (новые)" }
];

const pageSizeOptions = [10, 20, 50, 100];

export default function EquipmentTypesPage() {
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

  useEffect(() => {
    if (equipmentQuery.error) {
      setErrorMessage(
        equipmentQuery.error instanceof Error
          ? equipmentQuery.error.message
          : "Ошибка загрузки номенклатуры"
      );
    }
  }, [equipmentQuery.error]);

  const manufacturerMap = useMemo(() => {
    const map = new Map<number, string>();
    manufacturersQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [manufacturersQuery.data?.items]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["equipment-types"] });
    queryClient.invalidateQueries({ queryKey: ["manufacturers-options"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Partial<EquipmentType>) => createEntity("/equipment-types", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка создания типа оборудования")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<EquipmentType> }) =>
      updateEntity("/equipment-types", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления типа оборудования")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/equipment-types", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка удаления типа оборудования")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/equipment-types", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка восстановления типа оборудования")
  });

  const columns = useMemo<ColumnDef<EquipmentType>[]>(() => {
    const base: ColumnDef<EquipmentType>[] = [
      { header: "Название", accessorKey: "name" },
      { header: "Номенклатура", accessorKey: "nomenclature_number" },
      {
        header: "Производитель",
        cell: ({ row }) =>
          manufacturerMap.get(row.original.manufacturer_id) || row.original.manufacturer_id
      },
      {
        header: "Каналы",
        cell: ({ row }) =>
          row.original.is_channel_forming ? `Да (${row.original.channel_count})` : "Нет"
      },
      {
        header: "Цена, RUB",
        cell: ({ row }) =>
          row.original.unit_price_rub === null || row.original.unit_price_rub === undefined
            ? "-"
            : row.original.unit_price_rub
      },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удалено" : "Активно"}</span>
        )
      }
    ];

    if (canWrite) {
      base.push({
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Тип оборудования",
                  fields: [
                    { name: "name", label: "Название", type: "text" },
                    { name: "nomenclature_number", label: "Номенклатура", type: "text" },
                    {
                      name: "manufacturer_id",
                      label: "Производитель",
                      type: "select",
                      options:
                        manufacturersQuery.data?.items.map((m) => ({
                          label: m.name,
                          value: m.id
                        })) || []
                    },
                    { name: "is_channel_forming", label: "Каналообразующее", type: "checkbox" },
                    { name: "channel_count", label: "Кол-во каналов", type: "number" },
                    { name: "unit_price_rub", label: "Цена, RUB", type: "number" }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    const manufacturerId =
                      values.manufacturer_id === "" || values.manufacturer_id === undefined
                        ? undefined
                        : Number(values.manufacturer_id);
                    updateMutation.mutate({
                      id: row.original.id,
                      payload: {
                        name: values.name,
                        nomenclature_number: values.nomenclature_number,
                        manufacturer_id: manufacturerId,
                        is_channel_forming: values.is_channel_forming,
                        channel_count: values.channel_count,
                        unit_price_rub: values.unit_price_rub === "" ? undefined : values.unit_price_rub
                      }
                    });
                    setDialog(null);
                  }
                })
              }
            >
              Изменить
            </Button>
            <Button
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
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </Button>
          </Box>
        )
      });
    }

    return base;
  }, [
    canWrite,
    deleteMutation,
    manufacturerMap,
    manufacturersQuery.data?.items,
    restoreMutation,
    updateMutation
  ]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Справочники</Typography>
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
              label="Поиск"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Сортировка</InputLabel>
              <Select label="Сортировка" value={sort} onChange={(event) => setSort(event.target.value)}>
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Производитель</InputLabel>
              <Select
                label="Производитель"
                value={manufacturerFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setManufacturerFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">Все</MenuItem>
                {manufacturersQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Каналообразующее</InputLabel>
              <Select
                label="Каналообразующее"
                value={channelFormingFilter}
                onChange={(event) => {
                  setChannelFormingFilter(event.target.value as "" | "true" | "false");
                  setPage(1);
                }}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="true">Да</MenuItem>
                <MenuItem value="false">Нет</MenuItem>
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
              label="Показывать удаленные"
            />
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: "Новый тип оборудования",
                    fields: [
                      { name: "name", label: "Название", type: "text" },
                      { name: "nomenclature_number", label: "Номенклатура", type: "text" },
                      {
                        name: "manufacturer_id",
                        label: "Производитель",
                        type: "select",
                        options:
                          manufacturersQuery.data?.items.map((m) => ({
                            label: m.name,
                            value: m.id
                          })) || []
                      },
                      { name: "is_channel_forming", label: "Каналообразующее", type: "checkbox" },
                      { name: "channel_count", label: "Кол-во каналов", type: "number" },
                      { name: "unit_price_rub", label: "Цена, RUB", type: "number" }
                    ],
                    values: {
                      name: "",
                      nomenclature_number: "",
                      manufacturer_id: "",
                      is_channel_forming: false,
                      channel_count: 0,
                      unit_price_rub: ""
                    },
                    onSave: (values) => {
                      const manufacturerId =
                        values.manufacturer_id === "" || values.manufacturer_id === undefined
                          ? undefined
                          : Number(values.manufacturer_id);
                      createMutation.mutate({
                        name: values.name,
                        nomenclature_number: values.nomenclature_number,
                        manufacturer_id: manufacturerId,
                        is_channel_forming: values.is_channel_forming,
                        channel_count: values.channel_count,
                        unit_price_rub: values.unit_price_rub === "" ? undefined : values.unit_price_rub
                      });
                      setDialog(null);
                    }
                  })
                }
              >
                Добавить
              </Button>
            )}
          </Box>

          <DataTable data={equipmentQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
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
