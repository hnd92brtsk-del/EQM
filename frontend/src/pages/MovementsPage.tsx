import { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

import { DataTable } from "../components/DataTable";
import { listEntity } from "../api/entities";

const PAGE_SIZE = 200;

type Movement = {
  id: number;
  movement_type: string;
  equipment_type_id: number;
  quantity: number;
  from_warehouse_id?: number | null;
  to_warehouse_id?: number | null;
  from_cabinet_id?: number | null;
  to_cabinet_id?: number | null;
  performed_by_id: number;
};

type EquipmentType = { id: number; name: string };

type Warehouse = { id: number; name: string };

type Cabinet = { id: number; name: string };

export default function MovementsPage() {
  const [movementType, setMovementType] = useState<string>("");
  const [equipmentTypeId, setEquipmentTypeId] = useState<number | "">("");
  const parseSelectValue = (value: string | number) => (value === "" ? "" : Number(value));
  const movementsQuery = useQuery({
    queryKey: ["movements", movementType, equipmentTypeId],
    queryFn: () =>
      listEntity<Movement>("/movements", {
        page: 1,
        page_size: PAGE_SIZE,
        movement_type: movementType || undefined,
        equipment_type_id: equipmentTypeId || undefined
      })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: PAGE_SIZE })
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => listEntity<Warehouse>("/warehouses", { page: 1, page_size: PAGE_SIZE })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: PAGE_SIZE })
  });

  const equipmentMap = useMemo(() => {
    const map = new Map<number, string>();
    equipmentTypesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [equipmentTypesQuery.data?.items]);

  const warehouseMap = useMemo(() => {
    const map = new Map<number, string>();
    warehousesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [warehousesQuery.data?.items]);

  const cabinetMap = useMemo(() => {
    const map = new Map<number, string>();
    cabinetsQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [cabinetsQuery.data?.items]);

  const columns = useMemo<ColumnDef<Movement>[]>(
    () => [
      { header: "Тип", accessorKey: "movement_type" },
      {
        header: "Номенклатура",
        cell: ({ row }) =>
          equipmentMap.get(row.original.equipment_type_id) || row.original.equipment_type_id
      },
      { header: "Количество", accessorKey: "quantity" },
      {
        header: "Источник",
        cell: ({ row }) => {
          if (row.original.from_warehouse_id) {
            return warehouseMap.get(row.original.from_warehouse_id) || row.original.from_warehouse_id;
          }
          if (row.original.from_cabinet_id) {
            return cabinetMap.get(row.original.from_cabinet_id) || row.original.from_cabinet_id;
          }
          return "-";
        }
      },
      {
        header: "Назначение",
        cell: ({ row }) => {
          if (row.original.to_warehouse_id) {
            return warehouseMap.get(row.original.to_warehouse_id) || row.original.to_warehouse_id;
          }
          if (row.original.to_cabinet_id) {
            return cabinetMap.get(row.original.to_cabinet_id) || row.original.to_cabinet_id;
          }
          return "-";
        }
      },
      { header: "Исполнитель", accessorKey: "performed_by_id" }
    ],
    [equipmentMap, warehouseMap, cabinetMap]
  );

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Движения</Typography>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <FormControl fullWidth>
              <InputLabel>Тип движения</InputLabel>
              <Select
                label="Тип движения"
                value={movementType}
                onChange={(event) => setMovementType(event.target.value)}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="inbound">inbound</MenuItem>
                <MenuItem value="transfer">transfer</MenuItem>
                <MenuItem value="to_cabinet">to_cabinet</MenuItem>
                <MenuItem value="from_cabinet">from_cabinet</MenuItem>
                <MenuItem value="direct_to_cabinet">direct_to_cabinet</MenuItem>
                <MenuItem value="writeoff">writeoff</MenuItem>
                <MenuItem value="adjustment">adjustment</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Номенклатура</InputLabel>
              <Select
                label="Номенклатура"
                value={equipmentTypeId}
                onChange={(event) => setEquipmentTypeId(parseSelectValue(event.target.value))}
              >
                <MenuItem value="">Все</MenuItem>
                {equipmentTypesQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <DataTable data={movementsQuery.data?.items || []} columns={columns} />
        </CardContent>
      </Card>
    </Box>
  );
}



