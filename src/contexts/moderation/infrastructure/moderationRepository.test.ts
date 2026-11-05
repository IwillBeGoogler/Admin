import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { page, problem, report } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { commentRepository, reportRepository } from "./moderationRepository";

describe("reportRepository", () => {
  it("filters by status, omitting it for all", async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(api("/admin/reports"), ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("status"));
        return page([report()]);
      }),
    );
    await reportRepository.list({ status: "open" }, { limit: 20 });
    await reportRepository.list({ status: "all" }, { page: 2 });
    expect(seen).toEqual(["open", null]);
  });
  it("decides with {status, remove_content}", async () => {
    server.use(
      http.put(api("/admin/reports/7"), async ({ request }) => {
        expect(await request.json()).toEqual({ status: "resolved", remove_content: true });
        return HttpResponse.json({ data: report({ status: "resolved" }) });
      }),
    );
    expect((await reportRepository.decide(7, { status: "resolved", remove_content: true })).status).toBe("resolved");
  });
  it("409 when already decided", async () => {
    server.use(http.put(api("/admin/reports/7"), () => problem(409, "report already decided")));
    await expect(reportRepository.decide(7, { status: "dismissed", remove_content: false })).rejects.toMatchObject({
      status: 409,
      isConflict: true,
    });
  });
});

describe("commentRepository", () => {
  it("lists and deletes", async () => {
    server.use(
      http.get(api("/admin/comments"), () =>
        page([
          {
            id: 1,
            post_id: 1,
            parent_id: 0,
            user_id: 0,
            author: "Anonymous",
            text: "ok",
            created_at: "2030-01-01T00:00:00Z",
            likes: 0,
          },
        ]),
      ),
      http.delete(api("/comments/1"), () => new HttpResponse(null, { status: 204 })),
    );
    expect((await commentRepository.list({})).items).toHaveLength(1);
    await commentRepository.remove(1);
  });
});
