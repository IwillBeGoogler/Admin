import { describe, expect, it } from "vitest";
import { funnelRates, heatRow, productReportSchema, readTime, stickiness } from "./product";

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

describe("product analytics edge cases", () => {
  it("funnelRates treats missing steps as zero and avoids dividing by zero", () => {
    const rates = funnelRates([{ step: "signup", count: 5 }] as never);
    expect(rates.map((r) => r.count)).toEqual([0, 0, 5, 0]);
    expect(rates.every((r) => r.rate === 0)).toBe(true);
  });
  it("stickiness is 0 with no MAU or no DAU", () => {
    expect(stickiness({ mau: 0, dau: [] } as never)).toBe(0);
    expect(stickiness({ mau: 10, dau: [] } as never)).toBe(0);
  });
});

describe("heatRow", () => {
  it("reads one Monday-first weekday out of Sunday-first cells and ignores bad hours", () => {
    const cells = [
      { dow: 0, hour: 5, count: 3 },
      { dow: 1, hour: 23, count: 2 },
      { dow: 2, hour: 24, count: 9 },
    ];
    expect(heatRow(cells, 6)[5]).toBe(3);
    expect(heatRow(cells, 0)[23]).toBe(2);
    expect(heatRow(cells, 1).reduce((a, b) => a + b, 0)).toBe(0);
    expect(heatRow(cells, 3)).toHaveLength(24);
  });
});
