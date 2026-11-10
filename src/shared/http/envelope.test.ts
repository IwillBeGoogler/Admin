import { describe, expect, it } from "vitest";
import { z } from "zod";
import { pageEnvelope } from "./envelope";

const schema = pageEnvelope(z.object({ id: z.number() }));

describe("pageEnvelope", () => {
  it("maps snake_case meta to camelCase", () => {
    const page = schema.parse({
      data: [{ id: 1 }],
      meta: { page: 2, limit: 10, total: 31, has_more: true, next_cursor: "abc" },
    });
    expect(page.items).toEqual([{ id: 1 }]);
    expect(page.meta).toEqual({ page: 2, limit: 10, total: 31, hasMore: true, nextCursor: "abc" });
  });

  it("falls back when meta is missing: total = item count", () => {
    const page = schema.parse({ data: [{ id: 1 }, { id: 2 }] });
    expect(page.meta).toEqual({ page: 0, limit: 0, total: 2, hasMore: false, nextCursor: undefined });
  });

  it("treats null data as an empty list", () => {
    const page = schema.parse({ data: null });
    expect(page.items).toEqual([]);
    expect(page.meta.total).toBe(0);
  });

  it("turns an empty cursor into undefined", () => {
    expect(schema.parse({ data: [], meta: { next_cursor: "" } }).meta.nextCursor).toBeUndefined();
  });
});
