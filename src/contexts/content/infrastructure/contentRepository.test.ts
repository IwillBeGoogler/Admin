import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { problem } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { categoryRepository, labelRepository, postRepository, tagRepository } from "./contentRepository";

const post = (over: Record<string, unknown> = {}) => ({
  id: 4,
  title: "QA probe",
  subtitle: "",
  slug: "qa",
  status: "published",
  body: "body",
  reading_time: 1,
  published_at: "2026-10-05T14:59:34Z",
  author: "admin",
  category_id: 1,
  publication_id: 0,
  user_id: 3,
  cover_url: "",
  canonical_url: "",
  tags: ["qa"],
  labels: [],
  likes: 0,
  claps: 0,
  comments_count: 0,
  views: 0,
  liked: false,
  my_claps: 0,
  bookmarked: false,
  created_at: "2026-10-05T14:59:34Z",
  updated_at: "2026-10-05T14:59:34Z",
  ...over,
});

describe("postRepository", () => {
  it("lists public posts with filters and cursor", async () => {
    server.use(
      http.get(api("/posts"), ({ request }) => {
        const u = new URL(request.url);
        expect(u.searchParams.get("q")).toBe("go");
        expect(u.searchParams.get("category")).toBe("2");
        expect(u.searchParams.get("cursor")).toBe("abc");
        expect(u.searchParams.has("tag")).toBe(false);
        return HttpResponse.json({ data: [post()], meta: { limit: 20, total: 3, has_more: true, next_cursor: "n2" } });
      }),
    );
    const p = await postRepository.list({ q: "go", category: 2 }, { cursor: "abc" });
    expect(p.items[0]?.title).toBe("QA probe");
    expect(p.meta.nextCursor).toBe("n2");
  });

  it("lists drafts via /admin/posts", async () => {
    server.use(
      http.get(api("/admin/posts"), ({ request }) => {
        expect(new URL(request.url).searchParams.get("status")).toBe("draft");
        return HttpResponse.json({
          data: [post({ status: "draft" })],
          meta: { page: 1, limit: 20, total: 1, has_more: false },
        });
      }),
    );
    expect((await postRepository.list({ source: "draft" }, {})).items[0]?.status).toBe("draft");
  });

  it("creates, updates and deletes", async () => {
    server.use(
      http.post(api("/posts"), async ({ request }) =>
        HttpResponse.json({ data: post({ ...((await request.json()) as object), id: 9 }) }, { status: 201 }),
      ),
      http.put(api("/posts/9"), async ({ request }) =>
        HttpResponse.json({ data: post({ ...((await request.json()) as object), id: 9 }) }),
      ),
      http.delete(api("/posts/9"), () => new HttpResponse(null, { status: 204 })),
    );
    const d = {
      title: "N",
      subtitle: "",
      body: "b",
      status: "draft" as const,
      publish_at: null,
      category_id: 0,
      cover_url: "",
      canonical_url: "",
      tags: [],
      label_ids: [],
    };
    expect((await postRepository.create(d)).id).toBe(9);
    expect((await postRepository.update(9, { ...d, title: "M" })).title).toBe("M");
    await expect(postRepository.remove(9)).resolves.toBeUndefined();
  });

  it("propagates 404 problems", async () => {
    server.use(http.get(api("/posts/1"), () => problem(404, "post not found")));
    await expect(postRepository.get(1)).rejects.toMatchObject({ status: 404, message: "post not found" });
  });

  it("revisions: list, detail, restore", async () => {
    server.use(
      http.get(api("/posts/4/revisions"), () =>
        HttpResponse.json({
          data: [
            {
              id: 1,
              post_id: 4,
              version: 1,
              title: "Old",
              subtitle: "",
              editor_id: 3,
              editor: "admin",
              created_at: "2026-10-05T00:00:00Z",
            },
          ],
        }),
      ),
      http.get(api("/posts/4/revisions/1"), () =>
        HttpResponse.json({
          data: {
            id: 1,
            post_id: 4,
            version: 1,
            title: "Old",
            body: "x",
            created_at: "2026-10-05T00:00:00Z",
            diff: {
              title: [
                { op: "-", text: "Old" },
                { op: "+", text: "New" },
              ],
              subtitle: [],
              body: [],
              added: 1,
              removed: 1,
            },
          },
        }),
      ),
      http.post(api("/posts/4/revisions/1/restore"), () => HttpResponse.json({ data: post() })),
    );
    expect(await postRepository.revisions(4)).toHaveLength(1);
    expect((await postRepository.revision(4, 1)).diff.added).toBe(1);
    await expect(postRepository.restore(4, 1)).resolves.toBeUndefined();
  });

  it("empty revision list may be null", async () => {
    server.use(http.get(api("/posts/4/revisions"), () => HttpResponse.json({ data: null })));
    expect(await postRepository.revisions(4)).toEqual([]);
  });
});

describe("taxonomy repositories", () => {
  it("categories CRUD", async () => {
    server.use(
      http.get(api("/categories"), () => HttpResponse.json({ data: [{ id: 1, name: "Docker", count: 3 }] })),
      http.post(api("/categories"), async ({ request }) =>
        HttpResponse.json({ data: { id: 2, ...((await request.json()) as object), count: 0 } }, { status: 201 }),
      ),
      http.delete(api("/categories/2"), () => new HttpResponse(null, { status: 204 })),
    );
    expect((await categoryRepository.list())[0]?.count).toBe(3);
    expect((await categoryRepository.create("Go")).name).toBe("Go");
    await categoryRepository.remove(2);
  });
  it("labels send {name,color}", async () => {
    server.use(
      http.post(api("/labels"), async ({ request }) => {
        expect(await request.json()).toEqual({ name: "Hot", color: "#ff0000" });
        return HttpResponse.json({ data: { id: 1, name: "Hot", color: "#ff0000" } }, { status: 201 });
      }),
      http.get(api("/labels"), () => HttpResponse.json({ data: [] })),
    );
    expect((await labelRepository.create({ name: "Hot", color: "#ff0000" })).id).toBe(1);
    expect(await labelRepository.list()).toEqual([]);
  });
  it("tags", async () => {
    server.use(http.get(api("/tags"), () => HttpResponse.json({ data: [{ name: "go", count: 1 }] })));
    expect(await tagRepository.list()).toEqual([{ name: "go", count: 1 }]);
  });
});
