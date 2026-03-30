import { getApiUrl, getToken } from "./client";

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
    throw new Error(message || "Upload failed");
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
    throw new Error(message || "Delete failed");
  }
  return response.json();
}
