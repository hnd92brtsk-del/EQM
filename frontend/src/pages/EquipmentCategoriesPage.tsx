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
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { DictionariesTabs } from "../components/DictionariesTabs";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";

type EquipmentCategory = {
  id: number;
  name: string;
  is_deleted: boolean;
  created_at?: string;
};

const sortOptions = [
  { value: "name", label: "По названию (А-Я)" },
  { value: "-name", label: "По названию (Я-А)" },
  { value: "created_at", label: "По дате создания (сначала старые)" },
  { value: "-created_at", label: "По дате создания (сначала новые)" }
];

const pageSizeOptions = [10, 20, 50, 100];

export default function EquipmentCategoriesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["equipment-categories", page, pageSize, q, sort, showDeleted],
    queryFn: () =>
      listEntity<EquipmentCategory>("/equipment-categories", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false
      })
  });

  useEffect(() => {
    if (categoriesQuery.error) {
      setErrorMessage(
        categoriesQuery.error instanceof Error
          ? categoriesQuery.error.message
          : "Ошибка загрузки справочника типов оборудования"
      );
    }
  }, [categoriesQuery.error]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["equipment-categories"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string }) => createEntity("/equipment-categories", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка создания записи")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<EquipmentCategory> }) =>
      updateEntity("/equipment-categories", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления записи")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/equipment-categories", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка удаления записи")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/equipment-categories", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка восстановления записи")
  });

  const columns = useMemo<ColumnDef<EquipmentCategory>[]>(() => {
    const base: ColumnDef<EquipmentCategory>[] = [
      { header: "Название", accessorKey: "name" },
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
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Редактировать тип оборудования",
                  fields: [{ name: "name", label: "Название", type: "text" }],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      id: row.original.id,
                      payload: { name: values.name }
                    });
                    setDialog(null);
                  }
                })
              }
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
                  ? restoreMutation.mutate(row.original.id)
                  : deleteMutation.mutate(row.original.id)
              }
            >
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </AppButton>
          </Box>
        )
      });
    }

    return base;
  }, [canWrite, deleteMutation, restoreMutation, updateMutation, t]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Типы оборудования</Typography>
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
                    title: "Новый тип оборудования",
                    fields: [{ name: "name", label: "Название", type: "text" }],
                    values: { name: "" },
                    onSave: (values) => {
                      createMutation.mutate({ name: values.name });
                      setDialog(null);
                    }
                  })
                }
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable data={categoriesQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            count={categoriesQuery.data?.total || 0}
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



