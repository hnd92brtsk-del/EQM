import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  TablePagination,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { DictionariesTabs } from "../components/DictionariesTabs";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import { downloadFile, importFile, type ImportReport } from "../api/importExport";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";

type Manufacturer = {
  id: number;
  name: string;
  country: string;
  is_deleted: boolean;
  created_at?: string;
};

const pageSizeOptions = [10, 20, 50, 100];

export default function ManufacturersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "engineer";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [showDeleted, setShowDeleted] = useState(false);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFileValue, setImportFileValue] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: "name", label: t("pagesUi.manufacturers.sort.byNameAsc") },
      { value: "-name", label: t("pagesUi.manufacturers.sort.byNameDesc") },
      { value: "created_at", label: t("pagesUi.manufacturers.sort.byCreatedOldest") },
      { value: "-created_at", label: t("pagesUi.manufacturers.sort.byCreatedNewest") }
    ],
    [t]
  );

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers", page, pageSize, q, sort, showDeleted, createdFrom, createdTo],
    queryFn: () =>
      listEntity<Manufacturer>("/manufacturers", {
        page,
        page_size: pageSize,
        q: q || undefined,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          created_at_from: createdFrom || undefined,
          created_at_to: createdTo || undefined
        }
      })
  });

  useEffect(() => {
    if (manufacturersQuery.error) {
      setErrorMessage(
        manufacturersQuery.error instanceof Error
          ? manufacturersQuery.error.message
          : t("pagesUi.manufacturers.errors.load")
      );
    }
  }, [manufacturersQuery.error, t]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["manufacturers"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; country: string }) => createEntity("/manufacturers", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Manufacturer> }) =>
      updateEntity("/manufacturers", id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.update"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntity("/manufacturers", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.delete"))
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreEntity("/manufacturers", id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.restore"))
  });

  const columns = useMemo<ColumnDef<Manufacturer>[]>(() => {
    const base: ColumnDef<Manufacturer>[] = [
      { header: t("common.fields.name"), accessorKey: "name" },
      { header: t("common.fields.country"), accessorKey: "country" },
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
                  title: t("pagesUi.manufacturers.dialogs.editTitle"),
                  fields: [
                    { name: "name", label: t("common.fields.name"), type: "text" },
                    { name: "country", label: t("common.fields.country"), type: "text" }
                  ],
                  values: row.original,
                  onSave: (values) => {
                    updateMutation.mutate({
                      id: row.original.id,
                      payload: { name: values.name, country: values.country }
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
          </Box>
        )
      });
    }

    return base;
  }, [canWrite, deleteMutation, restoreMutation, t, updateMutation]);

  const handleExport = async (format: "csv" | "xlsx", isDeleted: boolean) => {
    try {
      await downloadFile(
        "/manufacturers/export",
        { format, is_deleted: isDeleted },
        `manufacturers-${isDeleted ? "deleted" : "active"}.${format}`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.export"));
    }
  };

  const handleTemplate = async () => {
    try {
      await downloadFile(
        "/manufacturers/template",
        { format: "xlsx" },
        "manufacturers-template.xlsx"
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.template"));
    }
  };

  const handleImport = async () => {
    if (!importFileValue) {
      setErrorMessage(t("pagesUi.manufacturers.errors.importNoFile"));
      return;
    }

    try {
      const result = await importFile("/manufacturers/import", importFileValue, {
        dry_run: dryRun
      });
      setReport(result);
      setReportOpen(true);
      setSuccessMessage(
        dryRun
          ? t("pagesUi.manufacturers.import.dryRunSuccess")
          : t("pagesUi.manufacturers.import.success")
      );
      if (!dryRun) {
        refresh();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.manufacturers.errors.import"));
    }
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">{t("pagesUi.manufacturers.title")}</Typography>
      <DictionariesTabs />

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

            <TextField
              label={t("common.createdFrom")}
              type="date"
              value={createdFrom}
              onChange={(event) => {
                setCreatedFrom(event.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label={t("common.createdTo")}
              type="date"
              value={createdTo}
              onChange={(event) => {
                setCreatedTo(event.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
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
            <Stack
              direction="row"
              spacing={1}
              divider={<Divider orientation="vertical" flexItem />}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Tooltip title={t("actions.downloadTemplate")}>
                  <IconButton
                    aria-label={t("actions.downloadTemplate")}
                    onClick={handleTemplate}
                    size="small"
                  >
                    <DescriptionOutlinedIcon />
                  </IconButton>
                </Tooltip>
                {canWrite && (
                  <Tooltip title={t("actions.import")}>
                    <IconButton
                      aria-label={t("actions.import")}
                      onClick={() => setImportDialogOpen(true)}
                      size="small"
                    >
                      <FileUploadOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Tooltip title={t("actions.exportActiveCsv")}>
                  <IconButton
                    aria-label={t("actions.exportActiveCsv")}
                    onClick={() => handleExport("csv", false)}
                    size="small"
                    color="success"
                  >
                    <DownloadOutlinedIcon />
                  </IconButton>
                </Tooltip>
                <Chip size="small" label="CSV" />
                <Tooltip title={t("actions.exportActiveXlsx")}>
                  <IconButton
                    aria-label={t("actions.exportActiveXlsx")}
                    onClick={() => handleExport("xlsx", false)}
                    size="small"
                    color="success"
                  >
                    <DownloadOutlinedIcon />
                  </IconButton>
                </Tooltip>
                <Chip size="small" label="XLSX" />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Tooltip title={t("actions.exportDeletedCsv")}>
                  <IconButton
                    aria-label={t("actions.exportDeletedCsv")}
                    onClick={() => handleExport("csv", true)}
                    size="small"
                    color="error"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                    <DownloadOutlinedIcon />
                  </IconButton>
                </Tooltip>
                <Chip size="small" label="CSV" color="error" variant="outlined" />
                <Tooltip title={t("actions.exportDeletedXlsx")}>
                  <IconButton
                    aria-label={t("actions.exportDeletedXlsx")}
                    onClick={() => handleExport("xlsx", true)}
                    size="small"
                    color="error"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                    <DownloadOutlinedIcon />
                  </IconButton>
                </Tooltip>
                <Chip size="small" label="XLSX" color="error" variant="outlined" />
              </Stack>
            </Stack>
            {canWrite && (
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  setDialog({
                    open: true,
                    title: t("pagesUi.manufacturers.dialogs.createTitle"),
                    fields: [
                      { name: "name", label: t("common.fields.name"), type: "text" },
                      { name: "country", label: t("common.fields.country"), type: "text" }
                    ],
                    values: { name: "", country: "" },
                    onSave: (values) => {
                      createMutation.mutate({ name: values.name, country: values.country });
                      setDialog(null);
                    }
                  })
                }
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable data={manufacturersQuery.data?.items || []} columns={columns} />
          <TablePagination
            component="div"
            {...getTablePaginationProps(t)}
            count={manufacturersQuery.data?.total || 0}
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
      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert onClose={() => setSuccessMessage(null)} severity="success" sx={{ width: "100%" }}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("pagesUi.manufacturers.import.title")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setImportFileValue(file);
            }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={dryRun}
                onChange={(event) => setDryRun(event.target.checked)}
              />
            }
            label={t("pagesUi.manufacturers.import.dryRun")}
          />
        </DialogContent>
        <DialogActions>
          <AppButton variant="text" onClick={() => setImportDialogOpen(false)}>
            {t("actions.cancel")}
          </AppButton>
          <AppButton
            variant="contained"
            onClick={() => {
              handleImport();
              setImportDialogOpen(false);
            }}
            disabled={!importFileValue}
          >
            {t("pagesUi.manufacturers.import.submit")}
          </AppButton>
        </DialogActions>
      </Dialog>

      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("pagesUi.manufacturers.import.reportTitle")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 1.5 }}>
          {report && (
            <>
              <Typography>
                {t("pagesUi.manufacturers.import.reportSummary", {
                  total: report.total_rows,
                  created: report.created,
                  skipped: report.skipped_duplicates
                })}
              </Typography>
              {report.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2">{t("pagesUi.manufacturers.import.errors")}</Typography>
                  <Box component="ul" sx={{ pl: 2 }}>
                    {report.errors.map((item, index) => (
                      <li key={`error-${index}`}>
                        {t("pagesUi.manufacturers.import.issue", {
                          row: item.row ?? "-",
                          field: item.field ?? "-",
                          message: item.message
                        })}
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
              {report.warnings.length > 0 && (
                <Box>
                  <Typography variant="subtitle2">{t("pagesUi.manufacturers.import.warnings")}</Typography>
                  <Box component="ul" sx={{ pl: 2 }}>
                    {report.warnings.map((item, index) => (
                      <li key={`warning-${index}`}>
                        {t("pagesUi.manufacturers.import.issue", {
                          row: item.row ?? "-",
                          field: item.field ?? "-",
                          message: item.message
                        })}
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <AppButton variant="contained" onClick={() => setReportOpen(false)}>
            {t("actions.close")}
          </AppButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}



