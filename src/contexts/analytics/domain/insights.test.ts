import { describe, expect, it } from "vitest";
import {
  activityFromAudit,
  calendarHeat,
  cumulative,
  insightsSchema,
  insightsSearchSchema,
  mergeDays,
  pareto,
  share,
  weekOverWeek,
} from "./insights";

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

describe("chart helpers", () => {
  const d = (n: number, c = 1) =>
    Array.from({ length: n }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, count: c }));

  it("cumulative ends at the given total", () => {
    expect(cumulative(d(3), 10).map((x) => x.count)).toEqual([8, 9, 10]);
  });

  it("weekOverWeek compares the last 7 days to the 7 before", () => {
    const days = [...d(7, 2), ...d(7, 3)].map((x, i) => ({ ...x, day: `2026-10-${String(i + 1).padStart(2, "0")}` }));
    expect(weekOverWeek(days)).toBe(50);
    expect(weekOverWeek(d(5))).toBeNull();
    expect(weekOverWeek([...d(7, 0), ...d(7, 4)])).toBeNull();
  });

  it("pareto sorts and accumulates", () => {
    const r = pareto([
      { key: "b", count: 1 },
      { key: "a", count: 3 },
      { key: "z", count: 0 },
    ]);
    expect(r).toEqual([
      { name: "a", count: 3, cum: 75 },
      { name: "b", count: 1, cum: 100 },
    ]);
  });

  it("pareto breaks ties by name", () => {
    expect(
      pareto([
        { key: "b", count: 2 },
        { key: "a", count: 2 },
      ]).map((r) => r.name),
    ).toEqual(["a", "b"]);
  });

  it("calendarHeat groups days into Monday-first weeks", () => {
    const w = calendarHeat([
      { day: "2026-10-05", count: 2 },
      { day: "2026-10-11", count: 4 },
      { day: "2026-10-12", count: 1 },
    ]);
    expect(w).toHaveLength(2);
    expect(w[0]?.values).toEqual([2, 0, 0, 0, 0, 0, 4]);
    expect(w[1]?.values[0]).toBe(1);
  });

  it("share handles an empty whole", () => {
    expect(share(1, 4)).toBe(25);
    expect(share(1, 0)).toBe(0);
  });
});
