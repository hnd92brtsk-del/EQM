import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  TextField,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiFetch } from "../api/client";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { AppButton } from "../components/ui/AppButton";

type Space = { key: string; label: string; is_admin_space: boolean };
type Role = { key: string; label: string; is_system: boolean };
type PermissionRow = { role: string; space_key: string; can_read: boolean; can_write: boolean; can_admin: boolean };
type Matrix = { roles: Role[]; spaces: Space[]; permissions: PermissionRow[] };

const permissionFields = ["can_read", "can_write", "can_admin"] as const;

export default function RolePermissionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, PermissionRow>>({});
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");

  const matrixQuery = useQuery({
    queryKey: ["role-permissions"],
    queryFn: () => apiFetch<Matrix>("/admin/role-permissions")
  });

  useEffect(() => {
    if (matrixQuery.error) {
      setErrorMessage(matrixQuery.error instanceof Error ? matrixQuery.error.message : t("pagesUi.rolePermissions.errors.load"));
    }
  }, [matrixQuery.error, t]);

  const matrix = useMemo(() => {
    const source = matrixQuery.data?.permissions ?? [];
    const next: Record<string, PermissionRow> = {};
    source.forEach((item) => {
      next[`${item.role}:${item.space_key}`] = { ...item };
    });
    return Object.keys(draft).length ? { ...next, ...draft } : next;
  }, [draft, matrixQuery.data?.permissions]);

  const saveMutation = useMutation({
    mutationFn: (permissions: PermissionRow[]) =>
      apiFetch<Matrix>("/admin/role-permissions", {
        method: "PUT",
        body: JSON.stringify({ permissions })
      }),
    onSuccess: () => {
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.rolePermissions.errors.save"))
  });

  const createRoleMutation = useMutation({
    mutationFn: (payload: { key: string; label: string }) =>
      apiFetch<Role>("/admin/role-permissions/roles", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setCreateRoleOpen(false);
      setNewRoleKey("");
      setNewRoleLabel("");
      void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t("pagesUi.rolePermissions.errors.createRole"))
  });

  const getRoleLabel = (role: Role) => {
    const translated = t(`roles.${role.key}`, { defaultValue: role.label });
    return translated === `roles.${role.key}` ? role.label : translated;
  };

  const getSpaceLabel = (space: Space) => {
    const translated = t(`menu.${space.key}`, { defaultValue: space.label });
    return translated === `menu.${space.key}` ? space.label : translated;
  };

  const updatePermission = (row: PermissionRow, field: (typeof permissionFields)[number], checked: boolean) => {
    const next = { ...row, [field]: checked };
    if (field === "can_write" && checked) {
      next.can_read = true;
    }
    if (field === "can_admin" && checked) {
      next.can_read = true;
    }
    if (field === "can_read" && !checked) {
      next.can_write = false;
      next.can_admin = false;
    }
    setDraft((current) => ({ ...current, [`${row.role}:${row.space_key}`]: next }));
  };

  const handleCreateRole = () => {
    createRoleMutation.mutate({
      key: newRoleKey.trim().toLowerCase(),
      label: newRoleLabel.trim()
    });
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">{t("pagesUi.rolePermissions.title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("pagesUi.rolePermissions.subtitle")}
          </Typography>
        </Box>
        <AppButton variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateRoleOpen(true)}>
          {t("pagesUi.rolePermissions.actions.createRole")}
        </AppButton>
      </Box>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          {(matrixQuery.data?.spaces ?? []).map((space) => (
            <Box key={space.key} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 2 }}>
              <Typography variant="h6">{getSpaceLabel(space)}</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {(matrixQuery.data?.roles ?? []).map((role) => {
                  const item = matrix[`${role.key}:${space.key}`];
                  if (!item) {
                    return null;
                  }
                  return (
                    <Grid item xs={12} md={6} lg={4} key={`${role.key}:${space.key}`}>
                      <Card variant="outlined" sx={{ height: "100%" }}>
                        <CardContent sx={{ display: "grid", gap: 1 }}>
                          <Typography variant="subtitle1">{getRoleLabel(role)}</Typography>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={item.can_read}
                                onChange={(event) => updatePermission(item, "can_read", event.target.checked)}
                              />
                            }
                            label={t("pagesUi.rolePermissions.permissions.read")}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={item.can_write}
                                onChange={(event) => updatePermission(item, "can_write", event.target.checked)}
                              />
                            }
                            label={t("pagesUi.rolePermissions.permissions.write")}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={item.can_admin}
                                onChange={(event) => updatePermission(item, "can_admin", event.target.checked)}
                              />
                            }
                            label={t("pagesUi.rolePermissions.permissions.admin")}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          ))}
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <AppButton
              variant="contained"
              onClick={() => saveMutation.mutate(Object.values(matrix))}
              disabled={saveMutation.isPending || matrixQuery.isLoading}
            >
              {t("pagesUi.rolePermissions.actions.save")}
            </AppButton>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={createRoleOpen} onClose={() => setCreateRoleOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("pagesUi.rolePermissions.createRoleDialog.title")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
          <TextField
            label={t("pagesUi.rolePermissions.createRoleDialog.key")}
            value={newRoleKey}
            onChange={(event) => setNewRoleKey(event.target.value)}
            helperText={t("pagesUi.rolePermissions.createRoleDialog.keyHint")}
            fullWidth
          />
          <TextField
            label={t("pagesUi.rolePermissions.createRoleDialog.label")}
            value={newRoleLabel}
            onChange={(event) => setNewRoleLabel(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <AppButton variant="text" onClick={() => setCreateRoleOpen(false)}>
            {t("actions.cancel")}
          </AppButton>
          <AppButton
            variant="contained"
            onClick={handleCreateRole}
            disabled={createRoleMutation.isPending || !newRoleKey.trim() || !newRoleLabel.trim()}
          >
            {t("pagesUi.rolePermissions.actions.create")}
          </AppButton>
        </DialogActions>
      </Dialog>

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
