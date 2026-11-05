import { describe, expect, it } from "vitest";
import { diffStats, revisionDetailSchema } from "./revision";

describe("revisions", () => {
  it("counts added and removed lines", () => {
    expect(
      diffStats([
        { op: "=", text: "a" },
        { op: "-", text: "b" },
        { op: "+", text: "x" },
        { op: "+", text: "y" },
      ]),
    ).toEqual({ added: 2, removed: 1 });
  });
  it("parses a revision detail with diff", () => {
    const r = revisionDetailSchema.parse({
      id: 1,
      post_id: 2,
      version: 3,
      title: "T",
      created_at: "2030-01-01T00:00:00Z",
      diff: { title: [{ op: "=", text: "T" }], subtitle: null, body: [{ op: "+", text: "new" }], added: 1, removed: 0 },
    });
    expect(r.diff.subtitle).toEqual([]);
    expect(r.diff.body?.[0]?.op).toBe("+");
  });
  it("rejects unknown diff ops", () => {
    expect(
      revisionDetailSchema.safeParse({
        id: 1,
        post_id: 2,
        version: 3,
        title: "T",
        created_at: "x",
        diff: { body: [{ op: "?", text: "" }] },
      }).success,
    ).toBe(false);
  });
});
