import type { SerialMapProjectDraft } from "./types";

export const SERIAL_MAP_STORAGE_KEY = "serial-map-editor:v1";

export function loadSerialMapDraft(): SerialMapProjectDraft | null {
  const raw = localStorage.getItem(SERIAL_MAP_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as SerialMapProjectDraft;
}

export function saveSerialMapDraft(project: SerialMapProjectDraft) {
  localStorage.setItem(SERIAL_MAP_STORAGE_KEY, JSON.stringify(project));
}

export function clearSerialMapDraft() {
  localStorage.removeItem(SERIAL_MAP_STORAGE_KEY);
}
