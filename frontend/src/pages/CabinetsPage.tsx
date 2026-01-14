import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Box,Card,
  CardContent,
  FormControl,
  FormControlLabel,
  IconButton,
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
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import {
  type CabinetFile,
  deleteCabinetFile,
  downloadCabinetFile,
  listCabinetFiles,
  uploadCabinetFile
} from "../api/cabinetFiles";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { buildLocationLookups, fetchLocationsTree } from "../utils/locations";

type Cabinet = {
  id: number;
  name: string;
  factory_number?: string | null;
  nomenclature_number?: string | null;
  location_id?: number | null;
  location_full_path?: string | null;
  is_deleted: boolean;
  created_at?: string;
};

const pageSizeOptions = [10, 20, 50, 100];

const allowedExtensions = [".pdf", ".xlsx", ".doc", ".vsdx"];

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, index);
  return `${size.toFixed(size < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
};

const getFileIcon = (ext: string) => {
  switch (ext.toLowerCase()) {
    case "pdf":
      return <PictureAsPdfOutlinedIcon fontSize="small" />;
    case "xlsx":
      return <TableChartOutlinedIcon fontSize="small" />;
    case "doc":
      return <ArticleOutlinedIcon fontSize="small" />;
    case "vsdx":
      return <AccountTreeOutlinedIcon fontSize="small" />;
    default:
      return <InsertDriveFileOutlinedIcon fontSize="small" />;
  }
};

function CabinetFilesList({
  cabinetId,
  showActions = false,
  onError
}: {
  cabinetId: number;
  showActions?: boolean;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const filesQuery = useQuery({
    queryKey: ["cabinet-files", cabinetId],
    queryFn: () => listCabinetFiles(cabinetId)
  });

  useEffect(() => {
    if (filesQuery.error) {
      onError(
        filesQuery.error instanceof Error ? filesQuery.error.message : t("pagesUi.cabinets.errors.filesLoad")
      );
    }
  }, [filesQuery.error, onError, t]);

  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => deleteCabinetFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cabinet-files", cabinetId] });
    },
    onError: (error) =>
      onError(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.fileDelete"))
  });

  const handleDownload = async (file: CabinetFile) => {
    try {
      const blob = await downloadCabinetFile(file.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.original_name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      onError(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.fileDownload"));
    }
  };

  if (filesQuery.isLoading) {
    return <Typography variant="body2">...</Typography>;
  }

  const files = filesQuery.data || [];
  if (!files.length) {
    return <Typography variant="body2">-</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      {files.map((file) => (
        <Box key={file.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {getFileIcon(file.ext)}
          <Typography variant="body2">.{file.ext}</Typography>
          <Typography variant="body2" color="text.secondary">
            {formatBytes(file.size_bytes)}
          </Typography>
          {showActions && (
            <Box sx={{ marginLeft: "auto", display: "flex", gap: 0.5 }}>
              <IconButton size="small" onClick={() => handleDownload(file)}>
                <DownloadRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() => deleteMutation.mutate(file.id)}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function CabinetFilesSection({
  cabinetId,
  onError
}: {
  cabinetId?: number;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCabinetFile(cabinetId as number, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cabinet-files", cabinetId] });
    },
    onError: (error) =>
      onError(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.fileUpload"))
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file || !cabinetId) {
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography variant="subtitle2">{t("common.fields.files")}</Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AppButton
          component="label"
          startIcon={<UploadFileRoundedIcon />}
          disabled={!cabinetId}
        >
          {t("actions.upload")}
          <input hidden type="file" accept={allowedExtensions.join(",")} onChange={handleFileChange} />
        </AppButton>
        {!cabinetId && (
          <Typography variant="body2" color="text.secondary">
            {t("pagesUi.cabinets.hints.saveBeforeUpload")}
          </Typography>
        )}
      </Box>
      {cabinetId ? (
        <CabinetFilesList cabinetId={cabinetId} showActions onError={onError} />
      ) : null}
    </Box>
  );
}

export default function CabinetsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  const sortOptions = useMemo(
    () => [
      { value: "name", label: t("pagesUi.cabinets.sort.byNameAsc") },
      { value: "-name", label: t("pagesUi.cabinets.sort.byNameDesc") },
      { value: "created_at", label: t("pagesUi.cabinets.sort.byCreatedOldest") },
      { value: "-created_at", label: t("pagesUi.cabinets.sort.byCreatedNewest") }
    ],
    [t]
  );

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

  const locationsTreeQuery = useQuery({
    queryKey: ["locations-tree-options", false],
    queryFn: () => fetchLocationsTree(false)
  });

  useEffect(() => {
    if (cabinetsQuery.error) {
      setErrorMessage(
        cabinetsQuery.error instanceof Error
          ? cabinetsQuery.error.message
          : t("pagesUi.cabinets.errors.load")
      );
    }
  }, [cabinetsQuery.error, t]);

  const { options: locationOptions, breadcrumbMap: locationBreadcrumbs } = useMemo(
    () => buildLocationLookups(locationsTreeQuery.data || []),
    [locationsTreeQuery.data]
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cabinets"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      factory_number?: string | null;
      nomenclature_number?: string | null;
      location_id?: number | null;
    }) =>
      createEntity("/cabinets", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Cabinet> }) =>
      updateEntity("/cabinets", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/cabinets", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/cabinets", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.restore"))
  });

  const columns = useMemo<ColumnDef<Cabinet>[]>(() => {
    const base: ColumnDef<Cabinet>[] = [
      { header: t("common.fields.name"), accessorKey: "name" },
      {
        header: t("common.fields.factoryNumber"),
        cell: ({ row }) => row.original.factory_number || "-"
      },
      {
        header: t("common.fields.nomenclatureNumber"),
        cell: ({ row }) => row.original.nomenclature_number || "-"
      },
      {
        header: t("common.fields.location"),
        cell: ({ row }) => {
          const fullPath = row.original.location_full_path;
          if (fullPath) {
            return fullPath;
          }
          return row.original.location_id
            ? locationBreadcrumbs.get(row.original.location_id) || row.original.location_id
            : "-";
        }
      },
      {
        header: t("common.fields.files"),
        cell: ({ row }) => (
          <CabinetFilesList
            cabinetId={row.original.id}
            onError={(message) => setErrorMessage(message)}
          />
        )
      }
    ];

    base.push({
      header: t("actions.actions"),
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <AppButton size="small" onClick={() => navigate(`/cabinets/${row.original.id}/composition`)}>
            {t("pagesUi.cabinets.actions.openComposition")}
          </AppButton>
          {canWrite && (
            <>
              <AppButton
                size="small"
                startIcon={<EditRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.cabinets.dialogs.editTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      { name: "factory_number", label: t("common.fields.factoryNumber"), type: "text" },
                      { name: "nomenclature_number", label: t("common.fields.nomenclatureNumber"), type: "text" },
                      {
                        name: "location_id",
                        label: t("common.fields.location"),
                        type: "select",
                        options: locationOptions
                      }
                    ],
                    values: row.original,
                    onSave: (values) => {
                      const locationId =
                        values.location_id === "" || values.location_id === undefined
                          ? null
                          : Number(values.location_id);
                      const factoryNumber = values.factory_number ? String(values.factory_number).trim() : "";
                      const nomenclatureNumber = values.nomenclature_number
                        ? String(values.nomenclature_number).trim()
                        : "";
                      updateMutation.mutate({
                        id: row.original.id,
                        payload: {
                          name: values.name,
                          factory_number: factoryNumber || null,
                          nomenclature_number: nomenclatureNumber || null,
                          location_id: locationId
                        }
                      });
                      setDialog(null);
                    },
                    renderExtra: () => (
                      <CabinetFilesSection
                        cabinetId={row.original.id}
                        onError={(message) => setErrorMessage(message)}
                      />
                    )
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
            </>
          )}
        </Box>
      )
    });


    return base;
  }, [
    canWrite,
    deleteMutation,
    locationBreadcrumbs,
    locationOptions,
    navigate,
    restoreMutation,
    updateMutation,
    t,
    i18n.language
  ]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pages.cabinets")}</Typography>
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
              <InputLabel>{t("common.fields.location")}</InputLabel>
              <Select
                label={t("common.fields.location")}
                value={locationFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  setLocationFilter(value === "" ? "" : Number(value));
                  setPage(1);
                }}
              >
                <MenuItem value="">{t("common.all")}</MenuItem>
                {locationOptions.map((loc) => (
                  <MenuItem key={loc.value} value={loc.value}>
                    {loc.label}
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
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.cabinets.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      { name: "factory_number", label: t("common.fields.factoryNumber"), type: "text" },
                      { name: "nomenclature_number", label: t("common.fields.nomenclatureNumber"), type: "text" },
                      {
                        name: "location_id",
                        label: t("common.fields.location"),
                        type: "select",
                        options: locationOptions
                      }
                    ],
                    values: { name: "", factory_number: "", nomenclature_number: "", location_id: "" },
                    onSave: (values) => {
                      const locationId =
                        values.location_id === "" || values.location_id === undefined
                          ? null
                          : Number(values.location_id);
                      const factoryNumber = values.factory_number ? String(values.factory_number).trim() : "";
                      const nomenclatureNumber = values.nomenclature_number
                        ? String(values.nomenclature_number).trim()
                        : "";
                      createMutation.mutate({
                        name: values.name,
                        factory_number: factoryNumber || null,
                        nomenclature_number: nomenclatureNumber || null,
                        location_id: locationId
                      });
                      setDialog(null);
                    },
                    renderExtra: () => (
                      <CabinetFilesSection onError={(message) => setErrorMessage(message)} />
                    )
                  })
                }
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable data={cabinetsQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
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



