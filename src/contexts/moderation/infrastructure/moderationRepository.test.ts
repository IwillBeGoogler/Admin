import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { clientError, feedback, page, problem, report } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { clientErrorRepository, commentRepository, feedbackRepository, reportRepository } from "./moderationRepository";

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

describe("feedbackRepository", () => {
  it("omits status/kind when all, sends them otherwise", async () => {
    const seen: (string | null)[][] = [];
    server.use(
      http.get(api("/admin/feedback"), ({ request }) => {
        const q = new URL(request.url).searchParams;
        seen.push([q.get("status"), q.get("kind")]);
        return page([feedback()]);
      }),
    );
    await feedbackRepository.list({ status: "all", kind: "all" }, {});
    await feedbackRepository.list({ status: "open", kind: "bug" } as never, {});
    expect(seen).toEqual([
      [null, null],
      ["open", "bug"],
    ]);
  });
  it("decides with {status}", async () => {
    server.use(
      http.put(api("/admin/feedback/3"), async ({ request }) => {
        expect(await request.json()).toEqual({ status: "resolved" });
        return HttpResponse.json({ data: feedback({ status: "resolved" }) });
      }),
    );
    expect((await feedbackRepository.decide(3, "resolved")).status).toBe("resolved");
  });
});

describe("clientErrorRepository", () => {
  it("omits status when all and decides with {status}", async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(api("/admin/client-errors"), ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("status"));
        return page([clientError()]);
      }),
      http.put(api("/admin/client-errors/4"), async ({ request }) => {
        expect(await request.json()).toEqual({ status: "resolved" });
        return HttpResponse.json({ data: clientError({ status: "resolved" }) });
      }),
    );
    await clientErrorRepository.list({ status: "all" }, {});
    await clientErrorRepository.list({ status: "open" } as never, {});
    expect(seen).toEqual([null, "open"]);
    expect((await clientErrorRepository.decide(4, "resolved" as never)).status).toBe("resolved");
  });
});
