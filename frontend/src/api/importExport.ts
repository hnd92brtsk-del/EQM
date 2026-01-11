import { getApiUrl, getToken } from "./client";
import { buildQuery } from "./entities";

export type ImportReportIssue = {
  row?: number | null;
  field?: string | null;
  message: string;
};

export type ImportReport = {
  total_rows: number;
  created: number;
  skipped_duplicates: number;
  errors: ImportReportIssue[];
  warnings: ImportReportIssue[];
};

export async function downloadFile(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
  filename: string
) {
  const qs = buildQuery(params);
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(getApiUrl(`${path}${qs}`), { headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importFile(
  path: string,
  file: File,
  params: Record<string, string | number | boolean | undefined | null>
) {
  const qs = buildQuery(params);
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body = new FormData();
  body.append("file", file);

  const response = await fetch(getApiUrl(`${path}${qs}`), {
    method: "POST",
    headers,
    body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return (await response.json()) as ImportReport;
}
