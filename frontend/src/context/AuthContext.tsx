import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { type AuthUser, getMe, heartbeat, login as apiLogin, logout as apiLogout } from "../api/auth";
import { getToken, setToken } from "../api/client";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authFailureReason: "expired" | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authFailureReason, setAuthFailureReason] = useState<"expired" | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    getMe()
      .then((data) => {
        setUser(data);
        setAuthFailureReason(null);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        setAuthFailureReason("expired");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let cancelled = false;
    const intervalMs = 60 * 1000;

    const tick = async () => {
      try {
        await heartbeat();
      } catch {
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setAuthFailureReason("expired");
        }
      }
    };

    const timerId = window.setInterval(tick, intervalMs);
    void tick();

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [user]);

  const login = async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    setToken(result.access_token);
    setUser(result.user);
    setAuthFailureReason(null);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setToken(null);
      setUser(null);
      setAuthFailureReason(null);
    }
  };

  const value = useMemo(
    () => ({ user, loading, authFailureReason, login, logout }),
    [user, loading, authFailureReason]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
