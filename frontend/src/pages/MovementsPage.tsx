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
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { LOOKUP_QUERY_STALE_TIME } from "../api/queryDefaults";
import { type ColumnMeta, DataTable, type DataTableFiltersState } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, listEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { formatDateTime } from "../utils/dateFormat";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { SearchableSelectField } from "../components/SearchableSelectField";

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
  const canWrite = hasPermission(user, "equipment", "write");
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
  const [sort, setSort] = useState("-created_at");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debouncedColumnFilters = useDebouncedValue(columnFilters, 250);
  const needsCabinetOptions = movementType === "to_cabinet" || movementType === "direct_to_cabinet";
  const needsAssemblyOptions = movementType === "to_assembly" || movementType === "direct_to_assembly";

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
      sort,
      debouncedColumnFilters
    ],
    queryFn: () =>
      listEntity<Movement>("/movements", {
        page,
        page_size: pageSize,
        sort: sort || undefined,
        filters: {
          movement_type: debouncedColumnFilters.movement_type || undefined,
          equipment_type_id:
            debouncedColumnFilters.equipment_type_id &&
            !Number.isNaN(Number(debouncedColumnFilters.equipment_type_id))
              ? Number(debouncedColumnFilters.equipment_type_id)
              : undefined,
          from_warehouse_id:
            debouncedColumnFilters.from_warehouse_id &&
            !Number.isNaN(Number(debouncedColumnFilters.from_warehouse_id))
              ? Number(debouncedColumnFilters.from_warehouse_id)
              : undefined,
          to_warehouse_id:
            debouncedColumnFilters.to_warehouse_id &&
            !Number.isNaN(Number(debouncedColumnFilters.to_warehouse_id))
              ? Number(debouncedColumnFilters.to_warehouse_id)
              : undefined,
          from_cabinet_id:
            debouncedColumnFilters.from_cabinet_id &&
            !Number.isNaN(Number(debouncedColumnFilters.from_cabinet_id))
              ? Number(debouncedColumnFilters.from_cabinet_id)
              : undefined,
          to_cabinet_id:
            debouncedColumnFilters.to_cabinet_id &&
            !Number.isNaN(Number(debouncedColumnFilters.to_cabinet_id))
              ? Number(debouncedColumnFilters.to_cabinet_id)
              : undefined,
          performed_by_id:
            debouncedColumnFilters.performed_by_id &&
            !Number.isNaN(Number(debouncedColumnFilters.performed_by_id))
              ? Number(debouncedColumnFilters.performed_by_id)
              : undefined,
          created_at_from: debouncedColumnFilters.created_at_from || undefined,
          created_at_to: debouncedColumnFilters.created_at_to || undefined
        }
      }),
    placeholderData: keepPreviousData
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-options"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: 200 }),
    staleTime: LOOKUP_QUERY_STALE_TIME
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses-options"],
    queryFn: () => listEntity<Warehouse>("/warehouses", { page: 1, page_size: 200 }),
    staleTime: LOOKUP_QUERY_STALE_TIME
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-options"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: 200 }),
    enabled: needsCabinetOptions,
    staleTime: LOOKUP_QUERY_STALE_TIME
  });

  const assembliesQuery = useQuery({
    queryKey: ["assemblies-options"],
    queryFn: () => listEntity<Assembly>("/assemblies", { page: 1, page_size: 200 }),
    enabled: needsAssemblyOptions,
    staleTime: LOOKUP_QUERY_STALE_TIME
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
        meta: {
          filterType: "select",
          filterKey: "movement_type",
          filterPlaceholder: t("common.all"),
          filterOptions: movementOptions.map((option) => ({
            label: option.label,
            value: option.value
          }))
        } as ColumnMeta<Movement>,
        cell: ({ row }) => movementLabelMap.get(row.original.movement_type) || row.original.movement_type
      },
      {
        header: t("common.fields.nomenclature"),
        meta: {
          filterType: "select",
          filterKey: "equipment_type_id",
          filterPlaceholder: t("common.all"),
          filterOptions:
            equipmentTypesQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || []
        } as ColumnMeta<Movement>,
        cell: ({ row }) =>
          equipmentMap.get(row.original.equipment_type_id) || row.original.equipment_type_id
      },
      { header: t("common.fields.quantity"), accessorKey: "quantity" },
      {
        header: t("pagesUi.movements.columns.from"),
        meta: {
          filterType: "select",
          filterKey: "from_warehouse_id",
          filterPlaceholder: t("common.all"),
          filterOptions:
            warehousesQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || []
        } as ColumnMeta<Movement>,
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
        meta: {
          filterType: "select",
          filterKey: "to_warehouse_id",
          filterPlaceholder: t("common.all"),
          filterOptions:
            warehousesQuery.data?.items.map((item) => ({
              label: item.name,
              value: item.id
            })) || []
        } as ColumnMeta<Movement>,
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
      {
        header: t("pagesUi.movements.columns.performedBy"),
        accessorKey: "performed_by_id",
        meta: {
          filterType: "number",
          filterKey: "performed_by_id",
          filterPlaceholder: t("pagesUi.movements.columns.performedBy")
        } as ColumnMeta<Movement>
      },
      {
        header: t("pagesUi.movements.columns.createdAt"),
        accessorKey: "created_at",
        cell: ({ row }) => formatDateTime(row.original.created_at),
        meta: {
          filterType: "date",
          filterKey: "created_at_from"
        } as ColumnMeta<Movement>
      }
    ],
    [assemblyMap, cabinetMap, equipmentMap, equipmentTypesQuery.data?.items, movementLabelMap, movementOptions, t, warehouseMap, warehousesQuery.data?.items]
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
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box className="page-title-block">
        <Box className="page-title-kicker">{t("menu.equipment")}</Box>
        <Typography variant="h4">{t("pages.movements")}</Typography>
      </Box>

      <Card className="crud-panel">
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
            <SearchableSelectField
              label={t("pagesUi.movements.fields.movementType")}
              value={movementType}
              options={movementOptions}
              onChange={(nextValue) => setMovementType(String(nextValue))}
              emptyOptionLabel={t("actions.notSelected")}
              fullWidth
            />

            <SearchableSelectField
              label={t("common.fields.nomenclature")}
              value={equipmentTypeId}
              options={
                equipmentTypesQuery.data?.items.map((item) => ({
                  value: item.id,
                  label: item.name
                })) || []
              }
              onChange={(nextValue) => setEquipmentTypeId(parseSelectValue(nextValue))}
              emptyOptionLabel={t("actions.notSelected")}
              fullWidth
            />

            <TextField
              label={t("common.fields.quantity")}
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              inputProps={{ min: 1 }}
              fullWidth
            />

            {movementType === "to_warehouse" && (
              <SearchableSelectField
                label={t("pagesUi.movements.fields.toWarehouse")}
                value={toWarehouseId}
                options={
                  warehousesQuery.data?.items.map((warehouse) => ({
                    value: warehouse.id,
                    label: warehouse.name
                  })) || []
                }
                onChange={(nextValue) => setToWarehouseId(parseSelectValue(nextValue))}
                emptyOptionLabel={t("actions.notSelected")}
                fullWidth
              />
            )}

            {movementType === "to_cabinet" && (
              <>
                <SearchableSelectField
                  label={t("pagesUi.movements.fields.fromWarehouse")}
                  value={fromWarehouseId}
                  options={
                    warehousesQuery.data?.items.map((warehouse) => ({
                      value: warehouse.id,
                      label: warehouse.name
                    })) || []
                  }
                  onChange={(nextValue) => setFromWarehouseId(parseSelectValue(nextValue))}
                  emptyOptionLabel={t("actions.notSelected")}
                  fullWidth
                />

                <SearchableSelectField
                  label={t("pagesUi.movements.fields.toCabinet")}
                  value={toCabinetId}
                  options={
                    cabinetsQuery.data?.items.map((cabinet) => ({
                      value: cabinet.id,
                      label: cabinet.name
                    })) || []
                  }
                  onChange={(nextValue) => setToCabinetId(parseSelectValue(nextValue))}
                  emptyOptionLabel={t("actions.notSelected")}
                  fullWidth
                />
              </>
            )}

            {movementType === "direct_to_cabinet" && (
              <SearchableSelectField
                label={t("pagesUi.movements.fields.toCabinet")}
                value={toCabinetId}
                options={
                  cabinetsQuery.data?.items.map((cabinet) => ({
                    value: cabinet.id,
                    label: cabinet.name
                  })) || []
                }
                onChange={(nextValue) => setToCabinetId(parseSelectValue(nextValue))}
                emptyOptionLabel={t("actions.notSelected")}
                fullWidth
              />
            )}

            {movementType === "to_assembly" && (
              <>
                <SearchableSelectField
                  label={t("pagesUi.movements.fields.fromWarehouse")}
                  value={fromWarehouseId}
                  options={
                    warehousesQuery.data?.items.map((warehouse) => ({
                      value: warehouse.id,
                      label: warehouse.name
                    })) || []
                  }
                  onChange={(nextValue) => setFromWarehouseId(parseSelectValue(nextValue))}
                  emptyOptionLabel={t("actions.notSelected")}
                  fullWidth
                />

                <SearchableSelectField
                  label={t("pagesUi.movements.fields.toAssembly")}
                  value={toAssemblyId}
                  options={
                    assembliesQuery.data?.items.map((assembly) => ({
                      value: assembly.id,
                      label: assembly.name
                    })) || []
                  }
                  onChange={(nextValue) => setToAssemblyId(parseSelectValue(nextValue))}
                  emptyOptionLabel={t("actions.notSelected")}
                  fullWidth
                />
              </>
            )}

            {movementType === "direct_to_assembly" && (
              <SearchableSelectField
                label={t("pagesUi.movements.fields.toAssembly")}
                value={toAssemblyId}
                options={
                  assembliesQuery.data?.items.map((assembly) => ({
                    value: assembly.id,
                    label: assembly.name
                  })) || []
                }
                onChange={(nextValue) => setToAssemblyId(parseSelectValue(nextValue))}
                emptyOptionLabel={t("actions.notSelected")}
                fullWidth
              />
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
          </Box>

          <DataTable
            data={movementsQuery.data?.items || []}
            columns={columns}
            showColumnFilters
            columnFilters={columnFilters}
            onColumnFiltersChange={(nextFilters) => {
              setColumnFilters(nextFilters);
              setPage(1);
            }}
          />
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



