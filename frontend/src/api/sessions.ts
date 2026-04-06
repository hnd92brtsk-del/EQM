import { apiFetch } from "./client";

export type OnlineSession = {
  user_id: number;
  system_role?: string | null;
  personnel_full_name?: string | null;
  display_user_label: string;
  last_seen_at: string;
};

export function sendHeartbeat() {
  return apiFetch<{ status: string; last_seen_at: string }>("/auth/heartbeat", { method: "POST" });
}

export function listOnlineSessions() {
  return apiFetch<OnlineSession[]>("/sessions/online");
}
