import { createHttpClient } from "@/shared/http/client";
import { createTokenStore, sessionEndsAt } from "@/shared/http/tokenStore";
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
let endTimer: ReturnType<typeof setTimeout> | undefined;
const expire = () => {
  tokens.set(null);
  for (const l of expiredListeners) l();
};
/** setTimeout's ceiling (~24.8 days); larger delays would fire at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const schedule = (t: ReturnType<typeof tokens.get>) => {
  clearTimeout(refreshTimer);
  clearTimeout(endTimer);
  const end = sessionEndsAt(t);
  if (!Number.isNaN(end)) {
    // the 12h admin session cap: sign out when it is reached
    if (end <= Date.now()) return expire();
    endTimer = setTimeout(expire, Math.min(end - Date.now(), MAX_TIMEOUT_MS));
  }
  const at = t?.refreshToken ? Date.parse(t.expiresAt) : Number.NaN;
  if (Number.isNaN(at)) return;
  const delay = Math.max(at - Date.now() - REFRESH_EARLY_MS, 0);
  if (delay > MAX_TIMEOUT_MS) return; // access tokens live hours; nothing to schedule yet
  refreshTimer = setTimeout(() => {
    void http.refresh().then((r) => {
      if (r === "expired") expire();
    });
  }, delay);
};
tokens.subscribe(schedule);
schedule(tokens.get());

/**
 * Gets a fresh access token with the stored refresh token when the access
 * token is missing or expired. True when signed in afterwards.
 */
export const restoreSession = async (): Promise<boolean> => {
  const t = tokens.get();
  if (sessionEndsAt(t) <= Date.now()) {
    tokens.set(null); // past the 12h admin cap: sign in again
    return false;
  }
  if (t && Date.parse(t.expiresAt) > Date.now() + 5_000) return true;
  return (await http.refresh()) === "ok";
};

// Signed-in admins' settings (theme, language, sidebar) follow them across devices.
settingsSync.start({ http: http as never, tokens });
