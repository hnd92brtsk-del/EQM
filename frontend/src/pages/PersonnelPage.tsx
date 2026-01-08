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
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { listEntity } from "../api/entities";
import {
  Personnel,
  createPersonnel,
  deletePersonnel,
  listPersonnel,
  restorePersonnel,
  updatePersonnel
} from "../api/personnel";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";

type UserOption = { id: number; username: string };

const pageSizeOptions = [10, 20, 50, 100];

export default function PersonnelPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-hire_date");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: "last_name", label: t("pagesUi.personnel.sort.byLastNameAsc") },
      { value: "-last_name", label: t("pagesUi.personnel.sort.byLastNameDesc") },
      { value: "hire_date", label: t("pagesUi.personnel.sort.byHireDateOldest") },
      { value: "-hire_date", label: t("pagesUi.personnel.sort.byHireDateNewest") }
    ],
    [t]
  );

  const personnelQuery = useQuery({
    queryKey: ["personnel", page, pageSize, q, sort, departmentFilter, serviceFilter, showDeleted],
    queryFn: () =>
      listPersonnel({
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        include_deleted: showDeleted ? true : undefined,
        filters: {
          department: departmentFilter || undefined,
          service: serviceFilter || undefined
        }
      })
  });

  const usersQuery = useQuery({
    queryKey: ["personnel-users-options"],
    queryFn: () => listEntity<UserOption>("/users", { page: 1, page_size: 200, include_deleted: false })
  });

  useEffect(() => {
    if (personnelQuery.error) {
      setErrorMessage(
        personnelQuery.error instanceof Error
          ? personnelQuery.error.message
          : t("errors.load_personnel_failed")
      );
    }
  }, [personnelQuery.error, t]);

  const userOptions = useMemo(
    () =>
      usersQuery.data?.items.map((item) => ({ label: item.username, value: item.id })) || [],
    [usersQuery.data?.items]
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["personnel"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Personnel>) => createPersonnel(payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.create_personnel_failed")
      )
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Personnel> }) =>
      updatePersonnel(id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.update_personnel_failed")
      )
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePersonnel(id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.delete_personnel_failed")
      )
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restorePersonnel(id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("errors.restore_personnel_failed")
      )
  });

  const columns = useMemo<ColumnDef<Personnel>[]>(() => {
    const base: ColumnDef<Personnel>[] = [
      {
        header: t("pagesUi.personnel.columns.fullName"),
        cell: ({ row }) => (
          <AppButton size="small" onClick={() => navigate(`/personnel/${row.original.id}`)}>
            {[row.original.last_name, row.original.first_name, row.original.middle_name]
              .filter(Boolean)
              .join(" ")}
          </AppButton>
        )
      },
      { header: t("pagesUi.personnel.columns.position"), accessorKey: "position" },
      { header: t("pagesUi.personnel.columns.personnelNumber"), accessorKey: "personnel_number" },
      {
        header: t("common.fields.login"),
        cell: ({ row }) => row.original.user?.username || "-"
      },
      { header: t("pagesUi.personnel.columns.organisation"), accessorKey: "organisation" },
      { header: t("pagesUi.personnel.columns.department"), accessorKey: "department" },
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
              onClick={() =>
                setDialog({
                  open: true,
                  title: t("pagesUi.personnel.dialogs.editTitle"),
                  fields: [
                    { name: "first_name", label: t("pagesUi.personnel.fields.firstName"), type: "text" },
                    { name: "last_name", label: t("pagesUi.personnel.fields.lastName"), type: "text" },
                    { name: "middle_name", label: t("pagesUi.personnel.fields.middleName"), type: "text" },
                    { name: "position", label: t("pagesUi.personnel.fields.position"), type: "text" },
                    {
                      name: "personnel_number",
                      label: t("pagesUi.personnel.fields.personnelNumber"),
                      type: "text"
                    },
                    { name: "user_id", label: t("common.fields.login"), type: "select", options: userOptions }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      id: row.original.id,
                      payload: {
                        first_name: values.first_name,
                        last_name: values.last_name,
                        middle_name: values.middle_name || null,
                        position: values.position,
                        personnel_number: values.personnel_number || null,
                        user_id: values.user_id || null
                      }
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
  }, [canWrite, deleteMutation, navigate, restoreMutation, t, updateMutation, userOptions]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.personnel")}</Typography>

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
              <Select
                label={t("common.sort")}
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t("pagesUi.personnel.fields.department")}
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setPage(1);
              }}
              fullWidth
            />
            <TextField
              label={t("pagesUi.personnel.fields.service")}
              value={serviceFilter}
              onChange={(event) => {
                setServiceFilter(event.target.value);
                setPage(1);
              }}
              fullWidth
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {canWrite && (
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
            )}
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.personnel.dialogs.createTitle"),
                    fields: [
                      { name: "first_name", label: t("pagesUi.personnel.fields.firstName"), type: "text" },
                      { name: "last_name", label: t("pagesUi.personnel.fields.lastName"), type: "text" },
                      { name: "middle_name", label: t("pagesUi.personnel.fields.middleName"), type: "text" },
                      { name: "position", label: t("pagesUi.personnel.fields.position"), type: "text" },
                      {
                        name: "personnel_number",
                        label: t("pagesUi.personnel.fields.personnelNumber"),
                        type: "text"
                      },
                      { name: "user_id", label: t("common.fields.login"), type: "select", options: userOptions }
                    ],
                    values: {
                      first_name: "",
                      last_name: "",
                      middle_name: "",
                      position: "",
                      personnel_number: "",
                      user_id: ""
                    },
                    onSave: (values) => {
                      createMutation.mutate({
                        first_name: values.first_name,
                        last_name: values.last_name,
                        middle_name: values.middle_name || null,
                        position: values.position,
                        personnel_number: values.personnel_number || null,
                        user_id: values.user_id || null
                      });
                      setDialog(null);
                    }
                  })
                }
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable data={personnelQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
            count={personnelQuery.data?.total || 0}
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



