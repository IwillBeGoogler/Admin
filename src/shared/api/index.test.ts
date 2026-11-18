import { HttpResponse, http as mswHttp } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, server } from "@/test/server";
import { onSessionExpired, restoreSession, tokens } from "./index";

const soon = (ms: number) => new Date(Date.now() + ms).toISOString();

afterEach(() => {
  vi.useRealTimers();
  tokens.set(null);
});

describe("restoreSession", () => {
  it("is true while the access token is fresh", async () => {
    tokens.set({ token: "t", expiresAt: soon(60_000) });
    expect(await restoreSession()).toBe(true);
  });

  it("refreshes an expired access token", async () => {
    server.use(
      mswHttp.post(api("/auth/refresh"), () =>
        HttpResponse.json({ data: { access_token: "n", expires_at: soon(3_600_000), refresh_token: "r2" } }),
      ),
    );
    tokens.set({ token: "t", expiresAt: soon(-1000), refreshToken: "r" });
    expect(await restoreSession()).toBe(true);
    expect(tokens.get()?.token).toBe("n");
  });

  it("is false without a refresh token", async () => {
    expect(await restoreSession()).toBe(false);
  });
});

describe("refresh timer", () => {
  it("refreshes before expiry and signs out when the refresh token is gone", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(
      mswHttp.post(api("/auth/refresh"), () => HttpResponse.json({ title: "x", status: 401 }, { status: 401 })),
    );
    const gone = vi.fn();
    const off = onSessionExpired(gone);
    tokens.set({ token: "t", expiresAt: soon(61_000), refreshToken: "r" });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(gone).toHaveBeenCalled());
    expect(tokens.get()).toBeNull();
    off();
  });

  it("schedules nothing for legacy, unparsable or far-off tokens", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    tokens.set({ token: "t", expiresAt: soon(60_000) });
    tokens.set({ token: "t", expiresAt: "nope", refreshToken: "r" });
    tokens.set({ token: "t", expiresAt: soon(40 * 24 * 3_600_000), refreshToken: "r" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
