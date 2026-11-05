import { describe, expect, it } from "vitest";
import { categoryInputSchema, labelInputSchema, normalizeColor, sortTags } from "./taxonomy";

describe("taxonomy rules", () => {
  it("category names: 1-50 chars, trimmed", () => {
    expect(categoryInputSchema.safeParse({ name: " " }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "x".repeat(51) }).success).toBe(false);
    expect(categoryInputSchema.parse({ name: " Go " }).name).toBe("Go");
  });
  it("label: name <= 30, color #rrggbb lowercased", () => {
    expect(labelInputSchema.safeParse({ name: "a", color: "red" }).success).toBe(false);
    expect(labelInputSchema.safeParse({ name: "x".repeat(31), color: "#000000" }).success).toBe(false);
    expect(labelInputSchema.parse({ name: "Hot", color: "#FF0000" })).toEqual({ name: "Hot", color: "#ff0000" });
    expect(normalizeColor("ABCDEF")).toBe("#abcdef");
    expect(normalizeColor("nope")).toBe("nope");
  });
  it("sorts tags by count then name", () => {
    expect(
      sortTags([
        { name: "b", count: 1 },
        { name: "a", count: 1 },
        { name: "c", count: 5 },
      ]).map((t) => t.name),
    ).toEqual(["c", "a", "b"]);
  });
});
