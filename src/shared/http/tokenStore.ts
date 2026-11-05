/**
 * Holds the bearer token. Memory is the source of truth; sessionStorage
 * mirrors it so a reload in the same tab keeps the session (tab-scoped, not
 * shared across tabs, cleared when the tab closes). The server ends idle
 * sessions after 30 minutes, so a stolen copy has a short life.
 */
export interface StoredToken {
  token: string;
  expiresAt: string;
}

type Listener = (t: StoredToken | null) => void;

export interface TokenStore {
  get(): StoredToken | null;
  set(t: StoredToken | null): void;
  subscribe(l: Listener): () => void;
}

const KEY = "admin.session";

export const createTokenStore = (
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = safeSession(),
): TokenStore => {
  let current: StoredToken | null = read(storage);
  const listeners = new Set<Listener>();
  return {
    get: () => current,
    set(t) {
      current = t;
      try {
        if (t) storage?.setItem(KEY, JSON.stringify(t));
        else storage?.removeItem(KEY);
      } catch {
        /* storage full or disabled: memory still works */
      }
      for (const l of listeners) l(t);
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
};

function safeSession() {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function read(storage: Pick<Storage, "getItem"> | null): StoredToken | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredToken>;
    return typeof v.token === "string" && typeof v.expiresAt === "string"
      ? { token: v.token, expiresAt: v.expiresAt }
      : null;
  } catch {
    return null;
  }
}
