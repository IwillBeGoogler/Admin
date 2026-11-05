import type { z } from "zod";
import { ApiError, ContractError, problemSchema } from "./problem";
import type { TokenStore } from "./tokenStore";

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

export type HttpClient = <S extends z.ZodType | undefined = undefined>(
  path: string,
  opts?: RequestOptions<S>,
) => Promise<S extends z.ZodType ? z.output<S> : unknown>;

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

const refreshSchema = { token: "", expires_at: "" };

/**
 * createHttpClient: JSON over fetch with Bearer auth, Accept-Language, RFC 9457
 * errors and Zod-validated responses. A 401 on an authenticated call triggers
 * one shared POST /auth/refresh (the token rotates) and a single retry.
 */
export const createHttpClient = (cfg: HttpClientConfig): HttpClient => {
  const base = cfg.baseUrl ?? "/api";
  const doFetch = cfg.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  let refreshing: Promise<boolean> | null = null;

  const refresh = (): Promise<boolean> => {
    refreshing ??= (async () => {
      const t = cfg.tokens.get();
      if (!t) return false;
      try {
        const r = await doFetch(`${base}/auth/refresh`, {
          method: "POST",
          headers: { Accept: "application/json", Authorization: `Bearer ${t.token}` },
        });
        if (!r.ok) return false;
        const body = (await readBody(r)) as { data?: typeof refreshSchema } | null;
        if (!body?.data?.token) return false;
        cfg.tokens.set({ token: body.data.token, expiresAt: body.data.expires_at });
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
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

  return (async (path: string, opts: RequestOptions<z.ZodType | undefined> = {}) => {
    const hadToken = cfg.tokens.get() !== null;
    let r = await send(path, opts);
    if (r.status === 401 && hadToken && !opts.noRefresh) {
      if (await refresh()) r = await send(path, opts);
      else {
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
};
