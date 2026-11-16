import { describe, expect, it } from "vitest";
import { deviceKind } from "./access";

describe("deviceKind", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1", "mobile"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0 Mobile Safari/537.36", "mobile"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Safari/604.1", "tablet"],
    ["Mozilla/5.0 (Linux; Android 15; SM-X910) Chrome/140.0 Safari/537.36", "tablet"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) Chrome/140.0 Safari/537.36", "desktop"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/140.0", "desktop"],
    ["Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0", "desktop"],
    ["curl/8.7.1", "cli"],
    ["Go-http-client/2.0", "cli"],
    ["", "unknown"],
    ["SomethingOdd/1.0", "unknown"],
  ])("%s -> %s", (ua, kind) => expect(deviceKind(ua)).toBe(kind));
});

describe("sessionStats", () => {
  it("counts totals, active, ips and devices", async () => {
    const { sessionStats } = await import("./access");
    const now = Date.parse("2026-01-01T12:00:00Z");
    const mk = (ua: string, ip: string, seen: string) => ({
      id: ua + ip,
      current: false,
      ip,
      user_agent: ua,
      created_at: seen,
      last_seen_at: seen,
      expires_at: new Date(Date.parse(seen) + 3_600_000).toISOString(),
    });
    const st = sessionStats(
      [
        mk("curl/8", "1.1.1.1", "2026-01-01T11:50:00Z"),
        mk("curl/8", "1.1.1.1", "2026-01-01T09:00:00Z"),
        mk("Mozilla/5.0 (Macintosh)", "2.2.2.2", "2026-01-01T11:59:00Z"),
      ],
      now,
    );
    expect(st).toEqual({
      total: 3,
      active: 2,
      uniqueIps: 2,
      byDevice: [
        ["cli", 2],
        ["desktop", 1],
      ],
      started24h: 3,
      expiringSoon: 2,
      avgAgeMs: (10 * 60_000 + 3 * 3_600_000 + 60_000) / 3,
      byBrowser: [
        ["CLI", 2],
        ["Other", 1],
      ],
      byOs: [
        ["Other", 2],
        ["macOS", 1],
      ],
    });
  });
});
