import { describe, expect, it } from "vitest";
import { funnelRates, productReportSchema, readTime, stickiness } from "./product";

describe("product analytics", () => {
  const r = productReportSchema.parse({
    days: 2,
    dau: [
      { day: "2026-10-05", count: 4 },
      { day: "2026-10-06", count: 10 },
    ],
    mau: 40,
    funnel: [
      { step: "visit", count: 200 },
      { step: "signup_open", count: 50 },
      { step: "signup", count: 10 },
      { step: "first_publish", count: 0 },
    ],
  });

  it("computes step conversion and stickiness", () => {
    expect(funnelRates(r.funnel).map((s) => s.rate)).toEqual([0, 25, 20, 0]);
    expect(stickiness(r)).toBe(25);
    expect(r.retention).toEqual({ cohort: 0, d1: 0, d7: 0, d30: 0 });
  });

  it("formats read time", () => {
    expect(readTime(42)).toBe("42s");
    expect(readTime(125.4)).toBe("2m 05s");
  });
});
