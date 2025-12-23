import { apiFetch } from "./client";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: { id: number; username: string; role: "admin" | "engineer" | "viewer" };
};

export async function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ username, password })
  });
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
}

export async function getMe() {
  return apiFetch<{ id: number; username: string; role: "admin" | "engineer" | "viewer" }>(
    "/auth/me"
  );
}
