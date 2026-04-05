import { apiFetch, getApiUrl, getToken } from "./client";
import { CabinetPhotoCompressionError, compressCabinetPhotoForUpload } from "./cabinetPhotoCompression";

type CabinetMediaUploadError = Error & {
  status?: number;
  detail?: string;
};

async function uploadCabinetMedia(cabinetId: number, path: "photo" | "datasheet", file: File) {
  const uploadFile = path === "photo" ? await compressCabinetPhotoForUpload(file) : file;
  const form = new FormData();
  form.append("file", uploadFile);

  const token = getToken();
  const response = await fetch(getApiUrl(`/cabinets/${cabinetId}/${path}`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!response.ok) {
    let message = "Upload failed";
    try {
      const payload = await response.json();
      if (typeof payload?.detail === "string" && payload.detail.trim()) {
        message = payload.detail;
      } else if (typeof payload?.message === "string" && payload.message.trim()) {
        message = payload.message;
      }
    } catch {
      const text = await response.text();
      if (text.trim()) {
        message = text;
      }
    }
    const error = new Error(message) as CabinetMediaUploadError;
    error.status = response.status;
    error.detail = message;
    throw error;
  }
  return response.json();
}

export function uploadCabinetPhoto(cabinetId: number, file: File) {
  return uploadCabinetMedia(cabinetId, "photo", file);
}

export function uploadCabinetDatasheet(cabinetId: number, file: File) {
  return uploadCabinetMedia(cabinetId, "datasheet", file);
}

export function deleteCabinetPhoto(cabinetId: number) {
  return apiFetch(`/cabinets/${cabinetId}/photo`, { method: "DELETE" });
}

export function deleteCabinetDatasheet(cabinetId: number) {
  return apiFetch(`/cabinets/${cabinetId}/datasheet`, { method: "DELETE" });
}

export function getCabinetPhotoUploadErrorMessage(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (error instanceof CabinetPhotoCompressionError) {
    if (error.reason === "compress_failed") {
      return t("pagesUi.cabinets.errors.photoCompressionFailed");
    }
    return t("pagesUi.cabinets.errors.photoTooLargeAfterCompression");
  }

  const uploadError = error as CabinetMediaUploadError | null;
  if (uploadError?.status === 413) {
    return t("pagesUi.cabinets.errors.photoTooLargeLimit", { size: "2 MB" });
  }

  return error instanceof Error ? error.message : t("pagesUi.cabinets.errors.photoUpload");
}
