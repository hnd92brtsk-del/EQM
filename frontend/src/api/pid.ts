import { useMemo } from "react";

import { apiFetch, getApiUrl, getToken } from "./client";
import type { PidDiagram, PidProcess } from "../types/pid";
import { buildHttpError } from "../utils/errorMessage";

export function usePidApi() {
  return useMemo(
    () => ({
      fetchProcesses(locationId: number, includeDeleted = false) {
        const query = includeDeleted ? "?include_deleted=true" : "";
        return apiFetch<PidProcess[]>(`/pid/${locationId}/processes${query}`);
      },
      createProcess(locationId: number, payload: { name: string; description?: string | null }) {
        return apiFetch<PidProcess>(`/pid/${locationId}/processes`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },
      fetchDiagram(processId: number) {
        return apiFetch<PidDiagram>(`/pid/diagram/${processId}`);
      },
      saveDiagram(processId: number, diagram: PidDiagram) {
        return apiFetch<PidDiagram>(`/pid/diagram/${processId}`, {
          method: "PUT",
          body: JSON.stringify(diagram),
        });
      },
      updateProcess(processId: number, payload: { name?: string; description?: string | null }) {
        return apiFetch<PidProcess>(`/pid/processes/${processId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      },
      deleteProcess(processId: number) {
        return apiFetch<void>(`/pid/processes/${processId}`, { method: "DELETE" });
      },
      restoreProcess(processId: number) {
        return apiFetch<PidProcess>(`/pid/processes/${processId}/restore`, { method: "POST" });
      },
      async uploadImage(file: File) {
        const form = new FormData();
        form.append("file", file);
        const headers = new Headers();
        const token = getToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        const response = await fetch(getApiUrl("/pid/upload-image"), {
          method: "POST",
          headers,
          body: form,
        });
        if (!response.ok) {
          throw buildHttpError({
            status: response.status,
            statusText: response.statusText || "Upload failed",
            body: await response.text(),
            fallbackMessage: "Upload failed",
          });
        }
        return (await response.json()) as { filename: string; original_name: string; url: string };
      },
    }),
    []
  );
}
