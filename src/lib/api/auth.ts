import {
  clearAccessToken,
  clearLegacyTokenStorage,
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
 * Silent rehydrate after page reload: refresh cookie → access JWT in memory.
 * Returns whether a session was restored.
 */
export async function restoreSession(): Promise<boolean> {
  clearLegacyTokenStorage();
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
