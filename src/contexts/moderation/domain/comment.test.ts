import { describe, expect, it } from "vitest";
import { commentSchema, excerpt } from "./comment";

describe("comments", () => {
  it("parses anonymous comments", () => {
    expect(
      commentSchema.parse({
        id: 1,
        post_id: 1,
        parent_id: 0,
        user_id: 0,
        author: "Anonymous",
        text: "ok",
        created_at: "x",
        likes: 0,
      }).author,
    ).toBe("Anonymous");
  });
  it("excerpts", () => {
    expect(excerpt("a\n\n b")).toBe("a b");
    expect(excerpt("x".repeat(10), 5)).toBe("xxxx…");
  });
});
