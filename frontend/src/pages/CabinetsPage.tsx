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

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { useAuth } from "../context/AuthContext";

type Cabinet = {
  id: number;
  name: string;
  location_id?: number | null;
  is_deleted: boolean;
  created_at?: string;
};

type Location = { id: number; name: string };

const sortOptions = [
  { value: "name", label: "?? ???????? (?-?)" },
  { value: "-name", label: "?? ???????? (?-?)" },
  { value: "created_at", label: "?? ???? ???????? (??????)" },
  { value: "-created_at", label: "?? ???? ???????? (?????)" }
];

const pageSizeOptions = [10, 20, 50, 100];

export default function CabinetsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [locationFilter, setLocationFilter] = useState<number | "">("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cabinetsQuery = useQuery({
    queryKey: ["cabinets", page, pageSize, q, sort, locationFilter, showDeleted],
    queryFn: () =>
      listEntity<Cabinet>("/cabinets", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          location_id: locationFilter || undefined
        }
      })
  });

  const locationsQuery = useQuery({
    queryKey: ["locations-options"],
    queryFn: () =>
      listEntity<Location>("/locations", {
        page: 1,
        page_size: 200,
        is_deleted: false
      })
  });

  useEffect(() => {
    if (cabinetsQuery.error) {
      setErrorMessage(
        cabinetsQuery.error instanceof Error
          ? cabinetsQuery.error.message
          : "?????? ???????? ??????"
      );
    }
  }, [cabinetsQuery.error]);

  const locationMap = useMemo(() => {
    const map = new Map<number, string>();
    locationsQuery.data?.items.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [locationsQuery.data?.items]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cabinets"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; location_id?: number | null }) =>
      createEntity("/cabinets", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "?????? ???????? ?????")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Cabinet> }) =>
      updateEntity("/cabinets", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "?????? ?????????? ?????")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/cabinets", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "?????? ???????? ?????")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/cabinets", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "?????? ?????????????? ?????")
  });

  const columns = useMemo<ColumnDef<Cabinet>[]>(() => {
    const base: ColumnDef<Cabinet>[] = [
      { header: "????????", accessorKey: "name" },
      {
        header: "???????",
        cell: ({ row }) =>
          row.original.location_id
            ? locationMap.get(row.original.location_id) || row.original.location_id
            : "-"
      },
      {
        header: "??????",
        cell: ({ row }) => (
          <span className="status-pill">{row.original.is_deleted ? "???????" : "???????"}</span>
        )
      }
    ];

    if (canWrite) {
      base.push({
        header: "????????",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setDialog({
                  open: true,
                  title: "????",
                  fields: [
                    { name: "name", label: "????????", type: "text" },
                    {
                      name: "location_id",
                      label: "???????",
                      type: "select",
                      options:
                        locationsQuery.data?.items.map((loc) => ({
                          label: loc.name,
                          value: loc.id
                        })) || []
                    }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    const locationId =
                      values.location_id === "" || values.location_id === undefined
                        ? null
                        : Number(values.location_id);
                    updateMutation.mutate({
                      id: row.original.id,
                      payload: { name: values.name, location_id: locationId }
                    });
                    setDialog(null);
                  }
                })
              }
            >
              ????????
            </Button>
            <Button
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
              {row.original.is_deleted ? "????????????" : "???????"}
            </Button>
          </Box>
        )
      });
    }

    return base;
  }, [canWrite, deleteMutation, locationMap, locationsQuery.data?.items, restoreMutation, updateMutation]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">?????</Typography>
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
              label="?????"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>??????????</InputLabel>
              <Select label="??????????" value={sort} onChange={(event) => setSort(event.target.value)}>
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>???????</InputLabel>
              <Select
                label="???????"
                value={locationFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setLocationFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">???</MenuItem>
                {locationsQuery.data?.items.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
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
              label="?????????? ?????????"
            />
            <Box sx={{ flexGrow: 1 }} />
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: "????? ????",
                    fields: [
                      { name: "name", label: "????????", type: "text" },
                      {
                        name: "location_id",
                        label: "???????",
                        type: "select",
                        options:
                          locationsQuery.data?.items.map((loc) => ({
                            label: loc.name,
                            value: loc.id
                          })) || []
                      }
                    ],
                    values: { name: "", location_id: "" },
                    onSave: (values) => {
                      const locationId =
                        values.location_id === "" || values.location_id === undefined
                          ? null
                          : Number(values.location_id);
                      createMutation.mutate({ name: values.name, location_id: locationId });
                      setDialog(null);
                    }
                  })
                }
              >
                ????????
              </Button>
            )}
          </Box>

          <DataTable data={cabinetsQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            count={cabinetsQuery.data?.total || 0}
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
