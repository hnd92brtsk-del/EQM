import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getMe, login as apiLogin, logout as apiLogout } from "../api/auth";
import { setToken, getToken } from "../api/client";

export type UserRole = "admin" | "engineer" | "viewer";

export type AuthUser = {
  id: number;
  username: string;
  role: UserRole;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    getMe()
      .then((data) => setUser(data))
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    setToken(result.access_token);
    setUser(result.user);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
