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
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Switch,
  Typography,
  Checkbox,
  FormControlLabel
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTable } from "../components/DataTable";
import { createEntity, listEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 200;

type Manufacturer = { id: number; name: string; country: string; is_deleted: boolean };

type Location = { id: number; name: string; parent_id?: number | null; is_deleted: boolean };

type EquipmentType = {
  id: number;
  name: string;
  nomenclature_number: string;
  manufacturer_id: number;
  is_channel_forming: boolean;
  channel_count: number;
  is_deleted: boolean;
};

type Warehouse = { id: number; name: string; location_id?: number | null; is_deleted: boolean };

type Cabinet = { id: number; name: string; location_id?: number | null; is_deleted: boolean };

type FieldOption = { label: string; value: number | string };

type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  options?: FieldOption[];
};

type DialogState = {
  open: boolean;
  title: string;
  fields: FieldConfig[];
  values: Record<string, any>;
  onSave: (values: Record<string, any>) => void;
};

function EntityDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const [values, setValues] = useState(state.values);

  useEffect(() => {
    setValues(state.values);
  }, [state.values]);

  return (
    <Dialog open={state.open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{state.title}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
        {state.fields.map((field) => {
          if (field.type === "select") {
            return (
              <FormControl key={field.name} fullWidth>
                <InputLabel>{field.label}</InputLabel>
                <Select
                  label={field.label}
                  value={values[field.name] ?? ""}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>Не выбрано</em>
                  </MenuItem>
                  {field.options?.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            );
          }

          if (field.type === "checkbox") {
            return (
              <FormControlLabel
                key={field.name}
                control={
                  <Checkbox
                    checked={Boolean(values[field.name])}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.name]: event.target.checked }))
                    }
                  />
                }
                label={field.label}
              />
            );
          }

          return (
            <TextField
              key={field.name}
              label={field.label}
              type={field.type}
              value={values[field.name] ?? ""}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  [field.name]: field.type === "number" ? Number(event.target.value) : event.target.value
                }))
              }
              fullWidth
            />
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={() => state.onSave(values)} variant="contained">
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DictionariesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers", showDeleted],
    queryFn: () => listEntity<Manufacturer>("/manufacturers", { page: 1, page_size: PAGE_SIZE, include_deleted: showDeleted })
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", showDeleted],
    queryFn: () => listEntity<Location>("/locations", { page: 1, page_size: PAGE_SIZE, include_deleted: showDeleted })
  });

  const equipmentTypesQuery = useQuery({
    queryKey: ["equipment-types", showDeleted],
    queryFn: () => listEntity<EquipmentType>("/equipment-types", { page: 1, page_size: PAGE_SIZE, include_deleted: showDeleted })
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", showDeleted],
    queryFn: () => listEntity<Warehouse>("/warehouses", { page: 1, page_size: PAGE_SIZE, include_deleted: showDeleted })
  });

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets", showDeleted],
    queryFn: () => listEntity<Cabinet>("/cabinets", { page: 1, page_size: PAGE_SIZE, include_deleted: showDeleted })
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["manufacturers", showDeleted] });
    queryClient.invalidateQueries({ queryKey: ["locations", showDeleted] });
    queryClient.invalidateQueries({ queryKey: ["equipment-types", showDeleted] });
    queryClient.invalidateQueries({ queryKey: ["warehouses", showDeleted] });
    queryClient.invalidateQueries({ queryKey: ["cabinets", showDeleted] });
  };

  const createMutation = useMutation({
    mutationFn: ({ path, payload }: { path: string; payload: any }) => createEntity(path, payload),
    onSuccess: refresh
  });

  const updateMutation = useMutation({
    mutationFn: ({ path, id, payload }: { path: string; id: number; payload: any }) =>
      updateEntity(path, id, payload),
    onSuccess: refresh
  });

  const manufacturerColumns = useMemo<ColumnDef<Manufacturer>[]>(
    () => [
      { header: "Название", accessorKey: "name" },
      { header: "Страна", accessorKey: "country" },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удалено" : "Активно"}</span>
        )
      },
      {
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Производитель",
                  fields: [
                    { name: "name", label: "Название", type: "text" },
                    { name: "country", label: "Страна", type: "text" }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      path: "/manufacturers",
                      id: row.original.id,
                      payload: { name: values.name, country: values.country }
                    });
                    setDialog(null);
                  }
                })
              }
              disabled={!canEdit}
            >
              Изменить
            </Button>
            <Button
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
              onClick={() =>
                updateMutation.mutate({
                  path: "/manufacturers",
                  id: row.original.id,
                  payload: { is_deleted: !row.original.is_deleted }
                })
              }
              disabled={!canEdit}
            >
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </Button>
          </Box>
        )
      }
    ],
    [canEdit, updateMutation]
  );

  const locationColumns = useMemo<ColumnDef<Location>[]>(
    () => [
      { header: "Название", accessorKey: "name" },
      { header: "Родитель", accessorKey: "parent_id" },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удалено" : "Активно"}</span>
        )
      },
      {
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Локация",
                  fields: [
                    { name: "name", label: "Название", type: "text" },
                    {
                      name: "parent_id",
                      label: "Родитель",
                      type: "select",
                      options:
                        locationsQuery.data?.items.map((loc) => ({
                          label: loc.name,
                          value: loc.id
                        })) || []
                    }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      path: "/locations",
                      id: row.original.id,
                      payload: { name: values.name, parent_id: values.parent_id || null }
                    });
                    setDialog(null);
                  }
                })
              }
              disabled={!canEdit}
            >
              Изменить
            </Button>
            <Button
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
              onClick={() =>
                updateMutation.mutate({
                  path: "/locations",
                  id: row.original.id,
                  payload: { is_deleted: !row.original.is_deleted }
                })
              }
              disabled={!canEdit}
            >
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </Button>
          </Box>
        )
      }
    ],
    [canEdit, locationsQuery.data?.items, updateMutation]
  );

  const equipmentColumns = useMemo<ColumnDef<EquipmentType>[]>(
    () => [
      { header: "Название", accessorKey: "name" },
      { header: "Номенклатура", accessorKey: "nomenclature_number" },
      { header: "Производитель", accessorKey: "manufacturer_id" },
      {
        header: "Каналы",
        cell: ({ row }) =>
          row.original.is_channel_forming ? `Да (${row.original.channel_count})` : "Нет"
      },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удалено" : "Активно"}</span>
        )
      },
      {
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Тип оборудования",
                  fields: [
                    { name: "name", label: "Название", type: "text" },
                    { name: "nomenclature_number", label: "Номенклатура", type: "text" },
                    {
                      name: "manufacturer_id",
                      label: "Производитель",
                      type: "select",
                      options:
                        manufacturersQuery.data?.items.map((m) => ({
                          label: m.name,
                          value: m.id
                        })) || []
                    },
                    { name: "is_channel_forming", label: "Каналообразующее", type: "checkbox" },
                    { name: "channel_count", label: "Кол-во каналов", type: "number" }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      path: "/equipment-types",
                      id: row.original.id,
                      payload: {
                        name: values.name,
                        nomenclature_number: values.nomenclature_number,
                        manufacturer_id: values.manufacturer_id,
                        is_channel_forming: values.is_channel_forming,
                        channel_count: values.channel_count
                      }
                    });
                    setDialog(null);
                  }
                })
              }
              disabled={!canEdit}
            >
              Изменить
            </Button>
            <Button
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
              onClick={() =>
                updateMutation.mutate({
                  path: "/equipment-types",
                  id: row.original.id,
                  payload: { is_deleted: !row.original.is_deleted }
                })
              }
              disabled={!canEdit}
            >
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </Button>
          </Box>
        )
      }
    ],
    [canEdit, manufacturersQuery.data?.items, updateMutation]
  );

  const warehouseColumns = useMemo<ColumnDef<Warehouse>[]>(
    () => [
      { header: "Название", accessorKey: "name" },
      { header: "Локация", accessorKey: "location_id" },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удалено" : "Активно"}</span>
        )
      },
      {
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Склад",
                  fields: [
                    { name: "name", label: "Название", type: "text" },
                    {
                      name: "location_id",
                      label: "Локация",
                      type: "select",
                      options:
                        locationsQuery.data?.items.map((loc) => ({
                          label: loc.name,
                          value: loc.id
                        })) || []
                    }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      path: "/warehouses",
                      id: row.original.id,
                      payload: { name: values.name, location_id: values.location_id || null }
                    });
                    setDialog(null);
                  }
                })
              }
              disabled={!canEdit}
            >
              Изменить
            </Button>
            <Button
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
              onClick={() =>
                updateMutation.mutate({
                  path: "/warehouses",
                  id: row.original.id,
                  payload: { is_deleted: !row.original.is_deleted }
                })
              }
              disabled={!canEdit}
            >
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </Button>
          </Box>
        )
      }
    ],
    [canEdit, locationsQuery.data?.items, updateMutation]
  );

  const cabinetColumns = useMemo<ColumnDef<Cabinet>[]>(
    () => [
      { header: "Название", accessorKey: "name" },
      { header: "Локация", accessorKey: "location_id" },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удалено" : "Активно"}</span>
        )
      },
      {
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Шкаф",
                  fields: [
                    { name: "name", label: "Название", type: "text" },
                    {
                      name: "location_id",
                      label: "Локация",
                      type: "select",
                      options:
                        locationsQuery.data?.items.map((loc) => ({
                          label: loc.name,
                          value: loc.id
                        })) || []
                    }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      path: "/cabinets",
                      id: row.original.id,
                      payload: { name: values.name, location_id: values.location_id || null }
                    });
                    setDialog(null);
                  }
                })
              }
              disabled={!canEdit}
            >
              Изменить
            </Button>
            <Button
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
              onClick={() =>
                updateMutation.mutate({
                  path: "/cabinets",
                  id: row.original.id,
                  payload: { is_deleted: !row.original.is_deleted }
                })
              }
              disabled={!canEdit}
            >
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </Button>
          </Box>
        )
      }
    ],
    [canEdit, locationsQuery.data?.items, updateMutation]
  );

  const renderSection = () => {
    if (tab === 0) {
      return (
        <Card>
          <CardContent>
            <Box className="table-toolbar">
              <Typography variant="h6">Производители</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                disabled={!canEdit}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: "Новый производитель",
                    fields: [
                      { name: "name", label: "Название", type: "text" },
                      { name: "country", label: "Страна", type: "text" }
                    ],
                    values: { name: "", country: "" },
                    onSave: (values) => {
                      createMutation.mutate({ path: "/manufacturers", payload: values });
                      setDialog(null);
                    }
                  })
                }
              >
                Добавить
              </Button>
            </Box>
            <DataTable data={manufacturersQuery.data?.items || []} columns={manufacturerColumns} />
          </CardContent>
        </Card>
      );
    }

    if (tab === 1) {
      return (
        <Card>
          <CardContent>
            <Box className="table-toolbar">
              <Typography variant="h6">Локации</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                disabled={!canEdit}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: "Новая локация",
                    fields: [
                      { name: "name", label: "Название", type: "text" },
                      {
                        name: "parent_id",
                        label: "Родитель",
                        type: "select",
                        options:
                          locationsQuery.data?.items.map((loc) => ({
                            label: loc.name,
                            value: loc.id
                          })) || []
                      }
                    ],
                    values: { name: "", parent_id: "" },
                    onSave: (values) => {
                      createMutation.mutate({
                        path: "/locations",
                        payload: { name: values.name, parent_id: values.parent_id || null }
                      });
                      setDialog(null);
                    }
                  })
                }
              >
                Добавить
              </Button>
            </Box>
            <DataTable data={locationsQuery.data?.items || []} columns={locationColumns} />
          </CardContent>
        </Card>
      );
    }

    if (tab === 2) {
      return (
        <Card>
          <CardContent>
            <Box className="table-toolbar">
              <Typography variant="h6">Номенклатура</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                disabled={!canEdit}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: "Новый тип оборудования",
                    fields: [
                      { name: "name", label: "Название", type: "text" },
                      { name: "nomenclature_number", label: "Номенклатура", type: "text" },
                      {
                        name: "manufacturer_id",
                        label: "Производитель",
                        type: "select",
                        options:
                          manufacturersQuery.data?.items.map((m) => ({
                            label: m.name,
                            value: m.id
                          })) || []
                      },
                      { name: "is_channel_forming", label: "Каналообразующее", type: "checkbox" },
                      { name: "channel_count", label: "Кол-во каналов", type: "number" }
                    ],
                    values: {
                      name: "",
                      nomenclature_number: "",
                      manufacturer_id: "",
                      is_channel_forming: false,
                      channel_count: 0
                    },
                    onSave: (values) => {
                      createMutation.mutate({ path: "/equipment-types", payload: values });
                      setDialog(null);
                    }
                  })
                }
              >
                Добавить
              </Button>
            </Box>
            <DataTable data={equipmentTypesQuery.data?.items || []} columns={equipmentColumns} />
          </CardContent>
        </Card>
      );
    }

    if (tab === 3) {
      return (
        <Card>
          <CardContent>
            <Box className="table-toolbar">
              <Typography variant="h6">Склады</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                disabled={!canEdit}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: "Новый склад",
                    fields: [
                      { name: "name", label: "Название", type: "text" },
                      {
                        name: "location_id",
                        label: "Локация",
                        type: "select",
                        options:
                          locationsQuery.data?.items.map((loc) => ({
                            label: loc.name,
                            value: loc.id
                          })) || []
                      }
                    ],
                    values: { name: "", location_id: "" },
                    onSave: (values) => {
                      createMutation.mutate({
                        path: "/warehouses",
                        payload: { name: values.name, location_id: values.location_id || null }
                      });
                      setDialog(null);
                    }
                  })
                }
              >
                Добавить
              </Button>
            </Box>
            <DataTable data={warehousesQuery.data?.items || []} columns={warehouseColumns} />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent>
          <Box className="table-toolbar">
            <Typography variant="h6">Шкафы</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              disabled={!canEdit}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Новый шкаф",
                  fields: [
                    { name: "name", label: "Название", type: "text" },
                    {
                      name: "location_id",
                      label: "Локация",
                      type: "select",
                      options:
                        locationsQuery.data?.items.map((loc) => ({
                          label: loc.name,
                          value: loc.id
                        })) || []
                    }
                  ],
                  values: { name: "", location_id: "" },
                  onSave: (values) => {
                    createMutation.mutate({
                      path: "/cabinets",
                      payload: { name: values.name, location_id: values.location_id || null }
                    });
                    setDialog(null);
                  }
                })
              }
            >
              Добавить
            </Button>
          </Box>
          <DataTable data={cabinetsQuery.data?.items || []} columns={cabinetColumns} />
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Справочники</Typography>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label="Производители" />
        <Tab label="Локации" />
        <Tab label="Номенклатура" />
        <Tab label="Склады" />
        <Tab label="Шкафы" />
            </Tabs>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <FormControlLabel
          control={<Switch checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} />}
          label="Показывать удаленные"
        />
      </Box>
      {renderSection()}
      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
    </Box>
  );
}





