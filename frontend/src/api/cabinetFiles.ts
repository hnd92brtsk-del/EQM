import { apiFetch, getApiUrl, getToken } from "./client";

export type CabinetFile = {
  id: number;
  cabinet_id: number;
  original_name: string;
  ext: string;
  size_bytes: number;
  mime: string;
  created_at: string;
  created_by_id: number;
};

export function listCabinetFiles(cabinetId: number) {
  return apiFetch<CabinetFile[]>(`/cabinets/${cabinetId}/files`);
}

export async function uploadCabinetFile(cabinetId: number, file: File) {
  const form = new FormData();
  form.append("file", file);

  const token = getToken();
  const response = await fetch(getApiUrl(`/cabinets/${cabinetId}/files`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Upload failed");
  }
  return response.json() as Promise<CabinetFile>;
}

export async function downloadCabinetFile(fileId: number) {
  const token = getToken();
  const response = await fetch(getApiUrl(`/cabinet-files/${fileId}/download`), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Download failed");
  }
  return response.blob();
}

export function deleteCabinetFile(fileId: number) {
  return apiFetch<void>(`/cabinet-files/${fileId}`, { method: "DELETE" });
}
