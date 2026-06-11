import { apiFetch } from "./client";

export type Pagination<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function listEntity<T>(path: string, params: Record<string, any>) {
  const { filters, ...rest } = params;
  const qs = buildQuery({ ...rest, ...(filters || {}) });
  const collectionPath = path.endsWith("/") ? path : `${path}/`;
  return apiFetch<Pagination<T>>(`${collectionPath}${qs}`);
}

export async function createEntity<T>(path: string, payload: any) {
  const collectionPath = path.endsWith("/") ? path : `${path}/`;
  return apiFetch<T>(collectionPath, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateEntity<T>(path: string, id: number, payload: any) {
  return apiFetch<T>(`${path}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteEntity(path: string, id: number) {
  return apiFetch<void>(`${path}/${id}`, { method: "DELETE" });
}

export async function restoreEntity(path: string, id: number) {
  return apiFetch<void>(`${path}/${id}/restore`, { method: "POST" });
}
