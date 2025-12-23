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
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const pageSizeOptions = [10, 20, 50, 100];

const sortOptions = [
  { value: "username", label: "По логину (А-Я)" },
  { value: "-username", label: "По логину (Я-А)" },
  { value: "role", label: "По роли (А-Я)" },
  { value: "-role", label: "По роли (Я-А)" },
  { value: "created_at", label: "По дате создания (старые)" },
  { value: "-created_at", label: "По дате создания (новые)" }
];

type User = {
  id: number;
  username: string;
  role: "admin" | "engineer" | "viewer";
  is_deleted: boolean;
};

export default function UsersPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<User["role"]>("engineer");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [roleFilter, setRoleFilter] = useState<User["role"] | "">("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users", page, pageSize, q, sort, roleFilter, showDeleted],
    queryFn: () =>
      listEntity<User>("/users", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          role: roleFilter || undefined
        }
      })
  });

  useEffect(() => {
    if (usersQuery.error) {
      setErrorMessage(
        usersQuery.error instanceof Error
          ? usersQuery.error.message
          : "Ошибка загрузки пользователей"
      );
    }
  }, [usersQuery.error]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => createEntity("/users", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка создания пользователя")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateEntity("/users", id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка обновления пользователя")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/users", id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка удаления пользователя")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/users", id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Ошибка восстановления пользователя")
  });

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setRole("engineer");
  };

  const columns = useMemo<ColumnDef<User>[]>(() => {
    const base: ColumnDef<User>[] = [
      { header: "Логин", accessorKey: "username" },
      { header: "Роль", accessorKey: "role" },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удален" : "Активен"}</span>
        )
      }
    ];

    if (canWrite) {
      base.push({
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() => {
                setEditUser(row.original);
                setUsername(row.original.username);
                setRole(row.original.role);
                setPassword("");
                setDialogOpen(true);
              }}
            >
              Изменить
            </Button>
            <Button
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
              onClick={() =>
                row.original.is_deleted
                  ? restoreMutation.mutate(row.original.id)
                  : deleteMutation.mutate(row.original.id)
              }
            >
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </Button>
          </Box>
        )
      });
    }

    return base;
  }, [canWrite, deleteMutation, restoreMutation]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Пользователи</Typography>
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

            <FormControl fullWidth>
              <InputLabel>Роль</InputLabel>
              <Select
                label="Роль"
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value as User["role"] | "");
                  setPage(1);
                }}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="engineer">engineer</MenuItem>
                <MenuItem value="viewer">viewer</MenuItem>
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
              label="Показывать удаленных"
            />
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setEditUser(null);
                  resetForm();
                  setDialogOpen(true);
                }}
              >
                Добавить
              </Button>
            )}
          </Box>

          <DataTable data={usersQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            count={usersQuery.data?.total || 0}
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
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{editUser ? "Изменить пользователя" : "Новый пользователь"}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              label="Логин"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={Boolean(editUser)}
              fullWidth
            />
            <TextField
              label="Пароль"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Роль</InputLabel>
              <Select label="Роль" value={role} onChange={(event) => setRole(event.target.value as User["role"])}>
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="engineer">engineer</MenuItem>
                <MenuItem value="viewer">viewer</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              variant="contained"
              onClick={() => {
                if (editUser) {
                  updateMutation.mutate({
                    id: editUser.id,
                    payload: {
                      role,
                      password: password || undefined
                    }
                  });
                } else {
                  createMutation.mutate({ username, password, role });
                }
                setDialogOpen(false);
              }}
            >
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
