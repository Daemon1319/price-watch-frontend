import {
  applyAuthSession,
  clearAccessToken,
  clearLegacyTokenStorage,
  getAccessToken,
  getRefreshToken,
} from "@/lib/auth/session";
import type { LoginResponse, ProblemDetail } from "@/lib/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8080";

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail;
  /** Parsed from Retry-After when present (seconds). */
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    problem: ProblemDetail,
    retryAfterSeconds?: number,
  ) {
    super(problem.detail || problem.title || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Thrown when the browser blocks a public-site → localhost/LAN fetch (Chrome LNA). */
export class LocalNetworkAccessError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Chrome blocked access to your local API. Allow Local Network Access for this site (address bar / permission prompt), then reload.",
    );
    this.name = "LocalNetworkAccessError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  /** Skip 401 refresh retry (used by refresh itself). */
  skipRefresh?: boolean;
};

/**
 * Chrome Local Network Access (LNA): a *public* page (e.g. Vercel) calling the
 * user's machine needs (1) a secure context (HTTPS), (2) the correct
 * `targetAddressSpace`, and (3) the user granting permission once.
 *
 * Address spaces (do not mix these up):
 * - localhost / 127.0.0.1 / ::1 → "loopback" (NOT "local")
 * - RFC1918 / .local → "local"
 * Wrong tag fails with: target IP address space of `local` yet resource is in `loopback`
 *
 * @see https://developer.chrome.com/blog/local-network-access
 * @see https://wicg.github.io/local-network-access/
 */
function targetAddressSpaceForApiBase(
  base: string,
): "loopback" | "local" | undefined {
  try {
    const host = new URL(base).hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "::1"
    ) {
      return "loopback";
    }
    // Private / link-local hostnames or IPs (optional; only if you ever point API there)
    if (
      host.endsWith(".local") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return "local";
    }
  } catch {
    // ignore
  }
  return undefined;
}

/** True when the SPA is on a public origin and the API is on loopback/LAN. */
export function isPublicToLocalApi(): boolean {
  if (typeof window === "undefined") return false;
  const space = targetAddressSpaceForApiBase(API_BASE);
  if (!space) return false;
  try {
    const pageHost = window.location.hostname.toLowerCase();
    const isPageLoopback =
      pageHost === "localhost" ||
      pageHost === "127.0.0.1" ||
      pageHost === "[::1]" ||
      pageHost === "::1";
    // loopback → loopback is not gated by LNA; public (or LAN) → loopback/local is.
    return !isPageLoopback;
  } catch {
    return false;
  }
}

/** RequestInit + Chrome LNA option (not in all TS lib.dom versions yet). */
type LocalNetworkRequestInit = RequestInit & {
  targetAddressSpace?: "local" | "private" | "loopback" | "public";
};

function buildFetchInit(init: RequestInit = {}): LocalNetworkRequestInit {
  const next: LocalNetworkRequestInit = { ...init };
  const space = targetAddressSpaceForApiBase(API_BASE);
  if (space) {
    // Always annotate when the API host is local/loopback so mixed-content
    // exemptions and LNA permission prompts apply (HTTPS → http://localhost).
    next.targetAddressSpace = space;
  }
  return next;
}

/**
 * Concurrent fetches while Chrome shows the LNA prompt often show as "blocked"
 * in DevTools even though the app later works after Allow. Serialize one
 * lightweight request first so only a single prompt fires and the rest wait.
 */
let lnaGate: Promise<void> | null = null;
let lnaPrimed = false;

async function ensureLocalNetworkAccess(): Promise<void> {
  if (!isPublicToLocalApi() || lnaPrimed) return;
  if (lnaGate) return lnaGate;

  lnaGate = (async () => {
    try {
      // Prefer Permissions API when available (Chrome split: loopback-network / local-network).
      const space = targetAddressSpaceForApiBase(API_BASE);
      if (space && navigator.permissions?.query) {
        const names =
          space === "loopback"
            ? (["loopback-network", "local-network-access"] as const)
            : (["local-network", "local-network-access"] as const);
        for (const name of names) {
          try {
            const status = await navigator.permissions.query({
              name: name as PermissionName,
            });
            if (status.state === "granted") {
              lnaPrimed = true;
              return;
            }
            if (status.state === "denied") {
              throw new LocalNetworkAccessError();
            }
            break; // "prompt" — fall through to priming fetch
          } catch (err) {
            if (err instanceof LocalNetworkAccessError) throw err;
            // Unsupported permission name — try next / fall through
          }
        }
      }

      // Public health endpoint: no auth; CORS already covers allowed origins.
      // This single fetch is what should trigger Chrome's LNA permission prompt.
      const res = await fetch(
        `${API_BASE}/actuator/health`,
        buildFetchInit({
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "omit",
          cache: "no-store",
        }),
      );
      // Any HTTP response means LNA + network path is open (even 503).
      if (res.type !== "opaque") {
        lnaPrimed = true;
      }
    } catch (err) {
      // Permission explicitly denied — surface immediately.
      if (err instanceof LocalNetworkAccessError) throw err;
      // TypeError: LNA deny *or* API offline / CORS. Do not throw here —
      // leave unprimed so real calls still run and map the error themselves.
    } finally {
      lnaGate = null;
    }
  })();

  return lnaGate;
}

