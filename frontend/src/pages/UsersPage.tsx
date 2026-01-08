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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { AppButton } from "../components/ui/AppButton";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { getTablePaginationProps } from "../components/tablePaginationI18n";

const pageSizeOptions = [10, 20, 50, 100];

type User = {
  id: number;
  username: string;
  role: "admin" | "engineer" | "viewer";
  is_deleted: boolean;
};

export default function UsersPage() {
  const { t, i18n } = useTranslation();
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

  const sortOptions = useMemo(
    () => [
      { value: "username", label: t("pagesUi.users.sort.byUsernameAsc") },
      { value: "-username", label: t("pagesUi.users.sort.byUsernameDesc") },
      { value: "role", label: t("pagesUi.users.sort.byRoleAsc") },
      { value: "-role", label: t("pagesUi.users.sort.byRoleDesc") },
      { value: "created_at", label: t("pagesUi.users.sort.byCreatedOldest") },
      { value: "-created_at", label: t("pagesUi.users.sort.byCreatedNewest") }
    ],
    [t]
  );

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
          : t("pagesUi.users.errors.load")
      );
    }
  }, [usersQuery.error, t]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => createEntity("/users", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.users.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateEntity("/users", id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.users.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/users", id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.users.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/users", id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.users.errors.restore"))
  });

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setRole("engineer");
  };

  const columns = useMemo<ColumnDef<User>[]>(() => {
    const base: ColumnDef<User>[] = [
      { header: t("common.fields.login"), accessorKey: "username" },
      {
        header: t("common.fields.role"),
        accessorKey: "role",
        cell: ({ row }) => t(`roles.${row.original.role}`)
      },
      {
        header: t("common.status.label"),
        cell: ({ row }) => (
          <span className="status-pill">
            {row.original.is_deleted ? t("common.status.deleted") : t("common.status.active")}
          </span>
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
              onClick={() => {
                setEditUser(row.original);
                setUsername(row.original.username);
                setRole(row.original.role);
                setPassword("");
                setDialogOpen(true);
              }}
            >
              {t("actions.edit")}
            </AppButton>
            <AppButton
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
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
  }, [canWrite, deleteMutation, restoreMutation, t, i18n.language]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.users")}</Typography>
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
              <InputLabel>{t("common.fields.role")}</InputLabel>
              <Select
                label={t("common.fields.role")}
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value as User["role"] | "");
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                <MenuItem value="admin">{t("roles.admin")}</MenuItem>
                <MenuItem value="engineer">{t("roles.engineer")}</MenuItem>
                <MenuItem value="viewer">{t("roles.viewer")}</MenuItem>
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
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setEditUser(null);
                  resetForm();
                  setDialogOpen(true);
                }}
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable data={usersQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
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
          <DialogTitle>{editUser ? t("actions.edit") : t("actions.add")}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              label={t("common.fields.login")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={Boolean(editUser)}
              fullWidth
            />
            <TextField
              label={t("common.fields.password")}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>{t("common.fields.role")}</InputLabel>
              <Select
                label={t("common.fields.role")}
                value={role}
                onChange={(event) => setRole(event.target.value as User["role"])}
              >
                <MenuItem value="admin">{t("roles.admin")}</MenuItem>
                <MenuItem value="engineer">{t("roles.engineer")}</MenuItem>
                <MenuItem value="viewer">{t("roles.viewer")}</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <AppButton variant="text" onClick={() => setDialogOpen(false)}>
              {t("actions.cancel")}
            </AppButton>
            <AppButton
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
              {t("actions.save")}
            </AppButton>
          </DialogActions>
        </Dialog>
      )}
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}



