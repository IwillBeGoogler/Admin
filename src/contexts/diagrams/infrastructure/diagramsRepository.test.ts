import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { diagramProject, diagramTemplate, page, problem } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { diagramRepository, templateRepository } from "./diagramsRepository";

describe("diagramRepository", () => {
  it("reads stats from the data envelope", async () => {
    server.use(
      http.get(api("/admin/diagrams/stats"), () =>
        HttpResponse.json({
          data: {
            projects: 2,
            files: 5,
            files_by_kind: { sdd: 2, erd: 1, uml: 1, board: 1 },
            active_editors_7d: 4,
            storage_bytes: 2048,
          },
        }),
      ),
    );
    const s = await diagramRepository.stats();
    expect(s.files_by_kind.erd).toBe(1);
    expect(s.storage_bytes).toBe(2048);
  });

  it("lists projects with q, owner and cursor", async () => {
    server.use(
      http.get(api("/admin/diagrams/projects"), ({ request }) => {
        const u = new URL(request.url).searchParams;
        expect([u.get("q"), u.get("owner"), u.get("limit")]).toEqual(["pay", "ali", "20"]);
        return u.get("cursor") === "c1"
          ? page([diagramProject({ id: "p2" })])
          : page([diagramProject()], { has_more: true, next_cursor: "c1" });
      }),
    );
    const first = await diagramRepository.projects({ q: "pay", owner: "ali" }, { limit: 20 });
    expect(first.meta.nextCursor).toBe("c1");
    const second = await diagramRepository.projects({ q: "pay", owner: "ali" }, { limit: 20, cursor: "c1" });
    expect(second.items[0]?.id).toBe("p2");
  });

  it("deletes, revokes and surfaces problem details", async () => {
    const calls: string[] = [];
    server.use(
      http.delete(api("/admin/diagrams/projects/p1"), () => {
        calls.push("delete");
        return new HttpResponse(null, { status: 204 });
      }),
      http.post(api("/admin/diagrams/shares/s1/revoke"), () => {
        calls.push("revoke");
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(api("/admin/diagrams/projects/gone"), () => problem(404, "project not found")),
    );
    await diagramRepository.deleteProject("p1");
    await diagramRepository.revokeShare("s1");
    expect(calls).toEqual(["delete", "revoke"]);
    await expect(diagramRepository.deleteProject("gone")).rejects.toMatchObject({ status: 404 });
  });
});

describe("templateRepository", () => {
  it("creates, patches and deletes", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.get(api("/admin/diagrams/templates"), () => page([diagramTemplate()])),
      http.post(api("/admin/diagrams/templates"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: diagramTemplate({ id: "t2" }) }, { status: 201 });
      }),
      http.patch(api("/admin/diagrams/templates/t2"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: diagramTemplate({ id: "t2", published: false }) });
      }),
      http.delete(api("/admin/diagrams/templates/t2"), () => new HttpResponse(null, { status: 204 })),
      http.post(api("/admin/diagrams/templates/reorder"), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json([]);
      }),
    );
    expect(await templateRepository.list()).toHaveLength(1);
    const c = await templateRepository.create({
      title: "x",
      kind: "db",
      description: "",
      file_id: "f2",
      published: true,
      position: 2,
    });
    expect(c.id).toBe("t2");
    expect((await templateRepository.update("t2", { published: false })).published).toBe(false);
    await templateRepository.remove("t2");
    await templateRepository.reorder(["t2", "t1"]);
    expect(bodies).toEqual([
      { title: "x", kind: "db", description: "", file_id: "f2", published: true, position: 2 },
      { published: false },
      { ids: ["t2", "t1"] },
    ]);
  });
});
