import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { signIn } from "@/test/fixtures";
import { renderRouted, renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import { AuditPage } from "./AuditPage";
import { PoliciesPage } from "./PoliciesPage";
import { RoleDetailPage, RolesPage } from "./RolesPage";
import { SessionDetailPage, SessionsPage } from "./SessionsPage";

const rolesHandlers = (perms: { resource: string; action: string }[], calls: string[] = []) => [
  http.get(api("/guard/roles"), () =>
    HttpResponse.json({
      data: [
        { name: "admin", title: "Administrator", description: "", is_system: true, wildcard: true, permissions: [] },
        { name: "editor", title: "Editor", description: "", is_system: false, wildcard: false, permissions: perms },
      ],
    }),
  ),
  http.get(api("/guard/permissions"), () =>
    HttpResponse.json({
      data: [
        { resource: "post", action: "delete", description: "" },
        { resource: "audit", action: "read", description: "read log" },
      ],
    }),
  ),
  http.post(api("/guard/roles/editor/permissions"), async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    calls.push(`+${code}`);
    const [resource = "", action = ""] = code.split(".");
    perms.push({ resource, action });
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(api("/guard/roles/editor/permissions/post.delete"), () => {
    calls.push("-post.delete");
    perms.splice(
      perms.findIndex((p) => p.action === "delete"),
      1,
    );
    return new HttpResponse(null, { status: 204 });
  }),
];

describe("RolesPage", () => {
  it("lists roles and opens one", async () => {
    signIn();
    server.use(...rolesHandlers([{ resource: "post", action: "delete" }]));
    const { user, router } = await renderRouted(<RolesPage />, { path: "/roles" });
    expect(await screen.findByText("All permissions")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "editor" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/roles/editor"));
  });

  it("grants and revokes permissions on the detail page", async () => {
    signIn();
    const calls: string[] = [];
    server.use(...rolesHandlers([{ resource: "post", action: "delete" }], calls));
    const { user } = await renderRouted(<RoleDetailPage name="editor" />, { path: "/roles/editor" });
    expect(await screen.findByRole("button", { name: "Delete: editor" })).toBeInTheDocument();
    const select = await screen.findByLabelText("Choose a permission");
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(2));
    await user.selectOptions(select, "audit.read");
    await user.click(screen.getByRole("button", { name: "Grant" }));
    expect(await screen.findByText("audit.read")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke: post.delete" }));
    await waitFor(() => expect(calls).toEqual(["+audit.read", "-post.delete"]));
  });

  it("system roles cannot be deleted", async () => {
    signIn();
    server.use(...rolesHandlers([]));
    await renderRouted(<RoleDetailPage name="admin" />, { path: "/roles/admin" });
    expect(await screen.findByText("All permissions")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete: admin" })).toBeNull();
  });

  it("validates role names like Guard", async () => {
    signIn();
    server.use(
      http.get(api("/guard/roles"), () => HttpResponse.json({ data: [] })),
      http.get(api("/guard/permissions"), () => HttpResponse.json({ data: [] })),
    );
    const { user } = await renderRouted(<RolesPage />, { path: "/roles" });
    await user.click(await screen.findByRole("button", { name: "New role" }));
    await user.type(await screen.findByLabelText("Name"), "Bad Name");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Use lowercase letters, digits, _ or -")).toBeInTheDocument();
  });
});

const session = (id: string, current = false) => ({
  id,
  current,
  ip: "1.1.1.1",
  user_agent: `ua-${id}`,
  created_at: "2030-01-01T00:00:00Z",
  last_seen_at: "2030-01-01T00:00:00Z",
  expires_at: "2030-01-08T00:00:00Z",
});

describe("SessionsPage", () => {
  it("revokes another of my sessions and all sessions of a user", async () => {
    signIn();
    let revokedAll = false;
    const revokeMine = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(
      http.get(api("/me/sessions"), () => HttpResponse.json({ data: [session("a", true), session("b")] })),
      http.delete(api("/me/sessions/b"), revokeMine),
      http.get(api("/guard/users/7/sessions"), () => HttpResponse.json({ data: revokedAll ? [] : [session("x")] })),
      http.delete(api("/guard/users/7/sessions"), () => {
        revokedAll = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<SessionsPage />, { path: "/sessions" });
    expect(await screen.findByText("This session")).toBeInTheDocument();
    const revokeButtons = screen.getAllByRole("button", { name: "Revoke" });
    expect(revokeButtons).toHaveLength(1);
    await user.click(revokeButtons[0] as HTMLElement);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revoke session" }));
    await waitFor(() => expect(revokeMine).toHaveBeenCalled());
    await user.type(screen.getByLabelText("User ID"), "7");
    await user.click(screen.getByRole("button", { name: "Look up" }));
    expect(await screen.findByText("ua-x")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke all" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revoke all sessions" }),
    );
    await waitFor(() => expect(revokedAll).toBe(true));
  });

  it("opens a session and revokes it from the detail page", async () => {
    signIn();
    const revoke = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(
      http.get(api("/me/sessions"), () => HttpResponse.json({ data: [session("a", true), session("b")] })),
      http.delete(api("/me/sessions/b"), revoke),
    );
    const { user, router } = await renderRouted(<SessionsPage />, { path: "/sessions" });
    await user.click(await screen.findByRole("link", { name: "ua-b" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sessions/b"));

    const detail = await renderRouted(<SessionDetailPage id="b" />, { path: "/sessions/b" });
    const page = within(detail.container);
    expect(await page.findByText("Device type")).toBeInTheDocument();
    await detail.user.click(page.getByRole("button", { name: "Revoke" }));
    await detail.user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revoke session" }),
    );
    await waitFor(() => expect(revoke).toHaveBeenCalled());
    await waitFor(() => expect(detail.router.state.location.pathname).toBe("/sessions"));
  });
});

describe("PoliciesPage", () => {
  it("lists, creates, toggles and deletes ABAC policies", async () => {
    signIn();
    type P = Record<string, unknown> & { id: string; enabled: boolean };
    let policies: P[] = [
      {
        id: "p1",
        name: "authors edit own posts",
        resource: "post",
        action: "update",
        effect: "allow",
        priority: 100,
        enabled: true,
        root: {
          operator: "and",
          negate: false,
          conditions: [{ field: "resource.owner_id", operator: "eq", value: ["$user.id"] }],
          groups: null,
        },
      },
    ];
    const created: unknown[] = [];
    server.use(
      http.get(api("/guard/roles"), () =>
        HttpResponse.json({
          data: [
            { name: "user", is_system: true, permissions: [] },
            { name: "moderator", permissions: [] },
          ],
        }),
      ),
      http.get(api("/guard/policies"), () => HttpResponse.json({ data: policies })),
      http.post(api("/guard/policies"), async ({ request }) => {
        const body = (await request.json()) as P;
        created.push(body);
        const p = { ...body, id: "p2" };
        policies = [...policies, p];
        return HttpResponse.json({ data: p }, { status: 201 });
      }),
      http.put(api("/guard/policies/p1"), async ({ request }) => {
        const body = (await request.json()) as P;
        policies = policies.map((p) => (p.id === "p1" ? { ...body, id: "p1" } : p));
        return HttpResponse.json({ data: { ...body, id: "p1" } });
      }),
      http.delete(api("/guard/policies/p1"), () => {
        policies = policies.filter((p) => p.id !== "p1");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderUI(<PoliciesPage />);
    expect(await screen.findByText("resource.owner_id = $user.id")).toBeInTheDocument();
    expect(screen.getByText("everyone")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Enabled: authors edit own posts" }));
    await waitFor(() => expect(policies[0]?.enabled).toBe(false));

    await user.click(screen.getByRole("button", { name: "New policy" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Name"), "no banned");
    await user.type(dialog.getByLabelText(/^Resource/), "*");
    await user.type(dialog.getByLabelText(/^Action/), "*");
    await user.selectOptions(dialog.getByLabelText("Effect"), "deny");
    await user.click(await dialog.findByRole("checkbox", { name: "moderator" }));
    await user.click(dialog.getByRole("button", { name: "Add condition" }));
    await user.type(dialog.getByLabelText("Field 1"), "user.status");
    await user.selectOptions(dialog.getByLabelText("Operator 1"), "in");
    await user.type(dialog.getByLabelText("Value 1"), "banned, suspended");
    await user.click(dialog.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(created[0]).toMatchObject({
        name: "no banned",
        resource: "*",
        action: "*",
        effect: "deny",
        roles: ["moderator"],
        root: {
          operator: "and",
          conditions: [{ field: "user.status", operator: "in", value: ["banned", "suspended"] }],
        },
      }),
    );

    await user.click(await screen.findByRole("button", { name: "Delete: authors edit own posts" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(policies.map((p) => p.id)).toEqual(["p2"]));
  });
});

describe("AuditPage", () => {
  it("renders events and filters by actor", async () => {
    signIn();
    server.use(
      http.get(api("/guard/audit"), () =>
        HttpResponse.json({
          data: [
            {
              id: "1",
              occurred_at: "2030-01-01T00:00:00Z",
              actor_id: "3",
              action: "auth.login",
              target: "3",
              success: false,
              ip: "9.9.9.9",
              metadata: { k: 1 },
            },
          ],
        }),
      ),
    );
    const onSearchChange = vi.fn();
    const { user } = renderUI(<AuditPage search={{ limit: 100 }} onSearchChange={onSearchChange} />);
    expect(await screen.findByText("auth.login")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Actor ID"), "3");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearchChange).toHaveBeenCalledWith({ limit: 100, actor: "3" });
  });
});
