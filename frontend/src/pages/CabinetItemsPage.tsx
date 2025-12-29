import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const sortOptions = [
  { value: "-created_at", label: "По дате (новые)" },
  { value: "created_at", label: "По дате (старые)" },
  { value: "-quantity", label: "По количеству (убыванию)" },
  { value: "quantity", label: "По количеству (возрастанию)" },
  { value: 'equipment_type_name', label: 'Equipment (A-Z)' },
  { value: '-equipment_type_name', label: 'Equipment (Z-A)' },
  { value: 'manufacturer_name', label: 'Manufacturer (A-Z)' },
  { value: '-manufacturer_name', label: 'Manufacturer (Z-A)' },
];

const pageSizeOptions = [10, 20, 50, 100];

type CabinetItem = {
  id: number;
  cabinet_id: number;
  equipment_type_id: number;
  quantity: number;
  is_deleted: boolean;
  equipment_type_name?: string | null;
  manufacturer_name?: string | null;
};

type Cabinet = { id: number; name: string };

type EquipmentType = { id: number; name: string };
type Manufacturer = { id: number; name: string };

export default function CabinetItemsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [cabinetFilter, setCabinetFilter] = useState<number | "">("");
  const [equipmentFilter, setEquipmentFilter] = useState<number | "">("");
  const [manufacturerFilter, setManufacturerFilter] = useState<number | "">("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<CabinetItem | null>(null);
  const [editQuantity, setEditQuantity] = useState(0);

  const itemsQuery = useQuery({
    queryKey: [
      "cabinet-items",
      page,
      pageSize,
      q,
      sort,
      cabinetFilter,
      equipmentFilter,
      manufacturerFilter,
      showDeleted
    ],
    queryFn: () =>
      listEntity<CabinetItem>("/cabinet-items", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        filters: {
          cabinet_id: cabinetFilter || undefined,
          equipment_type_id: equipmentFilter || undefined,
          manufacturer_id: manufacturerFilter || undefined
        },
        is_deleted: showDeleted ? true : false
      })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-options"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: 200 })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-options"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: 200 })
  });

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers-options"],
    queryFn: () => listEntity<Manufacturer>("/manufacturers", { page: 1, page_size: 200 })
  });

  useEffect(() => {
    if (itemsQuery.error) {
      setErrorMessage(
        itemsQuery.error instanceof Error
          ? itemsQuery.error.message
          : "Ошибка загрузки шкафных позиций"
      );
    }
  }, [itemsQuery.error]);


  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cabinet-items"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/cabinet-items", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete cabinet item")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/cabinet-items", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to restore cabinet item")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      updateEntity("/cabinet-items", id, { quantity }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cabinet-items"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления количества")
  });

  const cabinetMap = useMemo(() => {
    const map = new Map<number, string>();
    cabinetsQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [cabinetsQuery.data?.items]);

  const equipmentMap = useMemo(() => {
    const map = new Map<number, string>();
    equipmentTypesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [equipmentTypesQuery.data?.items]);

  const columns = useMemo<ColumnDef<CabinetItem>[]>(() => {
    const base: ColumnDef<CabinetItem>[] = [
      {
        header: "Cabinet",
        cell: ({ row }) => cabinetMap.get(row.original.cabinet_id) || row.original.cabinet_id
      },
      {
        header: "Equipment",
        cell: ({ row }) =>
          row.original.equipment_type_name ||
          equipmentMap.get(row.original.equipment_type_id) ||
          row.original.equipment_type_id
      },
      {
        header: "Manufacturer",
        cell: ({ row }) => row.original.manufacturer_name || "-"
      },
      { header: "Quantity", accessorKey: "quantity" },
      { header: "Удалено", cell: ({ row }) => (row.original.is_deleted ? "Да" : "Нет") }
    ];

    if (canWrite) {
      base.push({
        header: "Actions",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() => {
                setEditItem(row.original);
                setEditQuantity(row.original.quantity);
                setEditOpen(true);
              }}
            >
              {t("actions.edit")}
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
  }, [cabinetMap, canWrite, deleteMutation, equipmentMap, restoreMutation, t, i18n.language]);

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
              <InputLabel>Шкаф</InputLabel>
              <Select
                label="Шкаф"
                value={cabinetFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setCabinetFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">Все</MenuItem>
                {cabinetsQuery.data?.items.map((item) => (
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

      {canWrite && (
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>{t("actions.edit")}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              label="Количество"
              type="number"
              value={editQuantity}
              onChange={(event) => setEditQuantity(Number(event.target.value))}
              inputProps={{ min: 0 }}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>{t("actions.cancel")}</Button>
            <Button
              variant="contained"
              onClick={() => {
                if (editItem) {
                  updateMutation.mutate({ id: editItem.id, quantity: editQuantity });
                }
                setEditOpen(false);
              }}
            >
              {t("actions.save")}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
