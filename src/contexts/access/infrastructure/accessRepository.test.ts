import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { problem } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { auditRepository, permissionRepository, roleRepository, sessionRepository } from "./accessRepository";

const sess = {
  id: "s1",
  current: true,
  ip: "1.2.3.4",
  user_agent: "curl",
  created_at: "2030-01-01T00:00:00Z",
  last_seen_at: "2030-01-01T00:00:00Z",
  expires_at: "2030-01-08T00:00:00Z",
};

describe("access repositories", () => {
  it("roles: list, create, grant {code}, revoke, delete", async () => {
    const calls: string[] = [];
    server.use(
      http.get(api("/guard/roles"), () =>
        HttpResponse.json({
          data: [
            {
              name: "admin",
              title: "Administrator",
              description: "",
              is_system: true,
              wildcard: true,
              permissions: [],
            },
          ],
        }),
      ),
      http.post(api("/guard/roles"), async ({ request }) =>
        HttpResponse.json(
          { data: { ...((await request.json()) as object), is_system: false, permissions: [] } },
          { status: 201 },
        ),
      ),
      http.post(api("/guard/roles/editor/permissions"), async ({ request }) => {
        calls.push(`grant ${JSON.stringify(await request.json())}`);
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(api("/guard/roles/editor/permissions/post.delete"), () => {
        calls.push("revoke");
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(api("/guard/roles/editor"), () => {
        calls.push("delete");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    expect((await roleRepository.list())[0]?.wildcard).toBe(true);
    expect(
      (await roleRepository.create({ name: "editor", title: "Editor", description: "", wildcard: false })).name,
    ).toBe("editor");
    await roleRepository.grant("editor", "post.delete");
    await roleRepository.revoke("editor", "post.delete");
    await roleRepository.remove("editor");
    expect(calls).toEqual(['grant {"code":"post.delete"}', "revoke", "delete"]);
  });
  it("system role delete surfaces 403", async () => {
    server.use(http.delete(api("/guard/roles/admin"), () => problem(403, "system role")));
    await expect(roleRepository.remove("admin")).rejects.toMatchObject({ status: 403 });
  });
  it("permissions", async () => {
    server.use(
      http.get(api("/guard/permissions"), () =>
        HttpResponse.json({ data: [{ resource: "audit", action: "read", description: "read" }] }),
      ),
    );
    expect((await permissionRepository.list())[0]?.code).toBe("audit.read");
  });
  it("sessions: mine + revoke, user + revoke all", async () => {
    server.use(
      http.get(api("/me/sessions"), () => HttpResponse.json({ data: [sess] })),
      http.delete(api("/me/sessions/s1"), () => new HttpResponse(null, { status: 204 })),
      http.get(api("/guard/users/3/sessions"), () => HttpResponse.json({ data: [sess] })),
      http.delete(api("/guard/users/3/sessions"), () => new HttpResponse(null, { status: 204 })),
    );
    expect(await sessionRepository.mine()).toHaveLength(1);
    await sessionRepository.revokeMine("s1");
    expect((await sessionRepository.ofUser(3))[0]?.ip).toBe("1.2.3.4");
    await sessionRepository.revokeAllOfUser(3);
  });
  it("audit passes actor_id and limit", async () => {
    server.use(
      http.get(api("/guard/audit"), ({ request }) => {
        const u = new URL(request.url);
        expect(u.searchParams.get("actor_id")).toBe("3");
        expect(u.searchParams.get("limit")).toBe("50");
        return HttpResponse.json({
          data: [
            {
              id: "e",
              occurred_at: "2030-01-01T00:00:00Z",
              actor_id: "3",
              action: "auth.login",
              target: "3",
              success: true,
              metadata: null,
            },
          ],
        });
      }),
    );
    expect((await auditRepository.list({ actor: "3", limit: 50 }))[0]?.action).toBe("auth.login");
  });
});
