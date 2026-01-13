import { useEffect, useMemo, useState } from "react";
import {
  Box,Card,
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
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { createEntity, listEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";

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
  ai_count: number;
  di_count: number;
  ao_count: number;
  do_count: number;
  is_network: boolean;
  network_ports?: { type: string; count: number }[] | null;
  is_deleted: boolean;
};

type Warehouse = { id: number; name: string; location_id?: number | null; is_deleted: boolean };

type Cabinet = { id: number; name: string; location_id?: number | null; is_deleted: boolean };

type FieldOption = { label: string; value: number | string };

type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "ports";
  options?: FieldOption[];
  visibleWhen?: (values: Record<string, any>) => boolean;
};

type DialogState = {
  open: boolean;
  title: string;
  fields: FieldConfig[];
  values: Record<string, any>;
  onSave: (values: Record<string, any>) => void;
};

const networkPortOptions = [
  { label: "RJ-45 (8p8c)", value: "RJ-45 (8p8c)" },
  { label: "LC", value: "LC" },
  { label: "SC", value: "SC" },
  { label: "FC", value: "FC" },
  { label: "ST", value: "ST" },
  { label: "RS-485", value: "RS-485" },
  { label: "RS-232", value: "RS-232" }
];

function EntityDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const [values, setValues] = useState(state.values);
  const { t } = useTranslation();

  useEffect(() => {
    setValues(state.values);
  }, [state.values]);

  return (
    <Dialog open={state.open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{state.title}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
        {state.fields.map((field) => {
          if (field.visibleWhen && !field.visibleWhen(values)) {
            return null;
          }

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
                    <em>{t("actions.notSelected")}</em>
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

          if (field.type === "ports") {
            const ports = Array.isArray(values[field.name]) ? values[field.name] : [];
            return (
              <Box key={field.name} sx={{ display: "grid", gap: 1 }}>
                <Box sx={{ fontWeight: 600 }}>{field.label}</Box>
                {ports.map((item: any, index: number) => (
                  <Box
                    key={`${field.name}-${index}`}
                    sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 120px auto" }}
                  >
                    <FormControl fullWidth>
                      <InputLabel>{t("common.fields.portType")}</InputLabel>
                      <Select
                        label={t("common.fields.portType")}
                        value={item?.type ?? ""}
                        onChange={(event) => {
                          const next = [...ports];
                          next[index] = { ...next[index], type: event.target.value };
                          setValues((prev) => ({ ...prev, [field.name]: next }));
                        }}
                      >
                        <MenuItem value="">
                          <em>{t("actions.notSelected")}</em>
                        </MenuItem>
                        {field.options?.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label={t("common.fields.portCount")}
                      type="number"
                      value={item?.count ?? 0}
                      onChange={(event) => {
                        const next = [...ports];
                        next[index] = {
                          ...next[index],
                          count: event.target.value === "" ? "" : Number(event.target.value)
                        };
                        setValues((prev) => ({ ...prev, [field.name]: next }));
                      }}
                      fullWidth
                    />
                    <AppButton
                      size="small"
                      color="error"
                      onClick={() => {
                        const next = ports.filter((_: any, i: number) => i !== index);
                        setValues((prev) => ({ ...prev, [field.name]: next }));
                      }}
                    >
                      {t("actions.delete")}
                    </AppButton>
                  </Box>
                ))}
                <AppButton
                  size="small"
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      [field.name]: [...ports, { type: "", count: 0 }]
                    }))
                  }
                >
                  {t("actions.add")}
                </AppButton>
              </Box>
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
        <AppButton onClick={onClose}>{t("actions.cancel")}</AppButton>
        <AppButton onClick={() => state.onSave(values)} variant="contained">
          {t("actions.save")}
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}

export default function DictionariesPage() {
  const { t, i18n } = useTranslation();
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
      { header: t("common.fields.name"), accessorKey: "name" },
      { header: t("common.fields.country"), accessorKey: "country" },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
        )
      },
      {
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: t("pagesUi.manufacturers.dialogs.editTitle"),
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    { name: "country", label: t("common.fields.country"), type: "text" }
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
              {t("actions.edit")}
            </AppButton>
            <AppButton
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
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </AppButton>
          </Box>
        )
      }
    ],
    [canEdit, updateMutation, t, i18n.language]
  );

  const locationColumns = useMemo<ColumnDef<Location>[]>(
    () => [
      { header: t("common.fields.name"), accessorKey: "name" },
      { header: t("common.fields.parent"), accessorKey: "parent_id" },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
        )
      },
      {
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: t("pagesUi.locations.dialogs.editTitle"),
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    {
                      name: "parent_id",
                      label: t("common.fields.parent"),
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
              {t("actions.edit")}
            </AppButton>
            <AppButton
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
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </AppButton>
          </Box>
        )
      }
    ],
    [canEdit, locationsQuery.data?.items, updateMutation, t, i18n.language]
  );

  const equipmentColumns = useMemo<ColumnDef<EquipmentType>[]>(
    () => [
      { header: t("common.fields.name"), accessorKey: "name" },
      { header: t("common.fields.nomenclature"), accessorKey: "nomenclature_number" },
      { header: t("common.fields.manufacturer"), accessorKey: "manufacturer_id" },
      {
        header: t("pagesUi.equipmentTypes.columns.channelsDetailed"),
        cell: ({ row }) => {
          if (!row.original.is_channel_forming) {
            return t("common.no");
          }
          const ai = row.original.ai_count || 0;
          const di = row.original.di_count || 0;
          const ao = row.original.ao_count || 0;
          const doCount = row.original.do_count || 0;
          const total = ai + di + ao + doCount;
          const fallbackAi = total === 0 && row.original.channel_count > 0 ? row.original.channel_count : ai;
          return `AI ${fallbackAi} / DI ${di} / AO ${ao} / DO ${doCount}`;
        }
      },
      {
        header: t("common.fields.portsInterfaces"),
        cell: ({ row }) => {
          if (!row.original.is_network || !row.original.network_ports?.length) {
            return "-";
          }
          return row.original.network_ports
            .filter((item) => item.type)
            .map((item) => `${item.type}[${item.count ?? 0}]`)
            .join(", ");
        }
      },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
        )
      },
      {
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: t("pagesUi.equipmentTypes.dialogs.editTitle"),
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    { name: "nomenclature_number", label: t("common.fields.nomenclature"), type: "text" },
                    {
                      name: "manufacturer_id",
                      label: t("common.fields.manufacturer"),
                      type: "select",
                      options:
                        manufacturersQuery.data?.items.map((m) => ({
                          label: m.name,
                          value: m.id
                        })) || []
                    },
                    { name: "is_channel_forming", label: t("common.fields.channelForming"), type: "checkbox" },
                    {
                      name: "ai_count",
                      label: "AI",
                      type: "number",
                      visibleWhen: (values) => Boolean(values.is_channel_forming)
                    },
                    {
                      name: "di_count",
                      label: "DI",
                      type: "number",
                      visibleWhen: (values) => Boolean(values.is_channel_forming)
                    },
                    {
                      name: "ao_count",
                      label: "AO",
                      type: "number",
                      visibleWhen: (values) => Boolean(values.is_channel_forming)
                    },
                    {
                      name: "do_count",
                      label: "DO",
                      type: "number",
                      visibleWhen: (values) => Boolean(values.is_channel_forming)
                    },
                    {
                      name: "is_network",
                      label: t("common.fields.isNetwork"),
                      type: "checkbox"
                    },
                    {
                      name: "network_ports",
                      label: t("common.fields.portsInterfaces"),
                      type: "ports",
                      options: networkPortOptions,
                      visibleWhen: (values) => Boolean(values.is_network)
                    }
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
                        ai_count: Number(values.ai_count || 0),
                        di_count: Number(values.di_count || 0),
                        ao_count: Number(values.ao_count || 0),
                        do_count: Number(values.do_count || 0),
                        is_network: values.is_network,
                        network_ports: values.is_network
                          ? (values.network_ports || [])
                              .filter((item: { type: string; count: number }) => item?.type)
                              .map((item: { type: string; count: number }) => ({
                                type: item.type,
                                count: Number(item.count || 0)
                              }))
                          : undefined
                      }
                    });
                    setDialog(null);
                  }
                })
              }
              disabled={!canEdit}
            >
              {t("actions.edit")}
            </AppButton>
            <AppButton
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
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </AppButton>
          </Box>
        )
      }
    ],
    [canEdit, manufacturersQuery.data?.items, updateMutation, t, i18n.language]
  );

  const warehouseColumns = useMemo<ColumnDef<Warehouse>[]>(
    () => [
      { header: t("common.fields.name"), accessorKey: "name" },
      { header: t("common.fields.location"), accessorKey: "location_id" },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
        )
      },
      {
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: t("pagesUi.warehouses.dialogs.editTitle"),
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    {
                      name: "location_id",
                      label: t("common.fields.location"),
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
              {t("actions.edit")}
            </AppButton>
            <AppButton
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
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </AppButton>
          </Box>
        )
      }
    ],
    [canEdit, locationsQuery.data?.items, updateMutation, t, i18n.language]
  );

  const cabinetColumns = useMemo<ColumnDef<Cabinet>[]>(
    () => [
      { header: t("common.fields.name"), accessorKey: "name" },
      { header: t("common.fields.location"), accessorKey: "location_id" },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
        )
      },
      {
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: t("pagesUi.cabinets.dialogs.editTitle"),
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    {
                      name: "location_id",
                      label: t("common.fields.location"),
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
              {t("actions.edit")}
            </AppButton>
            <AppButton
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
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </AppButton>
          </Box>
        )
      }
    ],
    [canEdit, locationsQuery.data?.items, updateMutation, t, i18n.language]
  );

  const renderSection = () => {
    if (tab === 0) {
      return (
        <Card>
          <CardContent>
            <Box className="table-toolbar">
              <Typography variant="h6">{t("menu.manufacturers")}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                disabled={!canEdit}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.manufacturers.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      { name: "country", label: t("common.fields.country"), type: "text" }
                    ],
                    values: { name: "", country: "" },
                    onSave: (values) => {
                      createMutation.mutate({ path: "/manufacturers", payload: values });
                      setDialog(null);
                    }
                  })
                }
              >
                {t("actions.add")}
              </AppButton>
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
              <Typography variant="h6">{t("menu.locations")}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                disabled={!canEdit}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.locations.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      {
                        name: "parent_id",
                        label: t("common.fields.parent"),
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
                {t("actions.add")}
              </AppButton>
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
              <Typography variant="h6">{t("menu.nomenclature")}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                disabled={!canEdit}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.equipmentTypes.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      { name: "nomenclature_number", label: t("common.fields.nomenclature"), type: "text" },
                      {
                        name: "manufacturer_id",
                        label: t("common.fields.manufacturer"),
                        type: "select",
                        options:
                          manufacturersQuery.data?.items.map((m) => ({
                            label: m.name,
                            value: m.id
                          })) || []
                      },
                      { name: "is_channel_forming", label: t("common.fields.channelForming"), type: "checkbox" },
                      {
                        name: "ai_count",
                        label: "AI",
                        type: "number",
                        visibleWhen: (values) => Boolean(values.is_channel_forming)
                      },
                      {
                        name: "di_count",
                        label: "DI",
                        type: "number",
                        visibleWhen: (values) => Boolean(values.is_channel_forming)
                      },
                      {
                        name: "ao_count",
                        label: "AO",
                        type: "number",
                        visibleWhen: (values) => Boolean(values.is_channel_forming)
                      },
                      {
                        name: "do_count",
                        label: "DO",
                        type: "number",
                        visibleWhen: (values) => Boolean(values.is_channel_forming)
                      },
                      {
                        name: "is_network",
                        label: t("common.fields.isNetwork"),
                        type: "checkbox"
                      },
                      {
                        name: "network_ports",
                        label: t("common.fields.portsInterfaces"),
                        type: "ports",
                        options: networkPortOptions,
                        visibleWhen: (values) => Boolean(values.is_network)
                      }
                    ],
                    values: {
                      name: "",
                      nomenclature_number: "",
                      manufacturer_id: "",
                      is_channel_forming: false,
                      ai_count: 0,
                      di_count: 0,
                      ao_count: 0,
                      do_count: 0,
                      is_network: false,
                      network_ports: []
                    },
                    onSave: (values) => {
                      createMutation.mutate({
                        path: "/equipment-types",
                        payload: {
                          name: values.name,
                          nomenclature_number: values.nomenclature_number,
                          manufacturer_id: values.manufacturer_id,
                          is_channel_forming: values.is_channel_forming,
                          ai_count: Number(values.ai_count || 0),
                          di_count: Number(values.di_count || 0),
                          ao_count: Number(values.ao_count || 0),
                          do_count: Number(values.do_count || 0),
                          is_network: values.is_network,
                          network_ports: values.is_network
                            ? (values.network_ports || [])
                                .filter((item: { type: string; count: number }) => item?.type)
                                .map((item: { type: string; count: number }) => ({
                                  type: item.type,
                                  count: Number(item.count || 0)
                                }))
                            : undefined
                        }
                      });
                      setDialog(null);
                    }
                  })
                }
              >
                {t("actions.add")}
              </AppButton>
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
              <Typography variant="h6">{t("menu.warehouses")}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                disabled={!canEdit}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.warehouses.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      {
                        name: "location_id",
                        label: t("common.fields.location"),
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
                {t("actions.add")}
              </AppButton>
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
            <Typography variant="h6">{t("menu.cabinets")}</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <AppButton
              variant="contained"
              startIcon={<AddRoundedIcon />}
              disabled={!canEdit}
              onClick={() =>
                setDialog({
                  open: true,
                  title: t("pagesUi.cabinets.dialogs.createTitle"),
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    {
                      name: "location_id",
                      label: t("common.fields.location"),
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
              {t("actions.add")}
            </AppButton>
          </Box>
          <DataTable data={cabinetsQuery.data?.items || []} columns={cabinetColumns} />
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.dictionaries")}</Typography>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label={t("menu.manufacturers")} />
        <Tab label={t("menu.locations")} />
        <Tab label={t("menu.nomenclature")} />
        <Tab label={t("menu.warehouses")} />
        <Tab label={t("menu.cabinets")} />
            </Tabs>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <FormControlLabel
          control={<Switch checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} />}
          label={t("common.showDeleted")}
        />
      </Box>
      {renderSection()}
      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} />}
    </Box>
  );
}




