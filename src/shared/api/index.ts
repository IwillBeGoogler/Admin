import { createHttpClient } from "@/shared/http/client";
import { createTokenStore } from "@/shared/http/tokenStore";
import { currentLocale } from "@/shared/i18n";

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
