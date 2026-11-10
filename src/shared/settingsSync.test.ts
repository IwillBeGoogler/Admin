import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettingsSync, SETTINGS_PATH } from "./settingsSync";

const setup = (prefs: Record<string, unknown> | Error, token: unknown = "t") => {
  let tok: unknown = token;
  const listeners = new Set<(t: unknown) => void>();
  const http = vi.fn(async (_p: string, o?: { method?: string; body?: unknown }) => {
    if (o?.method === "PATCH") return { prefs: {} };
    if (prefs instanceof Error) throw prefs;
    return { prefs };
  });
  const tokens = {
    get: () => tok,
    subscribe: (l: (t: unknown) => void) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
  const signIn = (t: unknown) => {
    tok = t;
    for (const l of listeners) l(t);
  };
  return { http, tokens, signIn, sync: createSettingsSync(800) };
};
const patches = (http: ReturnType<typeof setup>["http"]) =>
  http.mock.calls.filter((c) => c[1]?.method === "PATCH").map((c) => c[1]?.body);

describe("settingsSync", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("applies server values on start when signed in (server wins)", async () => {
    const { http, tokens, sync } = setup({ lang: "ru" });
    const apply = vi.fn();
    sync.register({ key: "lang", get: () => "en", apply });
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(0);
    expect(http).toHaveBeenCalledWith(SETTINGS_PATH);
    expect(apply).toHaveBeenCalledWith("ru");
    expect(patches(http)).toHaveLength(0);
  });

  it("applies a cached server value to a setting registered later", async () => {
    const { http, tokens, sync } = setup({ lang: "ru" });
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(0);
    const apply = vi.fn();
    sync.register({ key: "lang", get: () => undefined, apply });
    expect(apply).toHaveBeenCalledWith("ru");
  });

  it("pulls on sign-in", async () => {
    const { http, tokens, sync, signIn } = setup({ lang: "uz" }, null);
    const apply = vi.fn();
    sync.register({ key: "lang", get: () => undefined, apply });
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(0);
    expect(http).not.toHaveBeenCalled();
    signIn("tok");
    await vi.advanceTimersByTimeAsync(0);
    expect(apply).toHaveBeenCalledWith("uz");
  });

  it("seeds the server with local values it lacks", async () => {
    const { http, tokens, sync } = setup({});
    sync.register({ key: "reading", get: () => ({ palette: "carbon" }), apply: vi.fn() });
    sync.register({ key: "unset", get: () => undefined, apply: vi.fn() });
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(900);
    expect(patches(http)).toEqual([{ reading: { palette: "carbon" } }]);
  });

  it("debounces pushes into one PATCH", async () => {
    const { http, tokens, sync } = setup({});
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(0);
    sync.push("a", 1);
    await vi.advanceTimersByTimeAsync(500);
    sync.push("b", 2);
    sync.push("a", 3);
    await vi.advanceTimersByTimeAsync(799);
    expect(patches(http)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(patches(http)).toEqual([{ a: 3, b: 2 }]);
  });

  it("does not push when signed out or when the server already has the value", async () => {
    const out = setup({}, null);
    out.sync.start({ http: out.http, tokens: out.tokens });
    out.sync.push("a", 1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(out.http).not.toHaveBeenCalled();

    const inn = setup({ a: 1 });
    inn.sync.start({ http: inn.http, tokens: inn.tokens });
    await vi.advanceTimersByTimeAsync(0);
    inn.sync.push("a", 1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(patches(inn.http)).toHaveLength(0);
  });

  it("keeps a local change made before the pull finished", async () => {
    const { http, tokens, sync } = setup({ lang: "ru" });
    const apply = vi.fn();
    sync.register({ key: "lang", get: () => "en", apply });
    sync.start({ http, tokens });
    sync.push("lang", "en");
    await vi.advanceTimersByTimeAsync(900);
    expect(apply).not.toHaveBeenCalled();
    expect(patches(http)).toEqual([{ lang: "en" }]);
  });

  it("fails silently on network errors", async () => {
    const { http, tokens, sync } = setup(new Error("offline"));
    const apply = vi.fn();
    sync.register({ key: "lang", get: () => "en", apply });
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(900);
    expect(apply).not.toHaveBeenCalled();
    http.mockRejectedValue(new Error("offline"));
    sync.push("lang", "ru");
    await vi.advanceTimersByTimeAsync(900);
    expect(patches(http)).toHaveLength(1); // attempted, error swallowed
  });
});

describe("settingsSync lifecycle and failures", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sign-out drops pending pushes and the cached server copy", async () => {
    const { http, tokens, sync, signIn } = setup({});
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(0);
    sync.push("a", 1);
    signIn(null);
    await vi.advanceTimersByTimeAsync(2000);
    expect(patches(http)).toHaveLength(0);
    const apply = vi.fn();
    sync.register({ key: "a", get: () => undefined, apply });
    expect(apply).not.toHaveBeenCalled();
  });

  it("stop function unsubscribes from the token store", async () => {
    const { http, tokens, sync, signIn } = setup({ lang: "uz" }, null);
    const stop = sync.start({ http, tokens });
    stop();
    stop();
    signIn("tok");
    await vi.advanceTimersByTimeAsync(0);
    expect(http).not.toHaveBeenCalled();
  });

  it("restarting replaces the previous subscription", async () => {
    const { http, tokens, sync, signIn } = setup({}, null);
    sync.start({ http, tokens });
    sync.start({ http, tokens });
    signIn("tok");
    await vi.advanceTimersByTimeAsync(0);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("ignores a failed or malformed pull", async () => {
    const bad = setup(new Error("offline"));
    const apply = vi.fn();
    bad.sync.register({ key: "lang", get: () => "en", apply });
    bad.sync.start({ http: bad.http, tokens: bad.tokens });
    await vi.advanceTimersByTimeAsync(2000);
    expect(apply).not.toHaveBeenCalled();
    expect(patches(bad.http)).toHaveLength(0);

    const empty = setup({});
    empty.http.mockResolvedValue(null as never);
    empty.sync.start({ http: empty.http, tokens: empty.tokens });
    await vi.advanceTimersByTimeAsync(2000);
    expect(patches(empty.http)).toHaveLength(0);
  });

  it("a throwing apply does not break the pull", async () => {
    const { http, tokens, sync } = setup({ a: 1, b: 2 });
    const ok = vi.fn();
    sync.register({
      key: "a",
      get: () => undefined,
      apply: () => {
        throw new Error("bad value");
      },
    });
    sync.register({ key: "b", get: () => undefined, apply: ok });
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(0);
    expect(ok).toHaveBeenCalledWith(2);
  });

  it("keeps the change local when the PATCH fails", async () => {
    const { http, tokens, sync } = setup({});
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(0);
    http.mockRejectedValue(new Error("offline"));
    sync.push("a", 1);
    await expect(vi.advanceTimersByTimeAsync(900)).resolves.not.toThrow();
  });

  it("unregister removes only its own registration", async () => {
    const { http, tokens, sync } = setup({ a: 1 });
    const first = vi.fn();
    const second = vi.fn();
    const off1 = sync.register({ key: "a", get: () => undefined, apply: first });
    sync.register({ key: "a", get: () => undefined, apply: second });
    off1(); // stale: must not remove the newer registration
    sync.start({ http, tokens });
    await vi.advanceTimersByTimeAsync(0);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1);
  });
});
