import { apiFetch } from "./client";

export type SpacePermission = {
  space_key: string;
  can_read: boolean;
  can_write: boolean;
  can_admin: boolean;
};

export type AuthUser = {
  id: number;
  username: string;
  role: "admin" | "engineer" | "viewer";
  permissions: SpacePermission[];
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
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
  return apiFetch<AuthUser>("/auth/me");
}
