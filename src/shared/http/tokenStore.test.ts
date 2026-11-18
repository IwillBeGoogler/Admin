import { describe, expect, it, vi } from "vitest";
import { createTokenStore, storedFrom } from "./tokenStore";

const KEY = "admin.session";
const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};
const bus = () => {
  let h: ((e: { key: string | null }) => void) | undefined;
  return {
    addEventListener: (_: string, f: (e: { key: string | null }) => void) => {
      h = f;
    },
    fire: (key: string | null) => h?.({ key }),
  };
};

describe("storedFrom", () => {
  it("prefers access_token and keeps the refresh pair", () => {
    expect(storedFrom({ access_token: "a", token: "t", expires_at: "e", refresh_token: "r" })).toEqual({
      token: "a",
      expiresAt: "e",
      refreshToken: "r",
      refreshExpiresAt: "",
    });
    expect(
      storedFrom({ token: "t", expires_at: "e", refresh_token: "r", refresh_expires_at: "x" }).refreshExpiresAt,
    ).toBe("x");
    expect(storedFrom({ expires_at: "e" })).toEqual({ token: "", expiresAt: "e" });
  });
});

describe("createTokenStore", () => {
  it("reads valid, legacy and broken saved values", () => {
    expect(createTokenStore(mem({ [KEY]: JSON.stringify({ token: "t", expiresAt: "e" }) }), null).get()).toEqual({
      token: "t",
      expiresAt: "e",
    });
    expect(
      createTokenStore(mem({ [KEY]: JSON.stringify({ token: "t", expiresAt: "e", refreshToken: "r" }) }), null).get(),
    ).toEqual({
      token: "t",
      expiresAt: "e",
      refreshToken: "r",
      refreshExpiresAt: "",
    });
    expect(createTokenStore(mem({ [KEY]: JSON.stringify({ token: 1 }) }), null).get()).toBeNull();
    expect(createTokenStore(mem({ [KEY]: "{bad" }), null).get()).toBeNull();
    expect(createTokenStore(mem(), null).get()).toBeNull();
    expect(createTokenStore(null, null).get()).toBeNull();
  });

  it("writes, clears, notifies and survives storage errors", () => {
    const s = mem();
    const store = createTokenStore(s, null);
    const l = vi.fn();
    const off = store.subscribe(l);
    store.set({ token: "t", expiresAt: "e" });
    expect(s.m.get(KEY)).toContain('"t"');
    store.set(null);
    expect(s.m.has(KEY)).toBe(false);
    expect(l).toHaveBeenCalledTimes(2);
    off();
    s.setItem = () => {
      throw new Error("full");
    };
    store.set({ token: "u", expiresAt: "e" });
    expect(store.get()?.token).toBe("u");
    expect(l).toHaveBeenCalledTimes(2);
  });

  it("follows other tabs' writes", () => {
    const s = mem();
    const b = bus();
    const store = createTokenStore(s, b as never);
    const l = vi.fn();
    store.subscribe(l);
    b.fire("other");
    s.m.set(KEY, JSON.stringify({ token: "t2", expiresAt: "e", refreshToken: "r2" }));
    b.fire(KEY);
    expect(store.get()?.token).toBe("t2");
    b.fire(KEY); // same pair: ignored
    expect(l).toHaveBeenCalledTimes(1);
    s.m.clear();
    b.fire(null);
    expect(store.get()).toBeNull();
    expect(l).toHaveBeenCalledTimes(2);
  });

  it("uses window and localStorage by default", () => {
    expect(createTokenStore().get()).toBeNull();
  });
});

describe("admin session cap", () => {
  it("ends 12 hours after sign-in and survives a reload", async () => {
    const { ADMIN_SESSION_MS, createTokenStore: create, sessionEndsAt } = await import("./tokenStore");
    expect(sessionEndsAt(null)).toBeNaN();
    expect(sessionEndsAt({ token: "a", expiresAt: "x", startedAt: 1000 })).toBe(1000 + ADMIN_SESSION_MS);
    const m = new Map<string, string>();
    const storage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
    create(storage, null).set({ token: "a", expiresAt: "x", refreshToken: "r", refreshExpiresAt: "y", startedAt: 5 });
    expect(create(storage, null).get()?.startedAt).toBe(5);
    create(storage, null).set({ token: "a", expiresAt: "x", startedAt: 6 });
    expect(create(storage, null).get()?.startedAt).toBe(6);
  });
});
