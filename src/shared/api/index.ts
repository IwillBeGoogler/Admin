import { createHttpClient } from "@/shared/http/client";
import { createTokenStore } from "@/shared/http/tokenStore";
import { currentLocale } from "@/shared/i18n";
import { settingsSync } from "@/shared/settingsSync";

export type { components as ApiSchemas, paths as ApiPaths } from "./openapi";

/** App-wide token store and HTTP client (one per tab). */
export const tokens = createTokenStore();

const expiredListeners = new Set<() => void>();
export const onSessionExpired = (l: () => void) => {
  expiredListeners.add(l);
  return () => void expiredListeners.delete(l);
};

export const http = createHttpClient({
  tokens,
  locale: currentLocale,
  onSessionExpired: () => {
    for (const l of expiredListeners) l();
  },
});

/** Refresh this long before the access token expires, so calls rarely meet a 401. */
const REFRESH_EARLY_MS = 60_000;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
/** setTimeout's ceiling (~24.8 days); larger delays would fire at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
tokens.subscribe((t) => {
  clearTimeout(refreshTimer);
  const at = t?.refreshToken ? Date.parse(t.expiresAt) : Number.NaN;
  if (Number.isNaN(at)) return;
  const delay = Math.max(at - Date.now() - REFRESH_EARLY_MS, 0);
  if (delay > MAX_TIMEOUT_MS) return; // access tokens live hours; nothing to schedule yet
  refreshTimer = setTimeout(() => {
    void http.refresh().then((r) => {
      if (r === "expired") {
        tokens.set(null);
        for (const l of expiredListeners) l();
      }
    });
  }, delay);
});

/**
 * Gets a fresh access token with the stored refresh token when the access
 * token is missing or expired. True when signed in afterwards.
 */
export const restoreSession = async (): Promise<boolean> => {
  const t = tokens.get();
  if (t && Date.parse(t.expiresAt) > Date.now() + 5_000) return true;
  return (await http.refresh()) === "ok";
};

// Signed-in admins' settings (theme, language, sidebar) follow them across devices.
settingsSync.start({ http: http as never, tokens });
