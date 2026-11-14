import { describe, expect, it } from "vitest";
import { glossaryFormSchema, parseAliases, toForm, toPayload } from "./glossary";

const ok = { term: "Cache", aliases: "", definition: "Fast store", lang: "" as const };

describe("glossary form", () => {
  it("parses aliases: trimmed, de-duplicated, no blanks", () => {
    expect(parseAliases(" caching, cached ,,caching")).toEqual(["caching", "cached"]);
    expect(parseAliases("")).toEqual([]);
  });

  it("accepts a minimal term", () => {
    expect(glossaryFormSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects blank fields and too long or unknown values", () => {
    for (const bad of [
      { ...ok, term: "  " },
      { ...ok, definition: "" },
      { ...ok, term: "a".repeat(81) },
      { ...ok, definition: "a".repeat(601) },
      { ...ok, lang: "de" },
    ])
      expect(glossaryFormSchema.safeParse(bad).success).toBe(false);
  });

  it("round-trips between form and payload", () => {
    const t = { id: 1, term: "Cache", aliases: ["caching", "cached"], definition: "Fast store", lang: "uz" };
    const form = toForm(t);
    expect(form.aliases).toBe("caching, cached");
    expect(toPayload(form)).toEqual({
      term: "Cache",
      aliases: ["caching", "cached"],
      definition: "Fast store",
      lang: "uz",
    });
  });

  it("falls back to all languages for an unknown lang", () => {
    expect(toForm({ id: 1, term: "a", aliases: [], definition: "b", lang: "de" }).lang).toBe("");
  });
});

describe("aliases", () => {
  it("drops case-insensitive repeats and the term itself", () => {
    expect(parseAliases("Caching, caching, CACHE, cached", "cache")).toEqual(["Caching", "cached"]);
  });
});
