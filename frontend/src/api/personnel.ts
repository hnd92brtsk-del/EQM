import { apiFetch, getApiUrl, getToken } from "./client";
import { createEntity, deleteEntity, listEntity } from "./entities";

export type Personnel = {
  id: number;
  user_id?: number | null;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  position: string;
  personnel_number?: string | null;
  service?: string | null;
  shop?: string | null;
  department?: string | null;
  division?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  organisation?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  tenure_years?: number | null;
  is_deleted: boolean;
  user?: { id: number; username: string; role: string } | null;
  competencies?: PersonnelCompetency[];
  trainings?: PersonnelTraining[];
};

export type PersonnelCompetency = {
  id: number;
  personnel_id: number;
  name: string;
  organisation?: string | null;
  city?: string | null;
  completion_date?: string | null;
  completion_age_days?: number | null;
  is_deleted: boolean;
};

export type PersonnelTraining = {
  id: number;
  personnel_id: number;
  name: string;
  completion_date?: string | null;
  next_due_date?: string | null;
  reminder_offset_days: number;
  days_until_due?: number | null;
  days_since_completion?: number | null;
  is_deleted: boolean;
};

export type Attachment = {
  id: number;
  entity: string;
  entity_id: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  is_deleted: boolean;
};

export function listPersonnel(params: Record<string, any>) {
  return listEntity<Personnel>("/personnel", params);
}

export function getPersonnel(id: number, includeDeleted?: boolean) {
  const qs = includeDeleted ? "?include_deleted=true" : "";
  return apiFetch<Personnel>(`/personnel/${id}${qs}`);
}

export function createPersonnel(payload: Partial<Personnel>) {
  return createEntity<Personnel>("/personnel", payload);
}

export function updatePersonnel(id: number, payload: Partial<Personnel>) {
  return apiFetch<Personnel>(`/personnel/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deletePersonnel(id: number) {
  return deleteEntity("/personnel", id);
}

export function restorePersonnel(id: number) {
  return apiFetch<Personnel>(`/personnel/${id}/restore`, { method: "POST" });
}

export function createCompetency(personId: number, payload: Partial<PersonnelCompetency>) {
  return apiFetch<PersonnelCompetency>(`/personnel/${personId}/competencies`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateCompetency(
  personId: number,
  competencyId: number,
  payload: Partial<PersonnelCompetency>
) {
  return apiFetch<PersonnelCompetency>(`/personnel/${personId}/competencies/${competencyId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteCompetency(personId: number, competencyId: number) {
  return apiFetch<void>(`/personnel/${personId}/competencies/${competencyId}`, { method: "DELETE" });
}

export function restoreCompetency(personId: number, competencyId: number) {
  return apiFetch<PersonnelCompetency>(`/personnel/${personId}/competencies/${competencyId}/restore`, {
    method: "POST"
  });
}

export function createTraining(personId: number, payload: Partial<PersonnelTraining>) {
  return apiFetch<PersonnelTraining>(`/personnel/${personId}/trainings`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateTraining(personId: number, trainingId: number, payload: Partial<PersonnelTraining>) {
  return apiFetch<PersonnelTraining>(`/personnel/${personId}/trainings/${trainingId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteTraining(personId: number, trainingId: number) {
  return apiFetch<void>(`/personnel/${personId}/trainings/${trainingId}`, { method: "DELETE" });
}

export function restoreTraining(personId: number, trainingId: number) {
  return apiFetch<PersonnelTraining>(`/personnel/${personId}/trainings/${trainingId}/restore`, {
    method: "POST"
  });
}

export function listAttachments(personId: number, entity: string, entityId?: number, includeDeleted?: boolean) {
  const search = new URLSearchParams({ entity });
  if (entityId) {
    search.set("entity_id", String(entityId));
  }
  if (includeDeleted) {
    search.set("include_deleted", "true");
  }
  return apiFetch<Attachment[]>(`/personnel/${personId}/attachments?${search.toString()}`);
}

export async function uploadAttachment(
  personId: number,
  entity: string,
  entityId: number,
  file: File
) {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File too large (max 5 MB)");
  }
  const form = new FormData();
  form.append("file", file);

  const token = getToken();
  const response = await fetch(
    getApiUrl(`/personnel/${personId}/attachments?entity=${entity}&entity_id=${entityId}`),
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form
    }
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Upload failed");
  }
  return response.json() as Promise<Attachment>;
}

export async function uploadPersonnelPhoto(personId: number, file: File) {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File too large (max 5 MB)");
  }
  const form = new FormData();
  form.append("file", file);

  const token = getToken();
  const response = await fetch(getApiUrl(`/personnel/${personId}/attachments?entity=personnel`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Upload failed");
  }
  return response.json() as Promise<Attachment>;
}

export async function downloadAttachment(attachmentId: number) {
  const token = getToken();
  const response = await fetch(getApiUrl(`/personnel/attachments/${attachmentId}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Download failed");
  }
  return response.blob();
}
