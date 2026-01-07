import { useEffect, useMemo, useState } from "react";
import {
  Box,Card,
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

import { DataTable } from "../components/DataTable";
import { DictionariesTabs } from "../components/DictionariesTabs";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";

type Manufacturer = {
  id: number;
  name: string;
  country: string;
  is_deleted: boolean;
  created_at?: string;
};

const sortOptions = [
  { value: "name", label: "По названию (А-Я)" },
  { value: "-name", label: "По названию (Я-А)" },
  { value: "created_at", label: "По дате создания (старые)" },
  { value: "-created_at", label: "По дате создания (новые)" }
];

const pageSizeOptions = [10, 20, 50, 100];

export default function ManufacturersPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [showDeleted, setShowDeleted] = useState(false);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers", page, pageSize, q, sort, showDeleted, createdFrom, createdTo],
    queryFn: () =>
      listEntity<Manufacturer>("/manufacturers", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          created_at_from: createdFrom || undefined,
          created_at_to: createdTo || undefined
        }
      })
  });

  useEffect(() => {
    if (manufacturersQuery.error) {
      setErrorMessage(
        manufacturersQuery.error instanceof Error
          ? manufacturersQuery.error.message
          : "Ошибка загрузки производителей"
      );
    }
  }, [manufacturersQuery.error]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["manufacturers"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; country: string }) => createEntity("/manufacturers", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка создания производителя")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Manufacturer> }) =>
      updateEntity("/manufacturers", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления производителя")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/manufacturers", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка удаления производителя")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/manufacturers", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка восстановления производителя")
  });

  const columns = useMemo<ColumnDef<Manufacturer>[]>(() => {
    const base: ColumnDef<Manufacturer>[] = [
      { header: "Название", accessorKey: "name" },
      { header: "Страна", accessorKey: "country" },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удалено" : "Активно"}</span>
        )
      }
    ];

    if (canWrite) {
      base.push({
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <AppButton
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
                      id: row.original.id,
                      payload: { name: values.name, country: values.country }
                    });
                    setDialog(null);
                  }
                })
              }
            >
              Изменить
            </AppButton>
            <AppButton
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
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </AppButton>
          </Box>
        )
      });
    }

    return base;
  }, [canWrite, deleteMutation, restoreMutation, updateMutation]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Справочники</Typography>
      <DictionariesTabs />

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
              label="Поиск"
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

            <TextField
              label="Создано от"
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
              label="Создано до"
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
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
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
                      createMutation.mutate({ name: values.name, country: values.country });
                      setDialog(null);
                    }
                  })
                }
              >
                Добавить
              </AppButton>
            )}
          </Box>

          <DataTable data={manufacturersQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            count={manufacturersQuery.data?.total || 0}
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



