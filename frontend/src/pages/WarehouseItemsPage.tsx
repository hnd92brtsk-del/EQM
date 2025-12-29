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

const sortOptions = [
  { value: "-updated_at", label: "По обновлению (новые)" },
  { value: "updated_at", label: "По обновлению (старые)" },
  { value: "-quantity", label: "По количеству (убыванию)" },
  { value: "quantity", label: "По количеству (возрастанию)" },
  { value: 'equipment_type_name', label: 'Equipment (A-Z)' },
  { value: '-equipment_type_name', label: 'Equipment (Z-A)' },
  { value: 'equipment_category_name', label: 'Equipment type (A-Z)' },
  { value: '-equipment_category_name', label: 'Equipment type (Z-A)' },
  { value: 'manufacturer_name', label: 'Manufacturer (A-Z)' },
  { value: '-manufacturer_name', label: 'Manufacturer (Z-A)' },
  { value: 'unit_price_rub', label: 'Price (low-high)' },
  { value: '-unit_price_rub', label: 'Price (high-low)' },
];

const pageSizeOptions = [10, 20, 50, 100];

type WarehouseItem = {
  id: number;
  warehouse_id: number;
  equipment_type_id: number;
  quantity: number;
  is_accounted: boolean;
  created_at?: string;
  updated_at?: string;
  is_deleted: boolean;
  equipment_type_name?: string | null;
  equipment_category_name?: string | null;
  manufacturer_name?: string | null;
  unit_price_rub?: number | null;
};

type Warehouse = { id: number; name: string };

type EquipmentType = { id: number; name: string };
type EquipmentCategory = { id: number; name: string };
type Manufacturer = { id: number; name: string };
type Cabinet = { id: number; name: string };

