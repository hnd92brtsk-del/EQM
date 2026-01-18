import { getApiUrl, getToken } from "./client";

export async function uploadEquipmentTypePhoto(equipmentTypeId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const response = await fetch(getApiUrl(`/equipment-types/${equipmentTypeId}/photo`), {
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
