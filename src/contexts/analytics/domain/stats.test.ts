import { describe, expect, it } from "vitest";
import { ratios, shareOf, statsSchema, topN } from "./stats";

describe("stats", () => {
  it("parses totals and defaults missing ones to 0", () => {
    expect(statsSchema.parse({ posts: 3, comments: 1 })).toEqual({
      posts: 3,
      comments: 1,
      likes: 0,
      categories: 0,
      users: 0,
    });
  });
  it("computes per-post ratios without dividing by zero", () => {
    expect(ratios({ posts: 4, comments: 2, likes: 7, categories: 1, users: 1 })).toEqual({
      likesPerPost: 1.75,
      commentsPerPost: 0.5,
    });
    expect(ratios({ posts: 0, comments: 2, likes: 7, categories: 0, users: 0 })).toEqual({
      likesPerPost: 0,
      commentsPerPost: 0,
    });
  });
  it("rounds ratios to two decimals", () => {
    expect(ratios({ posts: 3, comments: 1, likes: 1, categories: 0, users: 0 }).likesPerPost).toBe(0.33);
  });
  it("topN keeps the largest counts and folds the rest into other", () => {
    const rows = [
      { name: "a", count: 1 },
      { name: "b", count: 9 },
      { name: "c", count: 5 },
      { name: "d", count: 2 },
    ];
    expect(topN(rows, 2, "other")).toEqual([
      { name: "b", count: 9 },
      { name: "c", count: 5 },
      { name: "other", count: 3 },
    ]);
    expect(topN(rows.slice(0, 2), 5, "other")).toEqual([
      { name: "b", count: 9 },
      { name: "a", count: 1 },
    ]);
    expect(topN([{ name: "z", count: 0 }], 5, "other")).toEqual([]);
  });
  it("shareOf is a whole percentage", () => {
    expect(shareOf(1, 3)).toBe(33);
    expect(shareOf(1, 0)).toBe(0);
  });
});