export default function WarehouseItemsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-updated_at");
  const [warehouseFilter, setWarehouseFilter] = useState<number | "">("");
  const [equipmentFilter, setEquipmentFilter] = useState<number | "">("");
  const [manufacturerFilter, setManufacturerFilter] = useState<number | "">("");
  const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState<number | "">("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const itemsQuery = useQuery({
    queryKey: [
      "warehouse-items",
      page,
      pageSize,
      q,
      sort,
      warehouseFilter,
      equipmentFilter,
      manufacturerFilter,
      equipmentCategoryFilter,
      priceMin,
      priceMax,
      showDeleted
    ],
    queryFn: () =>
      listEntity<WarehouseItem>("/warehouse-items", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        filters: {
          warehouse_id: warehouseFilter || undefined,
          equipment_type_id: equipmentFilter || undefined,
          manufacturer_id: manufacturerFilter || undefined,
          equipment_category_id: equipmentCategoryFilter || undefined,
          unit_price_rub_min: priceMin ? Number(priceMin) : undefined,
          unit_price_rub_max: priceMax ? Number(priceMax) : undefined
        },
        is_deleted: showDeleted ? true : false
      })
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses-options"],
    queryFn: () => listEntity<Warehouse>("/warehouses", { page: 1, page_size: 200 })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-options"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: 200 })
  });

  const equipmentCategoriesQuery = useQuery({
    queryKey: ["equipment-categories-options"],
    queryFn: () => listEntity<EquipmentCategory>("/equipment-categories", { page: 1, page_size: 200 })
  });

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers-options"],
    queryFn: () => listEntity<Manufacturer>("/manufacturers", { page: 1, page_size: 200 })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-options"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: 200 })
  });

  useEffect(() => {
    if (itemsQuery.error) {
      setErrorMessage(
        itemsQuery.error instanceof Error
          ? itemsQuery.error.message
          : "Ошибка загрузки складских позиций"
      );
    }
  }, [itemsQuery.error]);


  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["warehouse-items"] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<WarehouseItem> }) =>
      updateEntity("/warehouse-items", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to update warehouse item")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/warehouse-items", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete warehouse item")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/warehouse-items", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to restore warehouse item")
  });

  const warehouseMap = useMemo(() => {
    const map = new Map<number, string>();
    warehousesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [warehousesQuery.data?.items]);

  const equipmentMap = useMemo(() => {
    const map = new Map<number, string>();
    equipmentTypesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [equipmentTypesQuery.data?.items]);

  const movementMutation = useMutation({
    mutationFn: (payload: any) => createEntity("/movements", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-items"] });
      queryClient.invalidateQueries({ queryKey: ["cabinet-items"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      setDialog(null);
    },
    onError: (error) => {
      if (error instanceof Error && /not found|404/i.test(error.message)) {
        setErrorMessage("Not implemented");
        return;
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить действие. Попробуйте снова."
      );
    }
  });

  const openToWarehouseDialog = () => {
    setDialog({
      open: true,
      title: "На склад",
      fields: [
        {
          name: "equipment_type_id",
          label: "Оборудование",
          type: "select",
          options:
            equipmentTypesQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || []
        },
        {
          name: "to_warehouse_id",
          label: "Склад",
          type: "select",
          options:
            warehousesQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || []
        },
        { name: "quantity", label: "Количество", type: "number" },
        { name: "is_accounted", label: "Учет", type: "checkbox" },
        { name: "comment", label: "Комментарий", type: "text" }
      ],
      values: {
        equipment_type_id: "",
        to_warehouse_id: "",
        quantity: 1,
        is_accounted: true,
        comment: ""
      },
      onSave: (values) => {
        const equipmentTypeId = values.equipment_type_id ? Number(values.equipment_type_id) : 0;
        const warehouseId = values.to_warehouse_id ? Number(values.to_warehouse_id) : 0;
        const quantity = Number(values.quantity);

        if (!equipmentTypeId || !warehouseId || !Number.isFinite(quantity) || quantity < 1) {
          setErrorMessage("Заполните обязательные поля.");
          return;
        }

        movementMutation.mutate({
          movement_type: "to_warehouse",
          equipment_type_id: equipmentTypeId,
          to_warehouse_id: warehouseId,
          quantity,
          is_accounted: Boolean(values.is_accounted),
          comment: values.comment || undefined
        });
      }
    });
  };

  const openToCabinetDialog = () => {
    setDialog({
      open: true,
      title: "Со склада в шкаф",
      fields: [
        {
          name: "equipment_type_id",
          label: "Оборудование",
          type: "select",
          options:
            equipmentTypesQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || []
        },
        {
          name: "from_warehouse_id",
          label: "Со склада",
          type: "select",
          options:
            warehousesQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || []
        },
        {
          name: "to_cabinet_id",
          label: "В шкаф",
          type: "select",
          options:
            cabinetsQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || []
        },
        { name: "quantity", label: "Количество", type: "number" },
        { name: "comment", label: "Комментарий", type: "text" }
      ],
      values: {
        equipment_type_id: "",
        from_warehouse_id: "",
        to_cabinet_id: "",
        quantity: 1,
        comment: ""
      },
      onSave: (values) => {
        const equipmentTypeId = values.equipment_type_id ? Number(values.equipment_type_id) : 0;
        const fromWarehouseId = values.from_warehouse_id ? Number(values.from_warehouse_id) : 0;
        const toCabinetId = values.to_cabinet_id ? Number(values.to_cabinet_id) : 0;
        const quantity = Number(values.quantity);

        if (
          !equipmentTypeId ||
          !fromWarehouseId ||
          !toCabinetId ||
          !Number.isFinite(quantity) ||
          quantity < 1
        ) {
          setErrorMessage("Заполните обязательные поля.");
          return;
        }

        movementMutation.mutate({
          movement_type: "to_cabinet",
          equipment_type_id: equipmentTypeId,
          from_warehouse_id: fromWarehouseId,
          to_cabinet_id: toCabinetId,
          quantity,
          comment: values.comment || undefined
        });
      }
    });
  };

  const formatDateTime = (value?: string) => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const columns = useMemo<ColumnDef<WarehouseItem>[]>(() => {
    const base: ColumnDef<WarehouseItem>[] = [
      {
        header: "Warehouse",
        cell: ({ row }) => warehouseMap.get(row.original.warehouse_id) || row.original.warehouse_id
      },
      {
        header: "Equipment",
        cell: ({ row }) =>
          row.original.equipment_type_name ||
          equipmentMap.get(row.original.equipment_type_id) ||
          row.original.equipment_type_id
      },
      {
        header: "Equipment type",
        cell: ({ row }) => row.original.equipment_category_name || "-"
      },
      {
        header: "Manufacturer",
        cell: ({ row }) => row.original.manufacturer_name || "-"
      },
      {
        header: "Price, RUB",
        cell: ({ row }) =>
          row.original.unit_price_rub === null || row.original.unit_price_rub === undefined
            ? "-"
            : row.original.unit_price_rub
      },
      { header: "Quantity", accessorKey: "quantity" },
      {
        header: "Учёт",
        cell: ({ row }) => (row.original.is_accounted ? "Учтено" : "Не учтено")
      },
      { header: "Удалено", cell: ({ row }) => (row.original.is_deleted ? "Да" : "Нет") },
      {
        header: "Updated",
        cell: ({ row }) => formatDateTime(row.original.updated_at || row.original.created_at)
      }
    ];

    if (canWrite) {
      base.push({
        header: "Actions",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Edit warehouse item",
                  fields: [
                    { name: "quantity", label: "Quantity", type: "number" },
                    { name: "is_accounted", label: "Учёт", type: "checkbox" }
                  ],
                  values: {
                    quantity: row.original.quantity,
                    is_accounted: row.original.is_accounted
                  },
                  onSave: (values) => {
                    updateMutation.mutate({
                      id: row.original.id,
                      payload: {
                        quantity: values.quantity,
                        is_accounted: Boolean(values.is_accounted)
                      }
                    });
                    setDialog(null);
                  }
                })
              }
            >
              Edit
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
              {row.original.is_deleted ? "Restore" : "Delete"}
            </Button>
          </Box>
        )
      });
    }

    return base;
  }, [canWrite, deleteMutation, equipmentMap, restoreMutation, updateMutation, warehouseMap]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.warehouseItems")}</Typography>
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
              <InputLabel>Склад</InputLabel>
              <Select
                label="Склад"
                value={warehouseFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setWarehouseFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">Все</MenuItem>
                {warehousesQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Номенклатура</InputLabel>
              <Select
                label="Номенклатура"
                value={equipmentFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setEquipmentFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">???</MenuItem>
                {equipmentTypesQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Manufacturer</InputLabel>
              <Select
                label="Manufacturer"
                value={manufacturerFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setManufacturerFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {manufacturersQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Equipment category</InputLabel>
              <Select
                label="Equipment category"
                value={equipmentCategoryFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setEquipmentCategoryFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {equipmentCategoriesQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Price min"
              type="number"
              value={priceMin}
              onChange={(event) => {
                setPriceMin(event.target.value);
                setPage(1);
              }}
              fullWidth
            />

            <TextField
              label="Price max"
              type="number"
              value={priceMax}
              onChange={(event) => {
                setPriceMax(event.target.value);
                setPage(1);
              }}
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
              label="Show deleted"
            />
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button variant="contained" onClick={openToWarehouseDialog}>
              На склад
            </Button>
            <Button variant="contained" onClick={openToCabinetDialog}>
              Со склада в шкаф
            </Button>
          </Box>

          <DataTable data={itemsQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            count={itemsQuery.data?.total || 0}
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
