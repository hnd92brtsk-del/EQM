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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
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

type IOSignal = {
  id: number;
  cabinet_component_id: number;
  tag_name?: string | null;
  signal_name?: string | null;
  plc_channel_address?: string | null;
  signal_type: string;
  measurement_type: string;
  terminal_connection?: string | null;
  sensor_range?: string | null;
  engineering_units?: string | null;
  is_deleted: boolean;
  created_at?: string;
};

type CabinetItem = {
  id: number;
  cabinet_id: number;
  equipment_type_id: number;
};

type Cabinet = { id: number; name: string };

type EquipmentType = { id: number; name: string };

const signalTypeOptions = [
  { value: "AI", label: "AI" },
  { value: "AO", label: "AO" },
  { value: "DI", label: "DI" },
  { value: "DO", label: "DO" }
];

const measurementOptions = [
  { value: "4-20mA (AI)", label: "4-20mA (AI)" },
  { value: "0-20mA (AI)", label: "0-20mA (AI)" },
  { value: "0-10V (AI)", label: "0-10V (AI)" },
  { value: "Pt100 (RTD AI)", label: "Pt100 (RTD AI)" },
  { value: "Pt1000 (RTD AI)", label: "Pt1000 (RTD AI)" },
  { value: "M50 (RTD AI)", label: "M50 (RTD AI)" },
  { value: "24V (DI)", label: "24V (DI)" },
  { value: "220V (DI)", label: "220V (DI)" },
  { value: "8-16mA (DI)", label: "8-16mA (DI)" }
];

const sortOptions = [
  { value: "-created_at", label: "По дате (новые)" },
  { value: "created_at", label: "По дате (старые)" }
];

const pageSizeOptions = [10, 20, 50, 100];

