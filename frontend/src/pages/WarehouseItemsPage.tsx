import { useEffect, useMemo, useState } from "react";
import {
  Box,
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
import { useQuery } from "@tanstack/react-query";

import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { listEntity } from "../api/entities";

const sortOptions = [
  { value: "-last_updated", label: "?? ?????????? (?????)" },
  { value: "last_updated", label: "?? ?????????? (??????)" },
  { value: "-quantity", label: "?? ?????????? (????????)" },
  { value: "quantity", label: "?? ?????????? (???????????)" }
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

export default function WarehouseItemsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-last_updated");
  const [warehouseFilter, setWarehouseFilter] = useState<number | "">("");
  const [equipmentFilter, setEquipmentFilter] = useState<number | "">("");
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

  useEffect(() => {
    if (itemsQuery.error) {
      setErrorMessage(
        itemsQuery.error instanceof Error
          ? itemsQuery.error.message
          : "?????? ???????? ????????? ???????"
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

  const columns = useMemo<ColumnDef<WarehouseItem>[]>(
    () => [
      {
        header: "?????",
        cell: ({ row }) => warehouseMap.get(row.original.warehouse_id) || row.original.warehouse_id
      },
      {
        header: "????????????",
        cell: ({ row }) =>
          equipmentMap.get(row.original.equipment_type_id) || row.original.equipment_type_id
      },
      { header: "??????????", accessorKey: "quantity" },
      { header: "?????????", accessorKey: "last_updated" }
    ],
    [equipmentMap, warehouseMap]
  );

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">????????? ???????</Typography>
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
              label="?????"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>??????????</InputLabel>
              <Select label="??????????" value={sort} onChange={(event) => setSort(event.target.value)}>
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>?????</InputLabel>
              <Select
                label="?????"
                value={warehouseFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setWarehouseFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">???</MenuItem>
                {warehousesQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>????????????</InputLabel>
              <Select
                label="????????????"
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
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
