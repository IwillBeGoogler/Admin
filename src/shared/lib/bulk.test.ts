import { describe, expect, it } from "vitest";
import { runBulk } from "./bulk";

describe("runBulk", () => {
  it("splits results into ok and failed and never rejects", async () => {
    const r = await runBulk([1, 2, 3, 4], async (n) => {
      if (n % 2 === 0) throw new Error("even");
    });
    expect(r).toEqual({ ok: [1, 3], failed: [2, 4] });
  });
  it("keeps at most `limit` calls in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    await runBulk(
      Array.from({ length: 12 }, (_, i) => i),
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((res) => setTimeout(res, 1));
        inFlight--;
      },
      4,
    );
    expect(peak).toBe(4);
  });
  it("handles an empty list", async () => {
    expect(await runBulk([], async () => {})).toEqual({ ok: [], failed: [] });
  });
});
