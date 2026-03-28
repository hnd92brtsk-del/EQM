import { useMemo, useState } from "react";
import { Box, Card, CardContent, Checkbox, FormControlLabel, Grid, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "../api/client";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { AppButton } from "../components/ui/AppButton";

type Space = { key: string; label: string; is_admin_space: boolean };
type PermissionRow = { role: "admin" | "engineer" | "viewer"; space_key: string; can_read: boolean; can_write: boolean; can_admin: boolean };
type Matrix = { spaces: Space[]; permissions: PermissionRow[] };

export default function RolePermissionsPage() {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const matrixQuery = useQuery({
    queryKey: ["role-permissions"],
    queryFn: () => apiFetch<Matrix>("/admin/role-permissions")
  });
  const [draft, setDraft] = useState<Record<string, PermissionRow>>({});

  const matrix = useMemo(() => {
    const source = matrixQuery.data?.permissions ?? [];
    const next: Record<string, PermissionRow> = {};
    source.forEach((item) => {
      next[`${item.role}:${item.space_key}`] = { ...item };
    });
    return Object.keys(draft).length ? draft : next;
  }, [draft, matrixQuery.data?.permissions]);

  const saveMutation = useMutation({
    mutationFn: (permissions: PermissionRow[]) =>
      apiFetch<Matrix>("/admin/role-permissions", {
        method: "PUT",
        body: JSON.stringify({ permissions })
      }),
    onSuccess: () => {
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить права")
  });

  const updatePermission = (row: PermissionRow, field: "can_read" | "can_write" | "can_admin", checked: boolean) => {
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

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">Матрица прав ролей</Typography>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          {(matrixQuery.data?.spaces ?? []).map((space) => (
            <Box key={space.key} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 2 }}>
              <Typography variant="h6">{space.label}</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {(["admin", "engineer", "viewer"] as const).map((role) => {
                  const item = matrix[`${role}:${space.key}`];
                  if (!item) return null;
                  return (
                    <Grid item xs={12} md={4} key={`${role}:${space.key}`}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" sx={{ textTransform: "capitalize", mb: 1 }}>{role}</Typography>
                          <FormControlLabel control={<Checkbox checked={item.can_read} onChange={(e) => updatePermission(item, "can_read", e.target.checked)} />} label="Просмотр" />
                          <FormControlLabel control={<Checkbox checked={item.can_write} onChange={(e) => updatePermission(item, "can_write", e.target.checked)} />} label="Изменение" />
                          <FormControlLabel control={<Checkbox checked={item.can_admin} onChange={(e) => updatePermission(item, "can_admin", e.target.checked)} />} label="Администрирование" />
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
              Сохранить права
            </AppButton>
          </Box>
        </CardContent>
      </Card>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}