function isLikelyLocalNetworkBlock(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("local network") ||
    msg.includes("permission")
  );
}

async function apiRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  await ensureLocalNetworkAccess();
  try {
    const res = await fetch(`${API_BASE}${path}`, buildFetchInit(init));
    // A completed response means LNA is open for this origin.
    if (isPublicToLocalApi()) lnaPrimed = true;
    return res;
  } catch (err) {
    if (err instanceof LocalNetworkAccessError) throw err;
    if (isPublicToLocalApi() && isLikelyLocalNetworkBlock(err)) {
      throw new LocalNetworkAccessError(
        `Could not reach the local API at ${API_BASE}. If Chrome asked for Local Network Access, choose Allow and reload. Also confirm the API is running.`,
      );
    }
    throw err;
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * New access JWT via body refresh token (and cookie when same-site).
 * Dedupes concurrent callers so a rotated token is not reused (double-refresh race).
 */
export async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const storedRefresh = getRefreshToken();
    // Cross-origin (Vercel → local API): cookie is not sent; body token is required.
    if (!storedRefresh) {
      return false;
    }

    try {
      const res = await apiRequest("/api/v1/auth/refresh", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });

      if (!res.ok) {
        // 401 on refresh usually means revoked/expired token. Do not clear on
        // every 401 if another tab may have just rotated — re-read storage once.
        if (res.status === 401 || res.status === 403) {
          const latest = getRefreshToken();
          if (latest && latest !== storedRefresh) {
            // Another tab rotated; retry once with the newer token.
            const retry = await apiRequest("/api/v1/auth/refresh", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({ refreshToken: latest }),
            });
            if (retry.ok) {
              const data = (await retry.json()) as LoginResponse;
              applyAuthSession(
                data.accessToken,
                data.expiresIn,
                data.refreshToken ?? latest,
              );
              return true;
            }
          }
          clearAccessToken();
        }
        return false;
      }

      const data = (await res.json()) as LoginResponse;
      if (!data.accessToken) {
        return false;
      }
      // Server rotates refresh — must store the new one
      applyAuthSession(
        data.accessToken,
        data.expiresIn,
        data.refreshToken ?? storedRefresh,
      );
      return true;
    } catch {
      // Network blip / LNA blocked / backend offline: keep stored tokens for retry
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header == null || header.trim() === "") return undefined;
  const asInt = Number.parseInt(header.trim(), 10);
  if (!Number.isNaN(asInt) && asInt >= 0) return asInt;
  return undefined;
}

async function parseError(res: Response): Promise<ApiError> {
  let problem: ProblemDetail = {
    title: res.statusText || "Error",
    status: res.status,
  };
  try {
    const json = (await res.json()) as ProblemDetail;
    problem = { ...problem, ...json };
  } catch {
    // non-JSON body
  }
  if (!problem.detail) {
    problem.detail = problem.title || `HTTP ${res.status}`;
  }
  const retryAfterSeconds = parseRetryAfter(res.headers.get("Retry-After"));
  return new ApiError(res.status, problem, retryAfterSeconds);
}

/**
 * Browser-side API helper.
 * - Access JWT: Authorization Bearer (localStorage)
 * - Refresh: body token (cross-site) + cookie when available
 * - On 401: one refresh attempt, then retry once
 * - Chrome LNA: targetAddressSpace when API is localhost
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, skipRefresh = false } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    // Proactively refresh if access is expired/missing but we still have refresh
    let token = getAccessToken();
    if (!token && getRefreshToken() && !skipRefresh) {
      await tryRefresh();
      token = getAccessToken();
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await apiRequest(path, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !skipRefresh) {
    const ok = await tryRefresh();
    if (ok) {
      return apiFetch<T>(path, { ...options, skipRefresh: true });
    }
    clearLegacyTokenStorage();
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw await parseError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
