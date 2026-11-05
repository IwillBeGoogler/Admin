import { describe, expect, it } from "vitest";
import {
  formatBadgeCount,
  formatDate,
  formatNumber,
  formatRelative,
  localInputToRFC3339,
  rfc3339ToLocalInput,
  toTags,
} from "./format";

describe("format", () => {
  it("toTags trims, lowercases, dedupes", () => {
    expect(toTags(" Go, docker,,GO ")).toEqual(["go", "docker"]);
    expect(toTags("")).toEqual([]);
  });
  it("formatDate handles empty and invalid", () => {
    expect(formatDate(null, "en")).toBe("—");
    expect(formatDate("nope", "en")).toBe("—");
    expect(formatDate("2026-01-02T03:04:05Z", "en")).toMatch(/2026/);
  });
  it("formatNumber groups", () => {
    expect(formatNumber(12345, "en")).toBe("12,345");
  });
  it("round-trips datetime-local", () => {
    const iso = localInputToRFC3339("2030-05-06T07:08");
    expect(iso).toMatch(/^2030-05-0\dT\d\d:08:00\.000Z$/);
    expect(rfc3339ToLocalInput(iso)).toBe("2030-05-06T07:08");
    expect(localInputToRFC3339("")).toBeUndefined();
    expect(localInputToRFC3339("garbage")).toBeUndefined();
    expect(rfc3339ToLocalInput(undefined)).toBe("");
  });
  it("formatRelative picks the largest unit and localizes", () => {
    const now = new Date("2030-01-01T12:00:00Z");
    expect(formatRelative("2030-01-01T09:00:00Z", "en", now)).toBe("3 hr. ago");
    expect(formatRelative("2030-01-03T12:00:00Z", "en", now)).toBe("in 2 days");
    expect(formatRelative("2030-01-01T12:00:00Z", "en", now)).toBe("now");
    expect(formatRelative("2030-01-01T09:00:00Z", "ru", now)).toMatch(/3/);
    expect(formatRelative(null, "en", now)).toBe("—");
    expect(formatRelative("nope", "en", now)).toBe("—");
  });
  it("formatBadgeCount hides zero and caps at 99+", () => {
    expect(formatBadgeCount(0)).toBe("");
    expect(formatBadgeCount(undefined)).toBe("");
    expect(formatBadgeCount(5)).toBe("5");
    expect(formatBadgeCount(120)).toBe("99+");
  });
});
