import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";

import { type ColumnMeta, DataTable, type DataTableFiltersState } from "../components/DataTable";
import { EntityDialog, DialogState } from "../components/EntityDialog";
import { EntityImportExportIconActions } from "../components/EntityImportExportIconActions";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import { createEntity, deleteEntity, listEntity, restoreEntity, updateEntity } from "../api/entities";
import {
  deleteCabinetDatasheet,
  deleteCabinetPhoto,
  getCabinetPhotoUploadErrorMessage,
  uploadCabinetDatasheet,
  uploadCabinetPhoto
} from "../api/cabinetMedia";
import { syncDigitalTwinFromOperation } from "../api/digitalTwins";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { AppButton } from "../components/ui/AppButton";
import { getTablePaginationProps } from "../components/tablePaginationI18n";
import { buildLocationLookups, fetchLocationsTree } from "../utils/locations";
import { ProtectedImage } from "../components/ProtectedImage";
import { ProtectedDownloadLink } from "../components/ProtectedDownloadLink";

type Cabinet = {
  id: number;
  name: string;
  factory_number?: string | null;
  nomenclature_number?: string | null;
  location_id?: number | null;
  location_full_path?: string | null;
  photo_url?: string | null;
  datasheet_url?: string | null;
  datasheet_name?: string | null;
  is_deleted: boolean;
  created_at?: string;
};

const pageSizeOptions = [10, 20, 50, 100];
const photoExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const datasheetExtensions = [".pdf", ".xlsx", ".doc", ".docx"];

const getFileIcon = (ext: string) => {
  switch (ext.toLowerCase()) {
    case "pdf":
      return <PictureAsPdfOutlinedIcon fontSize="small" />;
    case "xlsx":
      return <TableChartOutlinedIcon fontSize="small" />;
    case "doc":
    case "docx":
      return <ArticleOutlinedIcon fontSize="small" />;
    case "vsdx":
      return <AccountTreeOutlinedIcon fontSize="small" />;
    default:
      return <InsertDriveFileOutlinedIcon fontSize="small" />;
  }
};

