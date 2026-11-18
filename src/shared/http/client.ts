import type { z } from "zod";
import { ApiError, ContractError, problemSchema } from "./problem";
import { storedFrom, type TokenStore } from "./tokenStore";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions<S extends z.ZodType | undefined> {
  method?: Method;
  body?: unknown;
  query?: Query;
  schema?: S;
  signal?: AbortSignal | undefined;
  /** Skip the refresh-and-retry dance (auth endpoints). */
  noRefresh?: boolean;
}

export interface HttpClientConfig {
  baseUrl?: string;
  tokens: TokenStore;
  locale: () => string;
  /** Called once the session is gone for good (refresh failed). */
  onSessionExpired?: () => void;
  fetch?: typeof fetch;
}

export type RefreshResult = "ok" | "expired" | "error";

export type HttpClient = (<S extends z.ZodType | undefined = undefined>(
  path: string,
  opts?: RequestOptions<S>,
) => Promise<S extends z.ZodType ? z.output<S> : unknown>) & {
  /** Trade the stored refresh token for a new pair (shared by concurrent callers and tabs). */
  refresh: () => Promise<RefreshResult>;
};

export const buildQuery = (q?: Query) => {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

const readBody = async (r: Response): Promise<unknown> => {
  if (r.status === 204) return null;
  const text = await r.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { title: text };
  }
};

const refreshSchema = { access_token: "", token: "", expires_at: "", refresh_token: "", refresh_expires_at: "" };

/** Runs fn under a cross-tab lock when the browser has one (Web Locks), so tabs never rotate the refresh token at once. */
const withTabLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  return locks ? (locks.request("auth-refresh", fn) as Promise<T>) : fn();
};

/**
 * createHttpClient: JSON over fetch with Bearer auth, Accept-Language, RFC 9457
 * errors and Zod-validated responses. The access token (ACCESS_TOKEN_TTL on
 * the API, 3 hours) is short-lived; the refresh token (30 days) is kept next
 * to it in localStorage. A 401 on an authenticated call triggers one shared
 * POST /auth/refresh (both tokens rotate) and a single retry. Tabs take turns
 * refreshing; a tab that waited uses the pair the other one stored.
 */
export const createHttpClient = (cfg: HttpClientConfig): HttpClient => {
  const base = cfg.baseUrl ?? "/api";
  const doFetch = cfg.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  let refreshing: Promise<RefreshResult> | null = null;

  const refresh = (): Promise<RefreshResult> => {
    const asked = cfg.tokens.get()?.refreshToken;
    refreshing ??= withTabLock(async (): Promise<RefreshResult> => {
      const before = cfg.tokens.get();
      // another tab refreshed while this one waited for the lock (storage event): use its pair
      if (before?.refreshToken && asked && before.refreshToken !== asked) return "ok";
      try {
        if (!before?.refreshToken) return "expired";
        const r = await doFetch(`${base}/auth/refresh`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: before.refreshToken }),
        });
        if (r.status === 401 || r.status === 403) {
          // a sign-in in the meantime (another call path) left a newer token: keep it
          const now = cfg.tokens.get();
          return now && now.token !== before?.token ? "ok" : "expired";
        }
        if (!r.ok) return "error"; // 5xx / gateway: the session may be fine, do not log the admin out
        const body = (await readBody(r)) as { data?: Partial<typeof refreshSchema> } | null;
        const d = body?.data;
        const token = d?.access_token || d?.token;
        if (!token) return "error";
        cfg.tokens.set({
          ...storedFrom({ ...d, token, expires_at: d?.expires_at ?? "" }),
          startedAt: before.startedAt ?? Date.now(), // the 12h cap counts from sign-in, not from each refresh
        });
        return "ok";
      } catch {
        return "error"; // network blip
      }
    }).finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const send = async (path: string, opts: RequestOptions<z.ZodType | undefined>) => {
    const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": cfg.locale() };
    const t = cfg.tokens.get();
    if (t) headers.Authorization = `Bearer ${t.token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    return doFetch(`${base}${path}${buildQuery(opts.query)}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? null : JSON.stringify(opts.body),
      signal: opts.signal ?? null,
    });
  };

  const client = (async (path: string, opts: RequestOptions<z.ZodType | undefined> = {}) => {
    const hadToken = cfg.tokens.get() !== null;
    let r = await send(path, opts);
    if (r.status === 401 && hadToken && !opts.noRefresh) {
      const res = await refresh();
      if (res === "ok") r = await send(path, opts);
      else if (res === "expired") {
        cfg.tokens.set(null);
        cfg.onSessionExpired?.();
      }
    }
    const body = await readBody(r);
    if (!r.ok) {
      const p = problemSchema.safeParse(body ?? {});
      throw new ApiError(r.status, p.success ? p.data : {});
    }
    if (!opts.schema) return body;
    const parsed = opts.schema.safeParse(body);
    if (!parsed.success) throw new ContractError(path, parsed.error.issues);
    return parsed.data;
  }) as HttpClient;
  client.refresh = refresh;
  return client;
};
