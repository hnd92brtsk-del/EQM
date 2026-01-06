import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
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

type UserOption = { id: number; username: string };

const pageSizeOptions = [10, 20, 50, 100];
const sortOptions = [
  { value: "last_name", label: "Last name (A-Z)" },
  { value: "-last_name", label: "Last name (Z-A)" },
  { value: "hire_date", label: "Hire date (oldest)" },
  { value: "-hire_date", label: "Hire date (newest)" }
];

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
      setErrorMessage(personnelQuery.error instanceof Error ? personnelQuery.error.message : "Failed to load personnel.");
    }
  }, [personnelQuery.error]);

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
      setErrorMessage(error instanceof Error ? error.message : "Failed to create personnel.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Personnel> }) =>
      updatePersonnel(id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to update personnel.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePersonnel(id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete personnel.")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restorePersonnel(id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Failed to restore personnel.")
  });

  const columns = useMemo<ColumnDef<Personnel>[]>(() => {
    const base: ColumnDef<Personnel>[] = [
      {
        header: "Full name",
        cell: ({ row }) => (
          <Button size="small" onClick={() => navigate(`/personnel/${row.original.id}`)}>
            {[row.original.last_name, row.original.first_name, row.original.middle_name]
              .filter(Boolean)
              .join(" ")}
          </Button>
        )
      },
      { header: "Position", accessorKey: "position" },
      { header: "Personnel #", accessorKey: "personnel_number" },
      {
        header: "Login",
        cell: ({ row }) => row.original.user?.username || "-"
      },
      { header: "Organisation", accessorKey: "organisation" },
      { header: "Department", accessorKey: "department" },
      {
        header: "Status",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "Deleted" : "Active"}</span>
        )
      }
    ];

    if (canWrite) {
      base.push({
        header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "Edit personnel",
                  fields: [
                    { name: "first_name", label: "First name", type: "text" },
                    { name: "last_name", label: "Last name", type: "text" },
                    { name: "middle_name", label: "Middle name", type: "text" },
                    { name: "position", label: "Position", type: "text" },
                    { name: "personnel_number", label: "Personnel #", type: "text" },
                    { name: "user_id", label: "Login", type: "select", options: userOptions }
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
              {row.original.is_deleted ? t("actions.restore") : t("actions.delete")}
            </Button>
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
              <InputLabel>Sort</InputLabel>
              <Select
                label="Sort"
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
              label="Department"
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setPage(1);
              }}
              fullWidth
            />
            <TextField
              label="Service"
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
                label="Show deleted"
              />
            )}
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: "Add personnel",
                    fields: [
                      { name: "first_name", label: "First name", type: "text" },
                      { name: "last_name", label: "Last name", type: "text" },
                      { name: "middle_name", label: "Middle name", type: "text" },
                      { name: "position", label: "Position", type: "text" },
                      { name: "personnel_number", label: "Personnel #", type: "text" },
                      { name: "user_id", label: "Login", type: "select", options: userOptions }
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
              </Button>
            )}
          </Box>

          <DataTable data={personnelQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
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
