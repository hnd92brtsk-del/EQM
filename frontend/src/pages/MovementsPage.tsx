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
  Typography,
  Alert
} from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const movementOptions = [
  { value: "to_warehouse", label: "?????? ?? ?????" },
  { value: "to_cabinet", label: "?? ?????? ? ????" },
  { value: "direct_to_cabinet", label: "???????? ? ????" }
];

const sortOptions = [
  { value: "-created_at", label: "?? ???? (?????)" },
  { value: "created_at", label: "?? ???? (??????)" }
];

const pageSizeOptions = [10, 20, 50, 100];

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
  created_at?: string;
  reference?: string | null;
  comment?: string | null;
};

type EquipmentType = { id: number; name: string };

type Warehouse = { id: number; name: string };

type Cabinet = { id: number; name: string };

export default function MovementsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [movementType, setMovementType] = useState("");
  const [equipmentTypeId, setEquipmentTypeId] = useState<number | "">("");
  const [quantity, setQuantity] = useState(1);
  const [fromWarehouseId, setFromWarehouseId] = useState<number | "">("");
  const [toWarehouseId, setToWarehouseId] = useState<number | "">("");
  const [toCabinetId, setToCabinetId] = useState<number | "">("");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [filterType, setFilterType] = useState("");
  const [filterEquipment, setFilterEquipment] = useState<number | "">("");
  const [filterFromWarehouse, setFilterFromWarehouse] = useState<number | "">("");
  const [filterToWarehouse, setFilterToWarehouse] = useState<number | "">("");
  const [filterFromCabinet, setFilterFromCabinet] = useState<number | "">("");
  const [filterToCabinet, setFilterToCabinet] = useState<number | "">("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parseSelectValue = (value: string | number) => (value === "" ? "" : Number(value));

  const movementsQuery = useQuery({
    queryKey: [
      "movements",
      page,
      pageSize,
      q,
      sort,
      filterType,
      filterEquipment,
      filterFromWarehouse,
      filterToWarehouse,
      filterFromCabinet,
      filterToCabinet,
      createdFrom,
      createdTo
    ],
    queryFn: () =>
      listEntity<Movement>("/movements", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        filters: {
          movement_type: filterType || undefined,
          equipment_type_id: filterEquipment || undefined,
          from_warehouse_id: filterFromWarehouse || undefined,
          to_warehouse_id: filterToWarehouse || undefined,
          from_cabinet_id: filterFromCabinet || undefined,
          to_cabinet_id: filterToCabinet || undefined,
          created_at_from: createdFrom || undefined,
          created_at_to: createdTo || undefined
        }
      })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-options"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: 200 })
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses-options"],
    queryFn: () => listEntity<Warehouse>("/warehouses", { page: 1, page_size: 200 })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-options"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: 200 })
  });

  useEffect(() => {
    if (movementsQuery.error) {
      setErrorMessage(
        movementsQuery.error instanceof Error
          ? movementsQuery.error.message
          : "?????? ???????? ????????"
      );
    }
  }, [movementsQuery.error]);

  const movementMutation = useMutation({
    mutationFn: (payload: any) => createEntity("/movements", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-items"] });
      queryClient.invalidateQueries({ queryKey: ["cabinet-items"] });
      setMovementType("");
      setEquipmentTypeId("");
      setQuantity(1);
      setFromWarehouseId("");
      setToWarehouseId("");
      setToCabinetId("");
      setReference("");
      setComment("");
      setFormError(null);
    },
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "?????? ???????? ????????")
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
      { header: "???", accessorKey: "movement_type" },
      {
        header: "????????????",
        cell: ({ row }) =>
          equipmentMap.get(row.original.equipment_type_id) || row.original.equipment_type_id
      },
      { header: "??????????", accessorKey: "quantity" },
      {
        header: "????????",
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
        header: "??????????",
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
      { header: "???????????", accessorKey: "performed_by_id" },
      { header: "?????", accessorKey: "created_at" }
    ],
    [cabinetMap, equipmentMap, warehouseMap]
  );

  const handleSubmit = () => {
    setFormError(null);

    if (!movementType) {
      setFormError("???????? ??? ????????.");
      return;
    }

    if (!equipmentTypeId || quantity < 1) {
      setFormError("????????? ???????????? ? ??????????.");
      return;
    }

    if (movementType === "to_warehouse" && !toWarehouseId) {
      setFormError("??????? ????? ??????????.");
      return;
    }

    if (movementType === "to_cabinet" && (!fromWarehouseId || !toCabinetId)) {
      setFormError("??????? ?????-???????? ? ???? ??????????.");
      return;
    }

    if (movementType === "direct_to_cabinet" && !toCabinetId) {
      setFormError("??????? ???? ??????????.");
      return;
    }

    const payload: Record<string, any> = {
      movement_type: movementType,
      equipment_type_id: equipmentTypeId,
      quantity,
      reference: reference || undefined,
      comment: comment || undefined
    };

    if (movementType === "to_warehouse") {
      payload.to_warehouse_id = toWarehouseId;
    }

    if (movementType === "to_cabinet") {
      payload.from_warehouse_id = fromWarehouseId;
      payload.to_cabinet_id = toCabinetId;
    }

    if (movementType === "direct_to_cabinet") {
      payload.to_cabinet_id = toCabinetId;
    }

    movementMutation.mutate(payload);
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">????????</Typography>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Typography variant="h6">????? ????????</Typography>
          {formError && <Alert severity="error">{formError}</Alert>}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <FormControl fullWidth>
              <InputLabel>??? ????????</InputLabel>
              <Select
                label="??? ????????"
                value={movementType}
                onChange={(event) => setMovementType(event.target.value)}
              >
                {movementOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>????????????</InputLabel>
              <Select
                label="????????????"
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

            <TextField
              label="??????????"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              inputProps={{ min: 1 }}
              fullWidth
            />

            {movementType === "to_warehouse" && (
              <FormControl fullWidth>
                <InputLabel>????? ??????????</InputLabel>
                <Select
                  label="????? ??????????"
                  value={toWarehouseId}
                  onChange={(event) => setToWarehouseId(parseSelectValue(event.target.value))}
                >
                  {warehousesQuery.data?.items.map((warehouse) => (
                    <MenuItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {movementType === "to_cabinet" && (
              <>
                <FormControl fullWidth>
                  <InputLabel>?????-????????</InputLabel>
                  <Select
                    label="?????-????????"
                    value={fromWarehouseId}
                    onChange={(event) => setFromWarehouseId(parseSelectValue(event.target.value))}
                  >
                    {warehousesQuery.data?.items.map((warehouse) => (
                      <MenuItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>???? ??????????</InputLabel>
                  <Select
                    label="???? ??????????"
                    value={toCabinetId}
                    onChange={(event) => setToCabinetId(parseSelectValue(event.target.value))}
                  >
                    {cabinetsQuery.data?.items.map((cabinet) => (
                      <MenuItem key={cabinet.id} value={cabinet.id}>
                        {cabinet.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}

            {movementType === "direct_to_cabinet" && (
              <FormControl fullWidth>
                <InputLabel>???? ??????????</InputLabel>
                <Select
                  label="???? ??????????"
                  value={toCabinetId}
                  onChange={(event) => setToCabinetId(parseSelectValue(event.target.value))}
                >
                  {cabinetsQuery.data?.items.map((cabinet) => (
                    <MenuItem key={cabinet.id} value={cabinet.id}>
                      {cabinet.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              fullWidth
            />
            <TextField
              label="???????????"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Box>

          {canWrite && (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="contained" onClick={handleSubmit}>
                ??????? ????????
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Typography variant="h6">??????? ????????</Typography>
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
              <InputLabel>??? ????????</InputLabel>
              <Select
                label="??? ????????"
                value={filterType}
                onChange={(event) => {
                  setFilterType(event.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="">???</MenuItem>
                {movementOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>????????????</InputLabel>
              <Select
                label="????????????"
                value={filterEquipment}
                onChange={(event) => {
                  setFilterEquipment(parseSelectValue(event.target.value));
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
              <InputLabel>????? ????????</InputLabel>
              <Select
                label="????? ????????"
                value={filterFromWarehouse}
                onChange={(event) => {
                  setFilterFromWarehouse(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">???</MenuItem>
                {warehousesQuery.data?.items.map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>????? ??????????</InputLabel>
              <Select
                label="????? ??????????"
                value={filterToWarehouse}
                onChange={(event) => {
                  setFilterToWarehouse(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">???</MenuItem>
                {warehousesQuery.data?.items.map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>???? ????????</InputLabel>
              <Select
                label="???? ????????"
                value={filterFromCabinet}
                onChange={(event) => {
                  setFilterFromCabinet(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">???</MenuItem>
                {cabinetsQuery.data?.items.map((cabinet) => (
                  <MenuItem key={cabinet.id} value={cabinet.id}>
                    {cabinet.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>???? ??????????</InputLabel>
              <Select
                label="???? ??????????"
                value={filterToCabinet}
                onChange={(event) => {
                  setFilterToCabinet(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">???</MenuItem>
                {cabinetsQuery.data?.items.map((cabinet) => (
                  <MenuItem key={cabinet.id} value={cabinet.id}>
                    {cabinet.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="???? ??"
              type="date"
              value={createdFrom}
              onChange={(event) => {
                setCreatedFrom(event.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="???? ??"
              type="date"
              value={createdTo}
              onChange={(event) => {
                setCreatedTo(event.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>

          <DataTable data={movementsQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            count={movementsQuery.data?.total || 0}
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
