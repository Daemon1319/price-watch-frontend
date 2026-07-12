/**
 * Browser session for access + refresh tokens.
 *
 * Access JWT (~15m) and refresh (~7d) are kept in localStorage so closing the tab
 * does not force a re-login. The API also sets an HttpOnly refresh cookie for
 * same-site setups (local Next → local API); that cookie is NOT sent on
 * cross-site fetches (Vercel HTTPS → localhost HTTP), so the body refresh token
 * is required for that hybrid.
 *
 * Trade-off: localStorage is readable by JS (XSS). Prefer cookie-only when the
 * SPA and API are same-site over HTTPS.
 */

const ACCESS_TOKEN_KEY = "pw_access_token";
const ACCESS_EXPIRES_KEY = "pw_access_expires_at";
const REFRESH_TOKEN_KEY = "pw_refresh_token";

let accessToken: string | null = null;
let expiresAt = 0;
let refreshToken: string | null = null;
let hydrated = false;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function hydrate(): void {
  if (hydrated || !canUseStorage()) return;
  hydrated = true;
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const expRaw = localStorage.getItem(ACCESS_EXPIRES_KEY);
    const exp = expRaw ? Number(expRaw) : 0;
    if (token && exp > Date.now()) {
      accessToken = token;
      expiresAt = exp;
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ACCESS_EXPIRES_KEY);
    }
    refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    // private mode / blocked storage
  }
}

function persist(): void {
  if (!canUseStorage()) return;
  try {
    if (accessToken && expiresAt > Date.now()) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(ACCESS_EXPIRES_KEY, String(expiresAt));
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ACCESS_EXPIRES_KEY);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

/** Apply a full token pair from login / register / refresh. */
export function applyAuthSession(
  access: string,
  expiresInSeconds: number,
  refresh: string | null | undefined,
): void {
  accessToken = access;
  expiresAt = Date.now() + expiresInSeconds * 1000;
  if (refresh != null && refresh.length > 0) {
    refreshToken = refresh;
  }
  hydrated = true;
  persist();
}

/** @deprecated use applyAuthSession — kept for call sites that only set access */
export function setAccessToken(token: string, expiresInSeconds: number): void {
  applyAuthSession(token, expiresInSeconds, refreshToken);
}

export function getAccessToken(): string | null {
  hydrate();
  if (accessToken && expiresAt > 0 && Date.now() >= expiresAt) {
    accessToken = null;
    expiresAt = 0;
    if (canUseStorage()) {
      try {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(ACCESS_EXPIRES_KEY);
      } catch {
        // ignore
      }
    }
    return null;
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  hydrate();
  return refreshToken;
}

export function clearAccessToken(): void {
  accessToken = null;
  expiresAt = 0;
  refreshToken = null;
  hydrated = true;
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_EXPIRES_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** No-op kept so older call sites still compile; we no longer wipe our own keys. */
export function clearLegacyTokenStorage(): void {
  // intentionally empty — session keys above are the live store
}

export function isAuthenticated(): boolean {
  return getAccessToken() != null || getRefreshToken() != null;
}

export function getAccessExpiresAt(): number {
  hydrate();
  return expiresAt;
}
