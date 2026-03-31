import { type ReactNode, useRef, useState } from "react";
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { useTranslation } from "react-i18next";

import { downloadFile, importFile, type ImportReport } from "../api/importExport";
import { ErrorSnackbar } from "./ErrorSnackbar";
import { AppButton } from "./ui/AppButton";

type FileFormat = "csv" | "xlsx";

type QueryParams = Record<string, string | number | boolean | undefined | null>;

type EntityImportExportIconActionsProps = {
  basePath: string;
  filenamePrefix: string;
  exportParams?: QueryParams;
  importParams?: QueryParams;
  canWrite?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onCommitted?: () => void;
  size?: "small" | "medium";
};

type ImportPreview = {
  file: File;
  format: FileFormat;
  report: ImportReport;
};

export function EntityImportExportIconActions({
  basePath,
  filenamePrefix,
  exportParams,
  importParams,
  canWrite = true,
  disabled = false,
  disabledReason,
  onCommitted,
  size = "small"
}: EntityImportExportIconActionsProps) {
  const { i18n } = useTranslation();
  const isRu = i18n.language.startsWith("ru");
  const labels = {
    template: isRu ? "Скачать шаблон" : "Download template",
    importExcel: isRu ? "Импорт Excel" : "Import Excel",
    exportExcel: isRu ? "Экспорт Excel" : "Export Excel",
    importCsv: isRu ? "Импорт CSV" : "Import CSV",
    exportCsv: isRu ? "Экспорт CSV" : "Export CSV",
    reviewTitle: isRu ? "Проверка импорта" : "Import review",
    dryRunOk: isRu ? "Файл проверен. Можно подтвердить импорт." : "The file was validated. You can confirm the import.",
    dryRunHasErrors: isRu ? "Найдены ошибки. Исправьте файл и попробуйте снова." : "Errors were found. Fix the file and try again.",
    summary: isRu ? "Сводка" : "Summary",
    totalRows: isRu ? "Строк обработано" : "Rows processed",
    created: isRu ? "Будет создано" : "Will be created",
    updated: isRu ? "Будет обновлено" : "Will be updated",
    skipped: isRu ? "Пропущено как дубликаты" : "Skipped as duplicates",
    errors: isRu ? "Ошибки" : "Errors",
    warnings: isRu ? "Предупреждения" : "Warnings",
    cancel: isRu ? "Отмена" : "Cancel",
    confirm: isRu ? "Подтвердить импорт" : "Confirm import",
    confirmDisabled: isRu ? "Импорт недоступен" : "Import is unavailable",
    importFailed: isRu ? "Не удалось импортировать файл" : "Failed to import file",
    downloadFailed: isRu ? "Не удалось скачать файл" : "Failed to download file"
  };

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const makeFilename = (format: FileFormat) => `${filenamePrefix}.${format}`;
  const templateFilename = `${filenamePrefix}-template.xlsx`;

  const runDownload = async (format: FileFormat) => {
    try {
      await downloadFile(`${basePath}/export`, { format, ...(exportParams || {}) }, makeFilename(format));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : labels.downloadFailed);
    }
  };

  const runTemplateDownload = async () => {
    try {
      await downloadFile(`${basePath}/template`, { format: "xlsx", ...(importParams || {}) }, templateFilename);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : labels.downloadFailed);
    }
  };

  const handleImportSelection = async (format: FileFormat, file: File | null) => {
    if (!file) {
      return;
    }
    try {
      const report = await importFile(`${basePath}/import`, file, {
        format,
        dry_run: true,
        ...(importParams || {})
      });
      setPreview({ file, format, report });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : labels.importFailed);
    } finally {
      if (format === "xlsx" && excelInputRef.current) {
        excelInputRef.current.value = "";
      }
      if (format === "csv" && csvInputRef.current) {
        csvInputRef.current.value = "";
      }
    }
  };

  const commitImport = async () => {
    if (!preview) {
      return;
    }
    setIsSubmitting(true);
    try {
      await importFile(`${basePath}/import`, preview.file, {
        format: preview.format,
        dry_run: false,
        ...(importParams || {})
      });
      setPreview(null);
      onCommitted?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : labels.importFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderIconAction = ({
    tooltip,
    icon,
    onClick,
    actionDisabled
  }: {
    tooltip: string;
    icon: ReactNode;
    onClick: () => void;
    actionDisabled: boolean;
  }) => (
    <Tooltip title={actionDisabled && disabledReason ? disabledReason : tooltip}>
      <span>
        <IconButton size={size} onClick={onClick} disabled={actionDisabled}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <>
      <Stack direction="row" spacing={0.5} alignItems="center">
        {renderIconAction({
          tooltip: labels.template,
          icon: <DescriptionOutlinedIcon fontSize={size === "small" ? "small" : "medium"} />,
          onClick: () => {
            void runTemplateDownload();
          },
          actionDisabled: disabled
        })}
        {renderIconAction({
          tooltip: labels.importExcel,
          icon: <UploadFileRoundedIcon fontSize={size === "small" ? "small" : "medium"} />,
          onClick: () => excelInputRef.current?.click(),
          actionDisabled: disabled || !canWrite
        })}
        {renderIconAction({
          tooltip: labels.exportExcel,
          icon: <DownloadRoundedIcon fontSize={size === "small" ? "small" : "medium"} />,
          onClick: () => {
            void runDownload("xlsx");
          },
          actionDisabled: disabled
        })}
        {renderIconAction({
          tooltip: labels.importCsv,
          icon: <FileUploadOutlinedIcon fontSize={size === "small" ? "small" : "medium"} />,
          onClick: () => csvInputRef.current?.click(),
          actionDisabled: disabled || !canWrite
        })}
        {renderIconAction({
          tooltip: labels.exportCsv,
          icon: <FileDownloadOutlinedIcon fontSize={size === "small" ? "small" : "medium"} />,
          onClick: () => {
            void runDownload("csv");
          },
          actionDisabled: disabled
        })}
      </Stack>

      <Box
        component="input"
        ref={excelInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        sx={{ display: "none" }}
        onChange={(event) => {
          void handleImportSelection("xlsx", event.target.files?.[0] || null);
        }}
      />
      <Box
        component="input"
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        sx={{ display: "none" }}
        onChange={(event) => {
          void handleImportSelection("csv", event.target.files?.[0] || null);
        }}
      />

      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} fullWidth maxWidth="md">
        <DialogTitle>{labels.reviewTitle}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          {preview ? (
            <>
              <Alert severity={preview.report.errors.length > 0 ? "warning" : "success"}>
                {preview.report.errors.length > 0 ? labels.dryRunHasErrors : labels.dryRunOk}
              </Alert>
              <Box sx={{ display: "grid", gap: 0.5 }}>
                <Typography variant="subtitle2">{labels.summary}</Typography>
                <Typography variant="body2">{`${labels.totalRows}: ${preview.report.total_rows}`}</Typography>
                <Typography variant="body2">{`${labels.created}: ${preview.report.created}`}</Typography>
                <Typography variant="body2">{`${labels.updated}: ${preview.report.updated ?? 0}`}</Typography>
                <Typography variant="body2">{`${labels.skipped}: ${preview.report.skipped_duplicates}`}</Typography>
              </Box>
              <Box sx={{ display: "grid", gap: 1 }}>
                <Typography variant="subtitle2">{labels.errors}</Typography>
                {preview.report.errors.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    0
                  </Typography>
                ) : (
                  preview.report.errors.map((item, index) => (
                    <Alert key={`error-${index}`} severity="error">
                      {`${item.row ? `#${item.row} ` : ""}${item.field ? `${item.field}: ` : ""}${item.message}`}
                    </Alert>
                  ))
                )}
              </Box>
              <Box sx={{ display: "grid", gap: 1 }}>
                <Typography variant="subtitle2">{labels.warnings}</Typography>
                {preview.report.warnings.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    0
                  </Typography>
                ) : (
                  preview.report.warnings.map((item, index) => (
                    <Alert key={`warning-${index}`} severity="warning">
                      {`${item.row ? `#${item.row} ` : ""}${item.field ? `${item.field}: ` : ""}${item.message}`}
                    </Alert>
                  ))
                )}
              </Box>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <AppButton variant="text" onClick={() => setPreview(null)}>
            {labels.cancel}
          </AppButton>
          <AppButton
            variant="contained"
            onClick={() => {
              void commitImport();
            }}
            disabled={!preview || preview.report.errors.length > 0 || isSubmitting}
          >
            {labels.confirm}
          </AppButton>
        </DialogActions>
      </Dialog>

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </>
  );
}
