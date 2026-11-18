import { describe, expect, it } from "vitest";
import { activityFromAudit, insightsSchema, insightsSearchSchema, mergeDays } from "./insights";

describe("insights", () => {
  it("defaults missing sections and null lists", () => {
    const r = insightsSchema.parse({ days: 7, posts: { created: null }, users: {}, diagrams: {}, moderation: {} });
    expect(r.posts.created).toEqual([]);
    expect(r.users.total).toBe(0);
  });

  it("search params fall back to posts / 30 days", () => {
    expect(insightsSearchSchema.parse({})).toEqual({ tab: "posts", days: 30 });
    expect(insightsSearchSchema.parse({ tab: "nope", days: "5" })).toEqual({ tab: "posts", days: 30 });
    expect(insightsSearchSchema.parse({ tab: "users", days: "90" })).toEqual({ tab: "users", days: 90 });
  });

  it("mergeDays joins series by day, zero where missing", () => {
    expect(
      mergeDays({
        a: [{ day: "2026-11-01", count: 2 }],
        b: [
          { day: "2026-11-01", count: 1 },
          { day: "2026-11-02", count: 4 },
        ],
      }),
    ).toEqual([
      { day: "2026-11-01", a: 2, b: 1 },
      { day: "2026-11-02", a: 0, b: 4 },
    ]);
  });

  it("activityFromAudit buckets events inside the window only", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    const a = activityFromAudit(
      [
        { occurred_at: "2026-11-10T01:00:00Z", action: "auth.login", success: true, actor_id: "1" },
        { occurred_at: "2026-11-10T02:00:00Z", action: "auth.login", success: false, actor_id: "2" },
        { occurred_at: "2026-10-01T02:00:00Z", action: "old", success: true, actor_id: "9" },
      ],
      3,
      now,
    );
    expect(a.total).toBe(2);
    expect(a.failed).toBe(1);
    expect(a.logins).toBe(2);
    expect(a.perDay).toHaveLength(3);
    expect(a.perDay.at(-1)).toEqual({ day: "2026-11-10", ok: 1, failed: 1 });
    expect(a.actions).toEqual([{ key: "auth.login", count: 2 }]);
  });
});