export default function IOSignalsPage() {
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
  const [signalTypeFilter, setSignalTypeFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signalsQuery = useQuery({
    queryKey: [
      "io-signals",
      page,
      pageSize,
      q,
      sort,
      cabinetFilter,
      equipmentFilter,
      signalTypeFilter,
      showDeleted
    ],
    queryFn: () =>
      listEntity<IOSignal>("/io-signals", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          cabinet_id: cabinetFilter || undefined,
          equipment_type_id: equipmentFilter || undefined,
          signal_type: signalTypeFilter || undefined
        }
      })
  });

  const cabinetItemsQuery = useQuery({
    queryKey: ["cabinet-items-options"],
    queryFn: () => listEntity<CabinetItem>("/cabinet-items", { page: 1, page_size: 200 })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets-options"],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: 200 })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types-options"],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: 200 })
  });

  useEffect(() => {
    if (signalsQuery.error) {
      setErrorMessage(
        signalsQuery.error instanceof Error
          ? signalsQuery.error.message
          : "Ошибка загрузки I/O сигналов"
      );
    }
  }, [signalsQuery.error]);

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

  const cabinetItemMap = useMemo(() => {
    const map = new Map<number, string>();
    cabinetItemsQuery.data?.items.forEach((item) => {
      const cabinetLabel = cabinetMap.get(item.cabinet_id) || `Шкаф ${item.cabinet_id}`;
      const equipmentLabel =
        equipmentMap.get(item.equipment_type_id) || `Номенклатура ${item.equipment_type_id}`;
      map.set(item.id, `${cabinetLabel} - ${equipmentLabel}`);
    });
    return map;
  }, [cabinetItemsQuery.data?.items, cabinetMap, equipmentMap]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["io-signals"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Partial<IOSignal>) => createEntity("/io-signals", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка создания сигнала")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<IOSignal> }) =>
      updateEntity("/io-signals", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления сигнала")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/io-signals", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка удаления сигнала")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/io-signals", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка восстановления сигнала")
  });

  const columns = useMemo<ColumnDef<IOSignal>[]>(() => {
    const base: ColumnDef<IOSignal>[] = [
      {
        header: "Компонент",
        cell: ({ row }) =>
          cabinetItemMap.get(row.original.cabinet_component_id) || row.original.cabinet_component_id
      },
      { header: "Tag", accessorKey: "tag_name" },
      { header: "Сигнал", accessorKey: "signal_name" },
      { header: "Тип", accessorKey: "signal_type" },
      { header: "Тип измерения", accessorKey: "measurement_type" },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удалено" : "Активно"}</span>
        )
      }
    ];

    if (canWrite) {
      base.push({
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "I/O сигнал",
                  fields: [
                    {
                      name: "cabinet_component_id",
                      label: "Компонент",
                      type: "select",
                      options:
                        cabinetItemsQuery.data?.items.map((item) => ({
                          label:
                            cabinetItemMap.get(item.id) ||
                            `Компонент ${item.id}`,
                          value: item.id
                        })) || []
                    },
                    { name: "tag_name", label: "Tag", type: "text" },
                    { name: "signal_name", label: "Сигнал", type: "text" },
                    { name: "plc_channel_address", label: "Адрес PLC", type: "text" },
                    {
                      name: "signal_type",
                      label: "Тип сигнала",
                      type: "select",
                      options: signalTypeOptions
                    },
                    {
                      name: "measurement_type",
                      label: "Тип измерения",
                      type: "select",
                      options: measurementOptions
                    },
                    { name: "terminal_connection", label: "Клемма", type: "text" },
                    { name: "sensor_range", label: "Диапазон", type: "text" },
                    { name: "engineering_units", label: "Ед. измерения", type: "text" }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      id: row.original.id,
                      payload: {
                        cabinet_component_id: values.cabinet_component_id,
                        tag_name: values.tag_name,
                        signal_name: values.signal_name,
                        plc_channel_address: values.plc_channel_address,
                        signal_type: values.signal_type,
                        measurement_type: values.measurement_type,
                        terminal_connection: values.terminal_connection,
                        sensor_range: values.sensor_range,
                        engineering_units: values.engineering_units
                      }
                    });
                    setDialog(null);
                  }
                })
              }
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
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </Button>
          </Box>
        )
      });
    }

    return base;
  }, [
    cabinetItemMap,
    cabinetItemsQuery.data?.items,
    canWrite,
    deleteMutation,
    restoreMutation,
    updateMutation,
    t,
    i18n.language
  ]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.ioSignals")}</Typography>
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
                <MenuItem value="">Все</MenuItem>
                {equipmentTypesQuery.data?.items.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Тип сигнала</InputLabel>
              <Select
                label="Тип сигнала"
                value={signalTypeFilter}
                onChange={(event) => {
                  setSignalTypeFilter(event.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="">Все</MenuItem>
                {signalTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
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
              label="Показывать удаленные"
            />
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: "Новый I/O сигнал",
                    fields: [
                      {
                        name: "cabinet_component_id",
                        label: "Компонент",
                        type: "select",
                        options:
                          cabinetItemsQuery.data?.items.map((item) => ({
                            label:
                              cabinetItemMap.get(item.id) ||
                              `Компонент ${item.id}`,
                            value: item.id
                          })) || []
                      },
                      { name: "tag_name", label: "Tag", type: "text" },
                      { name: "signal_name", label: "Сигнал", type: "text" },
                      { name: "plc_channel_address", label: "Адрес PLC", type: "text" },
                      {
                        name: "signal_type",
                        label: "Тип сигнала",
                        type: "select",
                        options: signalTypeOptions
                      },
                      {
                        name: "measurement_type",
                        label: "Тип измерения",
                        type: "select",
                        options: measurementOptions
                      },
                      { name: "terminal_connection", label: "Клемма", type: "text" },
                      { name: "sensor_range", label: "Диапазон", type: "text" },
                      { name: "engineering_units", label: "Ед. измерения", type: "text" }
                    ],
                    values: {
                      cabinet_component_id: "",
                      tag_name: "",
                      signal_name: "",
                      plc_channel_address: "",
                      signal_type: "AI",
                      measurement_type: "4-20mA (AI)",
                      terminal_connection: "",
                      sensor_range: "",
                      engineering_units: ""
                    },
                    onSave: (values) => {
                      createMutation.mutate({
                        cabinet_component_id: values.cabinet_component_id,
                        tag_name: values.tag_name,
                        signal_name: values.signal_name,
                        plc_channel_address: values.plc_channel_address,
                        signal_type: values.signal_type,
                        measurement_type: values.measurement_type,
                        terminal_connection: values.terminal_connection,
                        sensor_range: values.sensor_range,
                        engineering_units: values.engineering_units
                      });
                      setDialog(null);
                    }
                  })
                }
              >
                {t("actions.add")}
              </Button>
            )}
          </Box>

          <DataTable data={signalsQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            count={signalsQuery.data?.total || 0}
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
