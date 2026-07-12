/**
 * Access JWT: memory + sessionStorage so a full page reload stays signed in.
 * Refresh still lives in an HttpOnly cookie (never readable here).
 *
 * Note: Vercel (https) → local API (http) is cross-site, so the refresh cookie
 * often is NOT sent on fetch. sessionStorage bridges reloads for the access JWT.
 */

const LEGACY_KEYS = [
  "pw_access_token",
  "pw_refresh_token",
  "pw_expires_at",
] as const;

const ACCESS_TOKEN_KEY = "pw_access_token_mem";
const ACCESS_EXPIRES_KEY = "pw_access_expires_at";

let accessToken: string | null = null;
let expiresAt = 0;
let hydrated = false;

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

function persistAccess(): void {
  if (typeof window === "undefined") return;
  try {
    if (accessToken && expiresAt > Date.now()) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      sessionStorage.setItem(ACCESS_EXPIRES_KEY, String(expiresAt));
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(ACCESS_EXPIRES_KEY);
    }
  } catch {
    // private mode / blocked storage
  }
}

/** Load access JWT from sessionStorage once per page load (if still unexpired). */
function hydrateFromSession(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const expRaw = sessionStorage.getItem(ACCESS_EXPIRES_KEY);
    const exp = expRaw ? Number(expRaw) : 0;
    if (token && exp > Date.now()) {
      accessToken = token;
      expiresAt = exp;
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(ACCESS_EXPIRES_KEY);
    }
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  hydrateFromSession();
  if (accessToken && expiresAt > 0 && Date.now() >= expiresAt) {
    clearAccessToken();
    return null;
  }
  return accessToken;
}

export function setAccessToken(token: string, expiresInSeconds: number): void {
  accessToken = token;
  expiresAt = Date.now() + expiresInSeconds * 1000;
  hydrated = true;
  persistAccess();
}

export function clearAccessToken(): void {
  accessToken = null;
  expiresAt = 0;
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_EXPIRES_KEY);
  } catch {
    // ignore
  }
}

export function isAuthenticated(): boolean {
  return getAccessToken() != null;
}

export function getAccessExpiresAt(): number {
  hydrateFromSession();
  return expiresAt;
}
