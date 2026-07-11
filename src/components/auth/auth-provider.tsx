"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clearAccessToken, isAuthenticated } from "@/lib/auth/session";
import * as authApi from "@/lib/api/auth";

type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthState: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const refreshAuthState = useCallback(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  // On boot: drop legacy localStorage tokens, try cookie refresh for access JWT.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await authApi.restoreSession();
        if (!cancelled) {
          setAuthenticated(ok);
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          setAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await authApi.login(email, password);
      refreshAuthState();
    },
    [refreshAuthState],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await authApi.register(email, password);
      refreshAuthState();
    },
    [refreshAuthState],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    clearAccessToken();
    setAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      login,
      register,
      logout,
      refreshAuthState,
    }),
    [ready, authenticated, login, register, logout, refreshAuthState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
