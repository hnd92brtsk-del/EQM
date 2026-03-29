import { useEffect, useMemo, useState } from "react";
import {
  Box,
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
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../api/client";
import { type ColumnMeta, DataTable, type DataTableFiltersState } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { SearchableSelectField } from "../components/SearchableSelectField";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { AppButton } from "../components/ui/AppButton";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

const pageSizeOptions = [10, 20, 50, 100];

type User = {
  id: number;
  username: string;
  role: string;
  is_deleted: boolean;
};

type RoleDefinition = {
  key: string;
  label: string;
  is_system: boolean;
};

type RoleMatrix = {
  roles: RoleDefinition[];
};

export default function UsersPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "admin_users", "admin");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("-created_at");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
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
    queryKey: ["users", page, pageSize, sort, columnFilters, showDeleted],
    queryFn: () =>
      listEntity<User>("/users", {
        page,
        page_size: pageSize,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          username: columnFilters.username || undefined,
          username_alphabet: columnFilters.username_alphabet || undefined,
          role: columnFilters.role || undefined
        }
      })
  });

  const rolesQuery = useQuery({
    queryKey: ["role-permissions", "roles"],
    queryFn: () => apiFetch<RoleMatrix>("/admin/role-permissions")
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

  const roleOptions = useMemo(
    () =>
      (rolesQuery.data?.roles ?? []).map((item) => ({
        value: item.key,
        label: t(`roles.${item.key}`, { defaultValue: item.label })
      })),
    [rolesQuery.data?.roles, t]
  );

  const roleLabelMap = useMemo(
    () => Object.fromEntries(roleOptions.map((item) => [item.value, item.label])),
    [roleOptions]
  );

  useEffect(() => {
    if (!role && roleOptions.length > 0) {
      setRole(roleOptions[0].value);
    }
  }, [role, roleOptions]);

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => createEntity("/users", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.users.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: unknown }) => updateEntity("/users", id, payload),
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
    setRole(roleOptions[0]?.value ?? "");
  };

  const columns = useMemo<ColumnDef<User>[]>(() => {
    const base: ColumnDef<User>[] = [
      {
        header: t("common.fields.login"),
        accessorKey: "username",
        meta: {
          filterType: "text",
          filterKey: "username",
          alphabetFilterKey: "username_alphabet",
          filterPlaceholder: t("actions.search")
        } as ColumnMeta<User>
      },
      {
        header: t("common.fields.role"),
        accessorKey: "role",
        meta: {
          filterType: "select",
          filterKey: "role",
          filterPlaceholder: t("common.all"),
          filterOptions: roleOptions
        } as ColumnMeta<User>,
        cell: ({ row }) => roleLabelMap[row.original.role] ?? row.original.role
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
  }, [canWrite, deleteMutation, restoreMutation, t, i18n.language, roleOptions, roleLabelMap]);

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
              <Box sx={{ display: "flex", gap: 1 }}>
                <AppButton variant="outlined" onClick={() => navigate("/admin/role-permissions")}>
                  {t("pagesUi.users.rolePermissions")}
                </AppButton>
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
              </Box>
            )}
          </Box>

          <DataTable
            data={usersQuery.data?.items || []}
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
            <SearchableSelectField
              label={t("common.fields.role")}
              value={role}
              options={roleOptions}
              onChange={(nextValue) => setRole(nextValue as string)}
              emptyOptionLabel={t("actions.notSelected")}
              fullWidth
            />
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
              disabled={!role}
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
