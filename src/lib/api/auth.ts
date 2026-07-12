import {
  clearAccessToken,
  clearLegacyTokenStorage,
  isAuthenticated,
  setAccessToken,
} from "@/lib/auth/session";
import { apiFetch, tryRefresh } from "@/lib/api/client";
import type { LoginResponse } from "@/lib/types";

export async function register(email: string, password: string): Promise<void> {
  clearLegacyTokenStorage();
  const data = await apiFetch<LoginResponse>("/api/v1/auth/register", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setAccessToken(data.accessToken, data.expiresIn);
}

export async function login(email: string, password: string): Promise<void> {
  clearLegacyTokenStorage();
  const data = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setAccessToken(data.accessToken, data.expiresIn);
}

/**
 * Silent rehydrate after page reload:
 * 1) access JWT from sessionStorage (survives refresh; needed when Vercel→local API
 *    cannot send the cross-site refresh cookie)
 * 2) else refresh cookie → new access JWT
 */
export async function restoreSession(): Promise<boolean> {
  clearLegacyTokenStorage();
  if (isAuthenticated()) {
    return true;
  }
  return tryRefresh();
}

export async function logout(): Promise<void> {
  try {
    // Cookie is sent via credentials; access JWT via Authorization if present.
    await apiFetch<void>("/api/v1/auth/logout", {
      method: "POST",
    });
  } catch {
    // Always clear local session even if server revoke fails
  } finally {
    clearAccessToken();
    clearLegacyTokenStorage();
  }
}
