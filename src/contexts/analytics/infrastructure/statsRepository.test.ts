import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, server } from "@/test/server";
import { statsRepository } from "./statsRepository";

describe("statsRepository", () => {
  it("parses /admin/stats and defaults missing counters", async () => {
    server.use(http.get(api("/admin/stats"), () => HttpResponse.json({ data: { posts: 3, users: 2 } })));
    expect(await statsRepository.get()).toEqual({ posts: 3, comments: 0, likes: 0, categories: 0, users: 2 });
  });
});
