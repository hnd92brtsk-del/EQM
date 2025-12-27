import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TablePagination,
  TextField,
  Typography
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, listEntity } from "../api/entities";

const sortOptions = [
  { value: "-last_updated", label: "По обновлению (новые)" },
  { value: "last_updated", label: "По обновлению (старые)" },
  { value: "-quantity", label: "По количеству (убыванию)" },
  { value: "quantity", label: "По количеству (возрастанию)" }
];

const pageSizeOptions = [10, 20, 50, 100];

type WarehouseItem = {
  id: number;
  warehouse_id: number;
  equipment_type_id: number;
  quantity: number;
  last_updated?: string;
};

type Warehouse = { id: number; name: string };

type EquipmentType = { id: number; name: string };
type Cabinet = { id: number; name: string };

export default function WarehouseItemsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-last_updated");
  const [warehouseFilter, setWarehouseFilter] = useState<number | "">("");
  const [equipmentFilter, setEquipmentFilter] = useState<number | "">("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const itemsQuery = useQuery({
    queryKey: ["warehouse-items", page, pageSize, q, sort, warehouseFilter, equipmentFilter],
    queryFn: () =>
      listEntity<WarehouseItem>("/warehouse-items", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        filters: {
          warehouse_id: warehouseFilter || undefined,
          equipment_type_id: equipmentFilter || undefined
        }
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

  const columns = useMemo<ColumnDef<WarehouseItem>[]>(
    () => [
      {
        header: "Склад",
        cell: ({ row }) => warehouseMap.get(row.original.warehouse_id) || row.original.warehouse_id
      },
      {
        header: "Номенклатура",
        cell: ({ row }) =>
          equipmentMap.get(row.original.equipment_type_id) || row.original.equipment_type_id
      },
      { header: "Количество", accessorKey: "quantity" },
      { header: "Обновлено", accessorKey: "last_updated" }
    ],
    [equipmentMap, warehouseMap]
  );

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
