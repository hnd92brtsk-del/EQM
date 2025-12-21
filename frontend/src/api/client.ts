const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export type ApiOptions = RequestInit & { auth?: boolean };

export function getApiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function getToken(): string | null {
  return localStorage.getItem("eqm_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("eqm_token", token);
  } else {
    localStorage.removeItem("eqm_token");
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (options.auth !== false) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(getApiUrl(path), {
    ...options,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
