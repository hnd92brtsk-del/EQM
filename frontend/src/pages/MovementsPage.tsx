import { useEffect, useMemo, useState } from "react";
import {
  Box,Card,
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
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";

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
  to_assembly_id?: number | null;
  performed_by_id: number;
  created_at?: string;
  reference?: string | null;
  comment?: string | null;
};

type EquipmentType = { id: number; name: string };

type Warehouse = { id: number; name: string };

type Cabinet = { id: number; name: string };
type Assembly = { id: number; name: string };

export default function MovementsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [movementType, setMovementType] = useState("");
  const [equipmentTypeId, setEquipmentTypeId] = useState<number | "">("");
  const [quantity, setQuantity] = useState(1);
  const [fromWarehouseId, setFromWarehouseId] = useState<number | "">("");
  const [toWarehouseId, setToWarehouseId] = useState<number | "">("");
  const [toCabinetId, setToCabinetId] = useState<number | "">("");
  const [toAssemblyId, setToAssemblyId] = useState<number | "">("");
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

  const movementOptions = useMemo(
    () => [
      { value: "to_warehouse", label: t("pagesUi.movements.types.toWarehouse") },
      { value: "to_cabinet", label: t("pagesUi.movements.types.toCabinet") },
      { value: "direct_to_cabinet", label: t("pagesUi.movements.types.directToCabinet") },
      { value: "to_assembly", label: t("pagesUi.movements.types.toAssembly") },
      { value: "direct_to_assembly", label: t("pagesUi.movements.types.directToAssembly") }
    ],
    [t]
  );

  const movementLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    movementOptions.forEach((option) => map.set(option.value, option.label));
    return map;
  }, [movementOptions]);

  const sortOptions = useMemo(
    () => [
      { value: "-created_at", label: t("pagesUi.movements.sort.byDateNewest") },
      { value: "created_at", label: t("pagesUi.movements.sort.byDateOldest") }
    ],
    [t]
  );

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

  const assembliesQuery = useQuery({
    queryKey: ["assemblies-options"],
    queryFn: () => listEntity<Assembly>("/assemblies", { page: 1, page_size: 200 })
  });

  useEffect(() => {
    if (movementsQuery.error) {
      setErrorMessage(
        movementsQuery.error instanceof Error
          ? movementsQuery.error.message
          : t("pagesUi.movements.errors.load")
      );
    }
  }, [movementsQuery.error, t]);

  const movementMutation = useMutation({
    mutationFn: (payload: any) => createEntity("/movements", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-items"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-in-operation"] });
      setMovementType("");
      setEquipmentTypeId("");
      setQuantity(1);
      setFromWarehouseId("");
      setToWarehouseId("");
      setToCabinetId("");
      setToAssemblyId("");
      setReference("");
      setComment("");
      setFormError(null);
    },
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.movements.errors.create"))
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

  const assemblyMap = useMemo(() => {
    const map = new Map<number, string>();
    assembliesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [assembliesQuery.data?.items]);

  const columns = useMemo<ColumnDef<Movement>[]>(
    () => [
      {
        header: t("pagesUi.movements.columns.type"),
        accessorKey: "movement_type",
        cell: ({ row }) => movementLabelMap.get(row.original.movement_type) || row.original.movement_type
      },
      {
        header: t("common.fields.nomenclature"),
        cell: ({ row }) =>
          equipmentMap.get(row.original.equipment_type_id) || row.original.equipment_type_id
      },
      { header: t("common.fields.quantity"), accessorKey: "quantity" },
      {
        header: t("pagesUi.movements.columns.from"),
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
        header: t("pagesUi.movements.columns.to"),
        cell: ({ row }) => {
          if (row.original.to_warehouse_id) {
            return warehouseMap.get(row.original.to_warehouse_id) || row.original.to_warehouse_id;
          }
          if (row.original.to_cabinet_id) {
            return cabinetMap.get(row.original.to_cabinet_id) || row.original.to_cabinet_id;
          }
          if (row.original.to_assembly_id) {
            return assemblyMap.get(row.original.to_assembly_id) || row.original.to_assembly_id;
          }
          return "-";
        }
      },
      { header: t("pagesUi.movements.columns.performedBy"), accessorKey: "performed_by_id" },
      { header: t("pagesUi.movements.columns.createdAt"), accessorKey: "created_at" }
    ],
    [assemblyMap, cabinetMap, equipmentMap, movementLabelMap, t, warehouseMap]
  );

  const handleSubmit = () => {
    setFormError(null);

    if (!movementType) {
      setFormError(t("pagesUi.movements.validation.typeRequired"));
      return;
    }

    if (!equipmentTypeId || quantity < 1) {
      setFormError(t("pagesUi.movements.validation.equipmentAndQuantity"));
      return;
    }

    if (movementType === "to_warehouse" && !toWarehouseId) {
      setFormError(t("pagesUi.movements.validation.toWarehouseRequired"));
      return;
    }

    if (movementType === "to_cabinet" && (!fromWarehouseId || !toCabinetId)) {
      setFormError(t("pagesUi.movements.validation.fromWarehouseAndCabinet"));
      return;
    }

    if (movementType === "direct_to_cabinet" && !toCabinetId) {
      setFormError(t("pagesUi.movements.validation.toCabinetRequired"));
      return;
    }

    if (movementType === "to_assembly" && (!fromWarehouseId || !toAssemblyId)) {
      setFormError(t("pagesUi.movements.validation.fromWarehouseAndAssembly"));
      return;
    }

    if (movementType === "direct_to_assembly" && !toAssemblyId) {
      setFormError(t("pagesUi.movements.validation.toAssemblyRequired"));
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

    if (movementType === "to_assembly") {
      payload.from_warehouse_id = fromWarehouseId;
      payload.to_assembly_id = toAssemblyId;
    }

    if (movementType === "direct_to_assembly") {
      payload.to_assembly_id = toAssemblyId;
    }

    movementMutation.mutate(payload);
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.movements")}</Typography>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Typography variant="h6">{t("pagesUi.movements.newTitle")}</Typography>
          {formError && <Alert severity="error">{formError}</Alert>}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <FormControl fullWidth>
              <InputLabel>{t("pagesUi.movements.fields.movementType")}</InputLabel>
              <Select
                label={t("pagesUi.movements.fields.movementType")}
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
              <InputLabel>{t("common.fields.nomenclature")}</InputLabel>
              <Select
                label={t("common.fields.nomenclature")}
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
              label={t("common.fields.quantity")}
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              inputProps={{ min: 1 }}
              fullWidth
            />

            {movementType === "to_warehouse" && (
              <FormControl fullWidth>
                <InputLabel>{t("pagesUi.movements.fields.toWarehouse")}</InputLabel>
                <Select
                  label={t("pagesUi.movements.fields.toWarehouse")}
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
                  <InputLabel>{t("pagesUi.movements.fields.fromWarehouse")}</InputLabel>
                  <Select
                    label={t("pagesUi.movements.fields.fromWarehouse")}
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
                  <InputLabel>{t("pagesUi.movements.fields.toCabinet")}</InputLabel>
                  <Select
                    label={t("pagesUi.movements.fields.toCabinet")}
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
                <InputLabel>{t("pagesUi.movements.fields.toCabinet")}</InputLabel>
                <Select
                  label={t("pagesUi.movements.fields.toCabinet")}
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

            {movementType === "to_assembly" && (
              <>
                <FormControl fullWidth>
                  <InputLabel>{t("pagesUi.movements.fields.fromWarehouse")}</InputLabel>
                  <Select
                    label={t("pagesUi.movements.fields.fromWarehouse")}
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
                  <InputLabel>{t("pagesUi.movements.fields.toAssembly")}</InputLabel>
                  <Select
                    label={t("pagesUi.movements.fields.toAssembly")}
                    value={toAssemblyId}
                    onChange={(event) => setToAssemblyId(parseSelectValue(event.target.value))}
                  >
                    {assembliesQuery.data?.items.map((assembly) => (
                      <MenuItem key={assembly.id} value={assembly.id}>
                        {assembly.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}

            {movementType === "direct_to_assembly" && (
              <FormControl fullWidth>
                <InputLabel>{t("pagesUi.movements.fields.toAssembly")}</InputLabel>
                <Select
                  label={t("pagesUi.movements.fields.toAssembly")}
                  value={toAssemblyId}
                  onChange={(event) => setToAssemblyId(parseSelectValue(event.target.value))}
                >
                  {assembliesQuery.data?.items.map((assembly) => (
                    <MenuItem key={assembly.id} value={assembly.id}>
                      {assembly.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label={t("common.fields.reference")}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              fullWidth
            />
            <TextField
              label={t("common.fields.comment")}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Box>

          {canWrite && (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <AppButton variant="contained" onClick={handleSubmit}>
                {t("pagesUi.movements.actions.create")}
              </AppButton>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Typography variant="h6">{t("pagesUi.movements.historyTitle")}</Typography>
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
              <InputLabel>{t("pagesUi.movements.fields.movementType")}</InputLabel>
              <Select
                label={t("pagesUi.movements.fields.movementType")}
                value={filterType}
                onChange={(event) => {
                  setFilterType(event.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {movementOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("common.fields.nomenclature")}</InputLabel>
              <Select
                label={t("common.fields.nomenclature")}
                value={filterEquipment}
                onChange={(event) => {
                  setFilterEquipment(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {equipmentTypesQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("pagesUi.movements.fields.fromWarehouse")}</InputLabel>
              <Select
                label={t("pagesUi.movements.fields.fromWarehouse")}
                value={filterFromWarehouse}
                onChange={(event) => {
                  setFilterFromWarehouse(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {warehousesQuery.data?.items.map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("pagesUi.movements.fields.toWarehouse")}</InputLabel>
              <Select
                label={t("pagesUi.movements.fields.toWarehouse")}
                value={filterToWarehouse}
                onChange={(event) => {
                  setFilterToWarehouse(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {warehousesQuery.data?.items.map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("pagesUi.movements.fields.fromCabinet")}</InputLabel>
              <Select
                label={t("pagesUi.movements.fields.fromCabinet")}
                value={filterFromCabinet}
                onChange={(event) => {
                  setFilterFromCabinet(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {cabinetsQuery.data?.items.map((cabinet) => (
                  <MenuItem key={cabinet.id} value={cabinet.id}>
                    {cabinet.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("pagesUi.movements.fields.toCabinet")}</InputLabel>
              <Select
                label={t("pagesUi.movements.fields.toCabinet")}
                value={filterToCabinet}
                onChange={(event) => {
                  setFilterToCabinet(parseSelectValue(event.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {cabinetsQuery.data?.items.map((cabinet) => (
                  <MenuItem key={cabinet.id} value={cabinet.id}>
                    {cabinet.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t("common.dateFrom")}
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
              label={t("common.dateTo")}
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
            {...getTablePaginationProps(t)}
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



