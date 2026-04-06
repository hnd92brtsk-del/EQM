import { getApiUrl, getToken } from "./client";
import { compressPhotoForUpload, getPhotoUploadErrorMessage } from "./photoCompression";

type EquipmentTypeMediaUploadError = Error & {
  status?: number;
  detail?: string;
};

export async function uploadEquipmentTypePhoto(equipmentTypeId: number, file: File) {
  const uploadFile = await compressPhotoForUpload(file);
  const form = new FormData();
  form.append("file", uploadFile);
  const token = getToken();
  const response = await fetch(getApiUrl(`/equipment-types/${equipmentTypeId}/photo`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
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
    const error = new Error(message) as EquipmentTypeMediaUploadError;
    error.status = response.status;
    error.detail = message;
    throw error;
  }
  return response.json();
}

export async function uploadEquipmentTypeDatasheet(equipmentTypeId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const response = await fetch(getApiUrl(`/equipment-types/${equipmentTypeId}/datasheet`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Upload failed");
  }
  return response.json();
}

export function getEquipmentTypePhotoUploadErrorMessage(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  return getPhotoUploadErrorMessage(error, t, "pagesUi.equipmentTypes.errors");
}
