import { apiFetch, getApiUrl, getToken } from "./client";
import { compressPhotoForUpload, getPhotoUploadErrorMessage } from "./photoCompression";
import { buildHttpError } from "../utils/errorMessage";

async function uploadCabinetMedia(cabinetId: number, path: "photo" | "datasheet", file: File) {
  const uploadFile = path === "photo" ? await compressPhotoForUpload(file) : file;
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
    throw buildHttpError({
      status: response.status,
      statusText: response.statusText || "Upload failed",
      body: message,
      fallbackMessage: "Upload failed"
    });
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
  return getPhotoUploadErrorMessage(error, t, "pagesUi.cabinets.errors");
}
