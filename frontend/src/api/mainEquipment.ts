import { getApiUrl, getToken } from "./client";
import { buildHttpError } from "../utils/errorMessage";

export async function uploadMainEquipmentPidSymbol(itemId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const response = await fetch(getApiUrl(`/main-equipment/${itemId}/pid-symbol`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!response.ok) {
    const message = await response.text();
    throw buildHttpError({
      status: response.status,
      statusText: response.statusText || "Upload failed",
      body: message,
      fallbackMessage: "Upload failed"
    });
  }
  return response.json();
}

export async function deleteMainEquipmentPidSymbol(itemId: number) {
  const token = getToken();
  const response = await fetch(getApiUrl(`/main-equipment/${itemId}/pid-symbol`), {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    const message = await response.text();
    throw buildHttpError({
      status: response.status,
      statusText: response.statusText || "Delete failed",
      body: message,
      fallbackMessage: "Delete failed"
    });
  }
  return response.json();
}
