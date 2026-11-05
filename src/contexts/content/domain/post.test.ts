import { describe, expect, it } from "vitest";
import { emptyPostForm, postFormSchema, postSchema, postToForm, toDraftPayload } from "./post";

const now = new Date("2030-01-01T00:00:00Z");
const valid = { ...emptyPostForm(), title: "Hello", body: "text" };

describe("post form rules", () => {
  it("requires a title and trims it", () => {
    expect(postFormSchema(now).safeParse({ ...valid, title: "  " }).success).toBe(false);
    expect(postFormSchema(now).parse({ ...valid, title: " Hi " }).title).toBe("Hi");
  });
  it("limits title by bytes like the server (200)", () => {
    expect(postFormSchema(now).safeParse({ ...valid, title: "ж".repeat(101) }).success).toBe(false);
    expect(postFormSchema(now).safeParse({ ...valid, title: "a".repeat(200) }).success).toBe(true);
  });
  it("scheduled posts need a future publish time", () => {
    const s = postFormSchema(now);
    expect(s.safeParse({ ...valid, status: "scheduled", publishAt: "" }).success).toBe(false);
    expect(s.safeParse({ ...valid, status: "scheduled", publishAt: "2029-01-01T00:00" }).success).toBe(false);
    expect(s.safeParse({ ...valid, status: "scheduled", publishAt: "2031-01-01T00:00" }).success).toBe(true);
  });
  it("validates URLs, tags and labels", () => {
    const s = postFormSchema(now);
    expect(s.safeParse({ ...valid, coverUrl: "ftp://x" }).success).toBe(false);
    expect(s.safeParse({ ...valid, coverUrl: "/api/uploads/a.png" }).success).toBe(true);
    expect(s.safeParse({ ...valid, canonicalUrl: "/relative" }).success).toBe(false);
    expect(s.safeParse({ ...valid, tags: Array.from({ length: 11 }, (_, i) => `t${i}`).join(",") }).success).toBe(
      false,
    );
    expect(s.safeParse({ ...valid, labelIds: [1, 2, 3, 4, 5, 6] }).success).toBe(false);
  });
  it("maps the form to the API draft", () => {
    const f = postFormSchema(now).parse({
      ...valid,
      tags: "Go, go, Docker",
      categoryId: 2,
      labelIds: [3, 1],
      status: "draft",
    });
    expect(toDraftPayload(f)).toEqual({
      title: "Hello",
      subtitle: "",
      body: "text",
      status: "draft",
      publish_at: null,
      category_id: 2,
      cover_url: "",
      canonical_url: "",
      tags: ["go", "docker"],
      label_ids: [1, 3],
    });
    const sch = postFormSchema(now).parse({ ...valid, status: "scheduled", publishAt: "2031-01-01T00:00" });
    expect(toDraftPayload(sch).publish_at).toBe(new Date("2031-01-01T00:00").toISOString());
  });
  it("maps a post back into the form", () => {
    const p = postSchema.parse({
      id: 1,
      title: "T",
      subtitle: "S",
      slug: "t",
      status: "published",
      body: "B",
      reading_time: 1,
      published_at: null,
      author: "a",
      category_id: 0,
      publication_id: 0,
      user_id: 1,
      cover_url: "",
      canonical_url: "",
      tags: ["x"],
      labels: [{ id: 4, name: "L", color: "#ffffff" }],
      likes: 0,
      claps: 0,
      comments_count: 0,
      views: 0,
      created_at: "2030-01-01T00:00:00Z",
      updated_at: "2030-01-01T00:00:00Z",
    });
    expect(postToForm(p)).toMatchObject({ title: "T", tags: "x", labelIds: [4], categoryId: 0, status: "published" });
  });
});