function CabinetMediaSection({
  cabinet,
  pendingPhoto,
  pendingDatasheet,
  onPickPhoto,
  onPickDatasheet,
  onDeletePhoto,
  onDeleteDatasheet,
  onError
}: {
  cabinet?: Cabinet | null;
  pendingPhoto: File | null;
  pendingDatasheet: File | null;
  onPickPhoto: (file: File | null, cabinet?: Cabinet | null) => Promise<void> | void;
  onPickDatasheet: (file: File | null, cabinet?: Cabinet | null) => Promise<void> | void;
  onDeletePhoto: () => void;
  onDeleteDatasheet: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [photoUploading, setPhotoUploading] = useState(false);
  const [datasheetUploading, setDatasheetUploading] = useState(false);
  const photoDeleteMutation = useMutation({
    mutationFn: () => deleteCabinetPhoto(cabinet?.id as number),
    onError: (error) =>
      onError(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.photoDelete"))
  });
  const datasheetDeleteMutation = useMutation({
    mutationFn: () => deleteCabinetDatasheet(cabinet?.id as number),
    onError: (error) =>
      onError(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.datasheetDelete"))
  });

  const handlePickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) {
      onPickPhoto(null, cabinet);
      return;
    }
    setPhotoUploading(true);
    try {
      await onPickPhoto(file, cabinet);
    } catch (error) {
      onError(getCabinetPhotoUploadErrorMessage(error, t));
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePickDatasheet = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) {
      onPickDatasheet(null, cabinet);
      return;
    }
    setDatasheetUploading(true);
    try {
      await onPickDatasheet(file, cabinet);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : t("pagesUi.cabinets.errors.datasheetUpload")
      );
    } finally {
      setDatasheetUploading(false);
    }
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography variant="subtitle2">{t("common.fields.photo")}</Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <AppButton
            component="label"
            variant="outlined"
            startIcon={<UploadFileRoundedIcon />}
            disabled={photoUploading}
          >
            {photoUploading
              ? t("pagesUi.cabinets.hints.compressingPhoto")
              : t("pagesUi.cabinets.actions.uploadPhoto")}
            <input
              hidden
              type="file"
              accept={photoExtensions.join(",")}
              onChange={handlePickPhoto}
            />
          </AppButton>
          {(pendingPhoto || (cabinet?.id && cabinet.photo_url)) ? (
            <AppButton
              color="error"
              variant="outlined"
              onClick={() => {
                onPickPhoto(null, cabinet);
                if (cabinet?.id && cabinet.photo_url) {
                  photoDeleteMutation.mutate();
                }
                onDeletePhoto();
              }}
              disabled={photoDeleteMutation.isPending || photoUploading}
            >
              {t("actions.delete")}
            </AppButton>
          ) : null}
          {!cabinet?.id ? (
            <Typography variant="body2" color="text.secondary">
              {t("pagesUi.cabinets.hints.saveBeforeUpload")}
            </Typography>
          ) : null}
        </Box>
        {pendingPhoto?.name ? (
          <Typography variant="caption" color="text.secondary">
            {pendingPhoto.name}
          </Typography>
        ) : null}
        <ProtectedImage
          url={pendingPhoto ? null : cabinet?.photo_url || null}
          alt={cabinet?.name || t("common.fields.photo")}
          width={180}
          height={140}
          previewOnHover={true}
          fallback={
            <Typography variant="body2" color="text.secondary">
              {t("pagesUi.cabinets.placeholders.noPhoto")}
            </Typography>
          }
        />
      </Box>
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography variant="subtitle2">{t("common.fields.datasheet")}</Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <AppButton
            component="label"
            variant="outlined"
            startIcon={<UploadFileRoundedIcon />}
            disabled={datasheetUploading}
          >
            {t("pagesUi.cabinets.actions.uploadDatasheet")}
            <input
              hidden
              type="file"
              accept={datasheetExtensions.join(",")}
              onChange={handlePickDatasheet}
            />
          </AppButton>
          {(pendingDatasheet || (cabinet?.id && cabinet.datasheet_url)) ? (
            <AppButton
              color="error"
              variant="outlined"
              onClick={() => {
                onPickDatasheet(null, cabinet);
                if (cabinet?.id && cabinet.datasheet_url) {
                  datasheetDeleteMutation.mutate();
                }
                onDeleteDatasheet();
              }}
              disabled={datasheetDeleteMutation.isPending || datasheetUploading}
            >
              {t("actions.delete")}
            </AppButton>
          ) : null}
        </Box>
        {pendingDatasheet?.name || cabinet?.datasheet_name ? (
          <Typography variant="caption" color="text.secondary">
            {pendingDatasheet?.name || cabinet?.datasheet_name}
          </Typography>
        ) : null}
        {pendingDatasheet ? (
          <Typography variant="body2" color="text.secondary">
            {pendingDatasheet.name}
          </Typography>
        ) : cabinet?.datasheet_url ? (
          <ProtectedDownloadLink
            url={cabinet.datasheet_url}
            filename={cabinet.datasheet_name}
            icon={getFileIcon(cabinet.datasheet_name || "")}
            label={cabinet.datasheet_name || t("actions.download")}
            variant="outlined"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("pagesUi.cabinets.placeholders.noDatasheet")}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function CabinetsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "cabinets", "write");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("-created_at");
  const [columnFilters, setColumnFilters] = useState<DataTableFiltersState>({});
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [datasheetFile, setDatasheetFile] = useState<File | null>(null);

  const generateTwinMutation = useMutation({
    mutationFn: (cabinetId: number) => syncDigitalTwinFromOperation("cabinet", cabinetId),
    onSuccess: (data) => navigate(`/cabinets/${data.source_id}/composition`),
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сгенерировать цифровой двойник")
  });

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
    queryKey: ["cabinets", page, pageSize, sort, columnFilters, showDeleted],
    queryFn: () =>
      listEntity<Cabinet>("/cabinets", {
        page,
        page_size: pageSize,
        sort: sort || undefined,
        is_deleted: showDeleted ? true : false,
        filters: {
          name: columnFilters.name || undefined,
          name_alphabet: columnFilters.name_alphabet || undefined,
          factory_number: columnFilters.factory_number || undefined,
          nomenclature_number: columnFilters.nomenclature_number || undefined,
          location_id:
            columnFilters.location_id && !Number.isNaN(Number(columnFilters.location_id))
              ? Number(columnFilters.location_id)
              : undefined
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

  const updateOpenDialogCabinetMedia = (patch: Partial<Cabinet>) => {
    setDialog((prev) =>
      prev
        ? {
            ...prev,
            values: {
              ...prev.values,
              ...patch
            }
          }
        : prev
    );
  };

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      factory_number?: string | null;
      nomenclature_number?: string | null;
      location_id?: number | null;
    }) =>
      createEntity<Cabinet>("/cabinets", payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("pagesUi.cabinets.errors.create"))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Cabinet> }) =>
      updateEntity<Cabinet>("/cabinets", id, payload),
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

  const saveCabinet = async (
    values: Record<string, unknown>,
    currentCabinet?: Cabinet
  ): Promise<void> => {
    const locationId =
      values.location_id === "" || values.location_id === undefined
        ? null
        : Number(values.location_id);
    const factoryNumber = values.factory_number ? String(values.factory_number).trim() : "";
    const nomenclatureNumber = values.nomenclature_number ? String(values.nomenclature_number).trim() : "";
    const payload = {
      name: String(values.name || ""),
      factory_number: factoryNumber || null,
      nomenclature_number: nomenclatureNumber || null,
      location_id: locationId
    };

    const cabinet = currentCabinet
      ? await updateMutation.mutateAsync({ id: currentCabinet.id, payload })
      : await createMutation.mutateAsync(payload);

    if (photoFile) {
      try {
        await uploadCabinetPhoto(cabinet.id, photoFile);
      } catch (error) {
        throw new Error(getCabinetPhotoUploadErrorMessage(error, t));
      }
    }
    if (datasheetFile) {
      await uploadCabinetDatasheet(cabinet.id, datasheetFile);
    }

    setPhotoFile(null);
    setDatasheetFile(null);
    refresh();
  };

  const handleDialogPhotoPick = async (file: File | null, currentCabinet?: Cabinet | null) => {
    if (!file) {
      setPhotoFile(null);
      return;
    }
    if (!currentCabinet?.id) {
      setPhotoFile(file);
      return;
    }
    try {
      const updatedCabinet = await uploadCabinetPhoto(currentCabinet.id, file);
      setPhotoFile(null);
      updateOpenDialogCabinetMedia({
        photo_url: updatedCabinet.photo_url ?? `/cabinets/${currentCabinet.id}/photo`
      });
      refresh();
    } catch (error) {
      const message = getCabinetPhotoUploadErrorMessage(error, t);
      setErrorMessage(message);
      throw new Error(message);
    }
  };

  const handleDialogDatasheetPick = async (file: File | null, currentCabinet?: Cabinet | null) => {
    if (!file) {
      setDatasheetFile(null);
      return;
    }
    if (!currentCabinet?.id) {
      setDatasheetFile(file);
      return;
    }
    try {
      const updatedCabinet = await uploadCabinetDatasheet(currentCabinet.id, file);
      setDatasheetFile(null);
      updateOpenDialogCabinetMedia({
        datasheet_url: updatedCabinet.datasheet_url ?? `/cabinets/${currentCabinet.id}/datasheet`,
        datasheet_name: updatedCabinet.datasheet_name ?? file.name
      });
      refresh();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("pagesUi.cabinets.errors.datasheetUpload");
      setErrorMessage(message);
      throw new Error(message);
    }
  };

  const columns = useMemo<ColumnDef<Cabinet>[]>(() => {
    const base: ColumnDef<Cabinet>[] = [
      {
        header: t("common.fields.name"),
        accessorKey: "name",
        meta: {
          filterType: "text",
          filterKey: "name",
          alphabetFilterKey: "name_alphabet",
          filterPlaceholder: t("actions.search")
        } as ColumnMeta<Cabinet>
      },
      {
        header: t("common.fields.factoryNumber"),
        meta: {
          filterType: "text",
          filterKey: "factory_number",
          filterPlaceholder: t("common.fields.factoryNumber")
        } as ColumnMeta<Cabinet>,
        cell: ({ row }) => row.original.factory_number || "-"
      },
      {
        header: t("common.fields.nomenclatureNumber"),
        meta: {
          filterType: "text",
          filterKey: "nomenclature_number",
          filterPlaceholder: t("common.fields.nomenclatureNumber")
        } as ColumnMeta<Cabinet>,
        cell: ({ row }) => row.original.nomenclature_number || "-"
      },
      {
        header: t("common.fields.location"),
        meta: {
          filterType: "select",
          filterKey: "location_id",
          filterPlaceholder: t("common.all"),
          filterOptions: locationOptions.map((option) => ({
            label: option.label,
            value: option.value
          }))
        } as ColumnMeta<Cabinet>,
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
        header: t("common.fields.photo"),
        cell: ({ row }) => (
          <ProtectedImage
            url={row.original.photo_url || null}
            alt={row.original.name}
            width={44}
            height={44}
            previewOnHover={true}
            fallback="-"
          />
        )
      },
      {
        header: t("common.fields.datasheet"),
        cell: ({ row }) => (
          <ProtectedDownloadLink
            url={row.original.datasheet_url || null}
            filename={row.original.datasheet_name}
            icon={getFileIcon(row.original.datasheet_name || "")}
            size="small"
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
            {canWrite ? (
              <AppButton
                size="small"
                variant="outlined"
                startIcon={<AutoFixHighRoundedIcon />}
                onClick={() => generateTwinMutation.mutate(row.original.id)}
                disabled={generateTwinMutation.isPending}
              >
                Сгенерировать состав
              </AppButton>
            ) : null}
          {canWrite && (
            <>
              <AppButton
                size="small"
                startIcon={<EditRoundedIcon />}
                onClick={() =>
                  (setPhotoFile(null),
                  setDatasheetFile(null),
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
                    onSave: (values) => saveCabinet(values, row.original),
                    renderExtra: (values) => (
                      <CabinetMediaSection
                        cabinet={values as Cabinet}
                        pendingPhoto={photoFile}
                        pendingDatasheet={datasheetFile}
                        onPickPhoto={handleDialogPhotoPick}
                        onPickDatasheet={handleDialogDatasheetPick}
                        onDeletePhoto={() => {
                          setPhotoFile(null);
                          updateOpenDialogCabinetMedia({ photo_url: null });
                          refresh();
                        }}
                        onDeleteDatasheet={() => {
                          setDatasheetFile(null);
                          updateOpenDialogCabinetMedia({ datasheet_url: null, datasheet_name: null });
                          refresh();
                        }}
                        onError={(message) => setErrorMessage(message)}
                      />
                    )
                  }))
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
    createMutation,
    datasheetFile,
    deleteMutation,
    generateTwinMutation,
    locationBreadcrumbs,
    locationOptions,
    navigate,
    photoFile,
    restoreMutation,
    updateMutation,
    t,
    refresh
  ]);

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box className="page-title-block">
        <Box className="page-title-kicker">{t("menu.cabinets_group")}</Box>
        <Typography variant="h4">{t("pages.cabinets")}</Typography>
      </Box>
      <Card className="crud-panel">
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
            <EntityImportExportIconActions
              basePath="/cabinets"
              filenamePrefix="cabinets"
              exportParams={{
                include_deleted: showDeleted || undefined,
                sort: sort || undefined,
                name: columnFilters.name || undefined,
                name_alphabet: columnFilters.name_alphabet || undefined,
                factory_number: columnFilters.factory_number || undefined,
                nomenclature_number: columnFilters.nomenclature_number || undefined,
                location_id:
                  columnFilters.location_id && !Number.isNaN(Number(columnFilters.location_id))
                    ? Number(columnFilters.location_id)
                    : undefined
              }}
              canWrite={canWrite}
              onCommitted={refresh}
            />
            {canWrite && (
              <AppButton
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() =>
                  (setPhotoFile(null),
                  setDatasheetFile(null),
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
                    onSave: (values) => saveCabinet(values),
                    renderExtra: (values) => (
                      <CabinetMediaSection
                        cabinet={values as Cabinet}
                        pendingPhoto={photoFile}
                        pendingDatasheet={datasheetFile}
                        onPickPhoto={handleDialogPhotoPick}
                        onPickDatasheet={handleDialogDatasheetPick}
                        onDeletePhoto={() => setPhotoFile(null)}
                        onDeleteDatasheet={() => setDatasheetFile(null)}
                        onError={(message) => setErrorMessage(message)}
                      />
                    )
                  }))
                }
              >
                {t("actions.add")}
              </AppButton>
            )}
          </Box>

          <DataTable
            data={cabinetsQuery.data?.items || []}
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



