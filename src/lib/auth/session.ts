/**
 * In-memory access JWT. Refresh lives in an HttpOnly cookie (never readable here).
 * On full reload, AuthProvider rehydrates via POST /auth/refresh.
 */

const LEGACY_KEYS = [
  "pw_access_token",
  "pw_refresh_token",
  "pw_expires_at",
] as const;

let accessToken: string | null = null;
let expiresAt = 0;

/** Wipe pre-cookie localStorage tokens if any remain. */
export function clearLegacyTokenStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // private mode / blocked storage
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string, expiresInSeconds: number): void {
  accessToken = token;
  expiresAt = Date.now() + expiresInSeconds * 1000;
}

export function clearAccessToken(): void {
  accessToken = null;
  expiresAt = 0;
}

export function isAuthenticated(): boolean {
  return accessToken != null && accessToken.length > 0;
}

export function getAccessExpiresAt(): number {
  return expiresAt;
}
