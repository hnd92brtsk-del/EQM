import { useMemo, useState } from "react";
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
import { createEntity, listEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 200;

type User = {
  id: number;
  username: string;
  role: "admin" | "engineer" | "viewer";
  is_deleted: boolean;
};

export default function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<User["role"]>("engineer");

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => listEntity<User>("/users", { page: 1, page_size: PAGE_SIZE, include_deleted: true })
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => createEntity("/users", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateEntity("/users", id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] })
  });

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setRole("engineer");
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      { header: "Логин", accessorKey: "username" },
      { header: "Роль", accessorKey: "role" },
      {
        header: "Статус",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Удален" : "Активен"}</span>
        )
      },
      {
        header: "Действия",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
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
                updateMutation.mutate({ id: row.original.id, payload: { is_deleted: !row.original.is_deleted } })
              }
            >
              {row.original.is_deleted ? "Восстановить" : "Удалить"}
            </Button>
          </Box>
        )
      }
    ],
    [updateMutation]
  );

  if (user?.role !== "admin") {
    return <Typography>Недостаточно прав.</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Пользователи</Typography>
      <Card>
        <CardContent>
          <Box className="table-toolbar">
            <Typography variant="h6">Список пользователей</Typography>
            <Box sx={{ flexGrow: 1 }} />
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
          </Box>
          <DataTable data={usersQuery.data?.items || []} columns={columns} />
        </CardContent>
      </Card>

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
    </Box>
  );
}
