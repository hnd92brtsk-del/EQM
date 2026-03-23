import type { LegacySerialMapProjectDraft } from "./types";

export const SERIAL_MAP_STORAGE_KEY = "serial-map-editor:v1";

// Legacy/fallback storage:
// serial map drafts historically lived only in localStorage under this key.
// Backend persistence is now the primary source of truth; this remains a recovery cache.
export function loadSerialMapDraft(): LegacySerialMapProjectDraft | null {
  const raw = localStorage.getItem(SERIAL_MAP_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as LegacySerialMapProjectDraft;
}

export function saveSerialMapDraft(project: LegacySerialMapProjectDraft) {
  localStorage.setItem(SERIAL_MAP_STORAGE_KEY, JSON.stringify(project));
}

export function clearSerialMapDraft() {
  localStorage.removeItem(SERIAL_MAP_STORAGE_KEY);
}
