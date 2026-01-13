import { useEffect, useMemo, useState } from "react";
import {
  Box,Card,
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
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";

const pageSizeOptions = [10, 20, 50, 100];

type EquipmentInOperationItem = {
  id: number;
  source: "cabinet" | "assembly";
  container_id: number;
  container_name: string;
  equipment_type_id: number;
  quantity: number;
  is_deleted: boolean;
  equipment_type_name?: string | null;
  manufacturer_name?: string | null;
  location_full_path?: string | null;
};

type Cabinet = { id: number; name: string };
type Assembly = { id: number; name: string };
type Location = { id: number; name: string };

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
  const [containerFilter, setContainerFilter] = useState<string>("");
  const [equipmentFilter, setEquipmentFilter] = useState<number | "">("");
  const [manufacturerFilter, setManufacturerFilter] = useState<number | "">("");
  const [locationFilter, setLocationFilter] = useState<number | "">("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentInOperationItem | null>(null);
  const [editQuantity, setEditQuantity] = useState(0);

  const sortOptions = useMemo(
    () => [
      { value: "-created_at", label: t("pagesUi.cabinetItems.sort.byDateNewest") },
      { value: "created_at", label: t("pagesUi.cabinetItems.sort.byDateOldest") },
      { value: "-quantity", label: t("pagesUi.cabinetItems.sort.byQuantityDesc") },
      { value: "quantity", label: t("pagesUi.cabinetItems.sort.byQuantityAsc") },
      { value: "equipment_type_name", label: t("pagesUi.cabinetItems.sort.byEquipmentAsc") },
      { value: "-equipment_type_name", label: t("pagesUi.cabinetItems.sort.byEquipmentDesc") },
      { value: "manufacturer_name", label: t("pagesUi.cabinetItems.sort.byManufacturerAsc") },
      { value: "-manufacturer_name", label: t("pagesUi.cabinetItems.sort.byManufacturerDesc") }
    ],
    [t]
  );

  const [containerType, containerId] = useMemo(() => {
    if (!containerFilter) {
      return ["", 0] as const;
    }
    const [type, idValue] = containerFilter.split(":");
    return [type, Number(idValue)] as const;
  }, [containerFilter]);

  const itemsQuery = useQuery({
    queryKey: [
      "equipment-in-operation",
      page,
      pageSize,
      q,
      sort,
      containerFilter,
      equipmentFilter,
      manufacturerFilter,
      locationFilter,
      showDeleted
    ],
    queryFn: () =>
      listEntity<EquipmentInOperationItem>("/equipment-in-operation", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        filters: {
          cabinet_id: containerType === "cabinet" ? containerId : undefined,
          assembly_id: containerType === "assembly" ? containerId : undefined,
          equipment_type_id: equipmentFilter || undefined,
          manufacturer_id: manufacturerFilter || undefined,
          location_id: locationFilter || undefined
        },
        is_deleted: showDeleted ? true : false
      })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-options"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: 200 })
  });

  const assembliesQuery = useQuery({
    queryKey: ["assemblies-options"],
    queryFn: () => listEntity<Assembly>("/assemblies", { page: 1, page_size: 200 })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-options"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: 200 })
  });

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers-options"],
    queryFn: () => listEntity<Manufacturer>("/manufacturers", { page: 1, page_size: 200 })
  });

  const locationsQuery = useQuery({
    queryKey: ["locations-options"],
    queryFn: () => listEntity<Location>("/locations", { page: 1, page_size: 200, is_deleted: false })
  });

  useEffect(() => {
    if (itemsQuery.error) {
      setErrorMessage(
        itemsQuery.error instanceof Error
          ? itemsQuery.error.message
          : t("pagesUi.cabinetItems.errors.load")
      );
    }
  }, [itemsQuery.error, t]);


  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["equipment-in-operation"] });
  };

  const deleteMutation = useMutation({
    mutationFn: ({ id, source }: { id: number; source: EquipmentInOperationItem["source"] }) =>
      deleteEntity(source === "cabinet" ? "/cabinet-items" : "/assembly-items", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, source }: { id: number; source: EquipmentInOperationItem["source"] }) =>
      restoreEntity(source === "cabinet" ? "/cabinet-items" : "/assembly-items", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.restore"))
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      quantity,
      source
    }: {
      id: number;
      quantity: number;
      source: EquipmentInOperationItem["source"];
    }) => updateEntity(source === "cabinet" ? "/cabinet-items" : "/assembly-items", id, { quantity }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment-in-operation"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinetItems.errors.updateQuantity"))
  });

  const equipmentMap = useMemo(() => {
    const map = new Map<number, string>();
    equipmentTypesQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [equipmentTypesQuery.data?.items]);

  const containerOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    cabinetsQuery.data?.items.forEach((item) =>
      options.push({
        value: `cabinet:${item.id}`,
        label: `${t("menu.cabinets")}: ${item.name}`
      })
    );
    assembliesQuery.data?.items.forEach((item) =>
      options.push({
        value: `assembly:${item.id}`,
        label: `${t("menu.assemblies")}: ${item.name}`
      })
    );
    options.sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    return options;
  }, [assembliesQuery.data?.items, cabinetsQuery.data?.items, i18n.language, t]);

  const columns = useMemo<ColumnDef<EquipmentInOperationItem>[]>(() => {
    const base: ColumnDef<EquipmentInOperationItem>[] = [
      {
        header: t("common.fields.equipment"),
        cell: ({ row }) =>
          row.original.equipment_type_name ||
          equipmentMap.get(row.original.equipment_type_id) ||
          row.original.equipment_type_id
      },
      { header: t("common.fields.quantity"), accessorKey: "quantity" },
      {
        header: t("common.fields.cabinetAssembly"),
        cell: ({ row }) => row.original.container_name || "-"
      },
      {
        header: t("common.fields.location"),
        cell: ({ row }) => row.original.location_full_path || "-"
      },
      {
        header: t("common.fields.manufacturer"),
        cell: ({ row }) => row.original.manufacturer_name || "-"
      }
    ];

    if (canWrite) {
      base.push({
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() => {
                setEditItem(row.original);
                setEditQuantity(row.original.quantity);
                setEditOpen(true);
              }}
            >
              {t("actions.edit")}
            </AppButton>
            <AppButton
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={
                row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />
              }
              onClick={() =>
                row.original.is_deleted
                  ? restoreMutation.mutate({ id: row.original.id, source: row.original.source })
                  : deleteMutation.mutate({ id: row.original.id, source: row.original.source })
              }
            >
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </AppButton>
          </Box>
        )
      });
    }

    return base;
  }, [canWrite, deleteMutation, equipmentMap, restoreMutation, t, i18n.language]);

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
              <InputLabel>{t("common.fields.cabinetAssembly")}</InputLabel>
              <Select
                label={t("common.fields.cabinetAssembly")}
                value={containerFilter}
                onChange={(event) => {
                  setContainerFilter(event.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {containerOptions.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("common.fields.equipment")}</InputLabel>
              <Select
                label={t("common.fields.equipment")}
                value={equipmentFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setEquipmentFilter(value === "" ? "" : Number(value));
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
              <InputLabel>{t("common.fields.manufacturer")}</InputLabel>
              <Select
                label={t("common.fields.manufacturer")}
                value={manufacturerFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setManufacturerFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {manufacturersQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("common.fields.location")}</InputLabel>
              <Select
                label={t("common.fields.location")}
                value={locationFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setLocationFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {locationsQuery.data?.items.map((item) => (
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
              label={t("common.showDeleted")}
            />
          </Box>

          <DataTable data={itemsQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
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
              label={t("common.fields.quantity")}
              type="number"
              value={editQuantity}
              onChange={(event) => setEditQuantity(Number(event.target.value))}
              inputProps={{ min: 0 }}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <AppButton onClick={() => setEditOpen(false)}>{t("actions.cancel")}</AppButton>
            <AppButton
              variant="contained"
              onClick={() => {
                if (editItem) {
                  updateMutation.mutate({
                    id: editItem.id,
                    quantity: editQuantity,
                    source: editItem.source
                  });
                }
                setEditOpen(false);
              }}
            >
              {t("actions.save")}
            </AppButton>
          </DialogActions>
        </Dialog>
      )}

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}



