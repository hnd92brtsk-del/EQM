import { useMemo, useState } from "react";
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
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Alert
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTable } from "../components/DataTable";
import { createEntity, listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 200;

type Cabinet = { id: number; name: string };

type Warehouse = { id: number; name: string };

type EquipmentType = { id: number; name: string };

type CabinetItem = {
  id: number;
  cabinet_id: number;
  equipment_type_id: number;
  quantity: number;
};

type WarehouseItem = {
  id: number;
  warehouse_id: number;
  equipment_type_id: number;
  quantity: number;
};

export default function CabinetItemsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [cabinetId, setCabinetId] = useState<number | "">("");
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"warehouse" | "direct">("direct");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [equipmentTypeId, setEquipmentTypeId] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number>(1);
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parseSelectValue = (value: string | number) => (value === "" ? "" : Number(value));
  const cabinetsQuery = useQuery({
    queryKey: ["cabinets"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: PAGE_SIZE })
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => listEntity<Warehouse>("/warehouses", { page: 1, page_size: PAGE_SIZE })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: PAGE_SIZE })
  });

  const cabinetItemsQuery = useQuery({
    queryKey: ["cabinet-items", cabinetId],
    queryFn: () =>
      listEntity<CabinetItem>("/cabinet-items", {
        page: 1,
        page_size: PAGE_SIZE,
        cabinet_id: cabinetId || undefined
      }),
    enabled: Boolean(cabinetId)
  });

  const availabilityQuery = useQuery({
    queryKey: ["warehouse-availability", warehouseId, equipmentTypeId],
    queryFn: () =>
      listEntity<WarehouseItem>("/warehouse-items", {
        page: 1,
        page_size: 1,
        warehouse_id: warehouseId || undefined,
        equipment_type_id: equipmentTypeId || undefined
      }),
    enabled: source === "warehouse" && Boolean(warehouseId) && Boolean(equipmentTypeId)
  });

  const availableQuantity = availabilityQuery.data?.items?.[0]?.quantity ?? 0;

  const createMovement = useMutation({
    mutationFn: (payload: any) => createEntity("/movements", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cabinet-items", cabinetId] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-availability"] });
      setOpen(false);
    }
  });

  const equipmentTypeMap = useMemo(() => {
    const map = new Map<number, string>();
    equipmentTypesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [equipmentTypesQuery.data?.items]);

  const columns = useMemo<ColumnDef<CabinetItem>[]>(
    () => [
      {
        header: "Номенклатура",
        cell: ({ row }) => equipmentTypeMap.get(row.original.equipment_type_id) || row.original.equipment_type_id
      },
      { header: "Количество", accessorKey: "quantity" }
    ],
    [equipmentTypeMap]
  );

  const resetForm = () => {
    setSource("direct");
    setWarehouseId("");
    setEquipmentTypeId("");
    setQuantity(1);
    setReference("");
    setComment("");
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    if (!cabinetId || !equipmentTypeId || quantity < 1) {
      setError("Заполните обязательные поля");
      return;
    }
    if (source === "warehouse") {
      if (!warehouseId) {
        setError("Выберите склад");
        return;
      }
      if (quantity > availableQuantity) {
        setError("Количество больше доступного остатка");
        return;
      }
    }

    const payload: any = {
      movement_type: source === "warehouse" ? "to_cabinet" : "direct_to_cabinet",
      equipment_type_id: equipmentTypeId,
      quantity,
      to_cabinet_id: cabinetId,
      reference: reference || undefined,
      comment: comment || undefined
    };

    if (source === "warehouse") {
      payload.from_warehouse_id = warehouseId;
    }

    createMovement.mutate(payload);
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Состав шкафов</Typography>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Шкаф</InputLabel>
            <Select
              label="Шкаф"
              value={cabinetId}
              onChange={(event) => setCabinetId(parseSelectValue(event.target.value))}
            >
              {cabinetsQuery.data?.items.map((cabinet) => (
                <MenuItem key={cabinet.id} value={cabinet.id}>
                  {cabinet.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box className="table-toolbar">
            <Typography variant="h6">Оборудование в шкафу</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              disabled={!canEdit || !cabinetId}
              onClick={() => {
                resetForm();
                setOpen(true);
              }}
            >
              + Добавить оборудование
            </Button>
          </Box>
          <DataTable data={cabinetItemsQuery.data?.items || []} columns={columns} />
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Добавить оборудование в шкаф</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <ToggleButtonGroup
            value={source}
            exclusive
            onChange={(_, value) => value && setSource(value)}
            color="primary"
          >
            <ToggleButton value="warehouse">Со склада</ToggleButton>
            <ToggleButton value="direct">Непосредственно в шкаф</ToggleButton>
          </ToggleButtonGroup>

          {source === "warehouse" && (
            <FormControl fullWidth>
              <InputLabel>Склад</InputLabel>
              <Select
                label="Склад"
                value={warehouseId}
                onChange={(event) => setWarehouseId(parseSelectValue(event.target.value))}
              >
                {warehousesQuery.data?.items.map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth>
            <InputLabel>Тип оборудования</InputLabel>
            <Select
              label="Тип оборудования"
              value={equipmentTypeId}
              onChange={(event) => setEquipmentTypeId(parseSelectValue(event.target.value))}
            >
              {equipmentTypesQuery.data?.items.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {source === "warehouse" && (
            <Alert severity="info">Доступно на складе: {availableQuantity}</Alert>
          )}

          <TextField
            label="Количество"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            inputProps={{ min: 1, max: source === "warehouse" ? availableQuantity : undefined }}
            fullWidth
          />

          <TextField
            label="Reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            fullWidth
          />
          <TextField
            label="Комментарий"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!canEdit}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

