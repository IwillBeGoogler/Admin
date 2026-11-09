import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { problem, signIn } from "@/test/fixtures";
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

describe("RolesPage edges", () => {
  const role = (o: Record<string, unknown> = {}) => ({
    name: "editor",
    title: "",
    description: "Edits things",
    is_system: false,
    wildcard: false,
    permissions: [{ resource: "post", action: "delete" }],
    ...o,
  });
  const perms = () =>
    http.get(api("/guard/permissions"), () =>
      HttpResponse.json({ data: [{ resource: "audit", action: "read", description: "" }] }),
    );

  it("clicking a row opens the role; description shows when there is no title", async () => {
    signIn();
    server.use(
      http.get(api("/guard/roles"), () => HttpResponse.json({ data: [role(), role({ name: "x", description: "" })] })),
    );
    const { user, router } = await renderRouted(<RolesPage />, { path: "/roles" });
    expect(await screen.findByText("Edits things")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    await user.click(screen.getByText("Edits things"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/roles/editor"));
  });

  it("creates a role and navigates to it; failure shows inline", async () => {
    signIn();
    let n = 0;
    server.use(
      http.get(api("/guard/roles"), () => HttpResponse.json({ data: [] })),
      http.post(api("/guard/roles"), () =>
        ++n === 1 ? problem(409, "role exists") : HttpResponse.json({ data: role() }),
      ),
    );
    const { user, router } = await renderRouted(<RolesPage />, { path: "/roles" });
    await user.click(await screen.findByRole("button", { name: "New role" }));
    await user.type(await screen.findByLabelText("Name"), "editor");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("role exists");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/roles/editor"));
  });

  it("detail: not found, then delete confirmed by typing the name", async () => {
    signIn();
    let deleted = false;
    server.use(
      http.get(api("/guard/roles"), () => HttpResponse.json({ data: [role()] })),
      http.get(api("/guard/roles/editor/policies"), () => HttpResponse.json({ data: [] })),
      perms(),
      http.delete(api("/guard/roles/editor"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, router } = await renderRouted(<RoleDetailPage name="editor" />, { path: "/roles/editor" });
    await user.click(await screen.findByRole("button", { name: "Delete: editor" }));
    const dlg = await screen.findByRole("alertdialog");
    await user.type(within(dlg).getByRole("textbox"), "editor");
    await user.click(
      within(dlg)
        .getAllByRole("button")
        .find((b) => b.textContent !== "Cancel") as HTMLElement,
    );
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(router.state.location.pathname).toBe("/roles"));
  });

  it("detail: unknown role and load errors", async () => {
    signIn();
    server.use(http.get(api("/guard/roles"), () => HttpResponse.json({ data: [role()] })));
    const a = await renderRouted(<RoleDetailPage name="ghost" />, { path: "/roles/ghost" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Page not found");
    a.unmount();
    server.use(http.get(api("/guard/roles"), () => problem(500, "db down")));
    await renderRouted(<RoleDetailPage name="editor" />, { path: "/roles/editor" });
    expect(await screen.findByRole("alert")).toHaveTextContent("db down");
  });

  it("detail: grant and revoke failures are reported; role policies are listed", async () => {
    signIn();
    server.use(
      http.get(api("/guard/roles"), () => HttpResponse.json({ data: [role({ title: "Editor" })] })),
      perms(),
      http.post(api("/guard/roles/editor/permissions"), () => problem(500, "grant failed")),
      http.delete(api("/guard/roles/editor/permissions/post.delete"), () => problem(500, "revoke failed")),
      http.get(api("/guard/roles/editor/policies"), () =>
        HttpResponse.json({
          data: [
            {
              id: "a",
              name: "deny it",
              resource: "post",
              action: "delete",
              effect: "deny",
              priority: 1,
              enabled: false,
            },
            {
              id: "b",
              name: "allow it",
              resource: "post",
              action: "update",
              effect: "allow",
              priority: 2,
              enabled: true,
              roles: ["editor"],
              root: {
                operator: "and",
                negate: false,
                conditions: [{ field: "a", operator: "eq", value: ["1"] }],
                groups: [],
              },
            },
          ],
        }),
      ),
    );
    const { user } = await renderRouted(<RoleDetailPage name="editor" />, { path: "/roles/editor" });
    expect(await screen.findByText("deny it")).toBeInTheDocument();
    expect(screen.getByText("allow it")).toBeInTheDocument();
    const select = await screen.findByLabelText("Choose a permission");
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(2));
    await user.selectOptions(select, "audit.read");
    await user.click(screen.getByRole("button", { name: "Grant" }));
    expect(await screen.findByText(/grant failed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke: post.delete" }));
    expect(await screen.findByText(/revoke failed/)).toBeInTheDocument();
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

describe("Sessions edges", () => {
  it("row click opens detail; blank agent/ip show dashes; invalid user id is ignored; user lookup rows link with ?user", async () => {
    signIn();
    server.use(
      http.get(api("/me/sessions"), () =>
        HttpResponse.json({ data: [{ ...session("a", true), user_agent: "", ip: "" }, session("b")] }),
      ),
      http.get(api("/guard/users/7/sessions"), () => HttpResponse.json({ data: [session("x")] })),
    );
    const { user, router } = await renderRouted(<SessionsPage />, { path: "/sessions" });
    expect((await screen.findAllByText("—")).length).toBeGreaterThanOrEqual(2);
    await user.type(screen.getByLabelText("User ID"), "abc");
    await user.click(screen.getByRole("button", { name: "Look up" }));
    expect(screen.queryByText("ua-x")).toBeNull();
    await user.clear(screen.getByLabelText("User ID"));
    await user.type(screen.getByLabelText("User ID"), "7");
    await user.click(screen.getByRole("button", { name: "Look up" }));
    await user.click(await screen.findByRole("link", { name: "ua-x" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sessions/x"));
    expect(router.state.location.search).toMatchObject({ user: 7 });
  });

  it("clicking a table row (not the link) navigates", async () => {
    signIn();
    server.use(http.get(api("/me/sessions"), () => HttpResponse.json({ data: [session("b")] })));
    const { user, router } = await renderRouted(<SessionsPage />, { path: "/sessions" });
    await user.click(await screen.findByText("1.1.1.1"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sessions/b"));
  });

  it("detail: unknown id, load error, other user's session, current session has no revoke", async () => {
    signIn();
    server.use(http.get(api("/me/sessions"), () => HttpResponse.json({ data: [session("a", true)] })));
    const a = await renderRouted(<SessionDetailPage id="ghost" />, { path: "/sessions/ghost" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Page not found");
    a.unmount();
    const b = await renderRouted(<SessionDetailPage id="a" />, { path: "/sessions/a" });
    expect(await screen.findByText("Device type")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
    b.unmount();
    server.use(http.get(api("/guard/users/7/sessions"), () => HttpResponse.json({ data: [session("x")] })));
    const c = await renderRouted(<SessionDetailPage id="x" userId={7} />, { path: "/sessions/x" });
    expect(await screen.findByText("Device type")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
    c.unmount();
    server.use(http.get(api("/me/sessions"), () => problem(500, "db down")));
    await renderRouted(<SessionDetailPage id="a" />, { path: "/sessions/a" });
    expect(await screen.findByRole("alert")).toHaveTextContent("db down");
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

  it("empty values, ok result, limit/sort/chip/reset/outside-sync", async () => {
    signIn();
    server.use(
      http.get(api("/guard/audit"), () =>
        HttpResponse.json({
          data: [
            {
              id: "2",
              occurred_at: "2030-01-01T00:00:00Z",
              actor_id: "",
              action: "x.y",
              target: "",
              success: true,
              ip: "",
              metadata: {},
            },
          ],
        }),
      ),
    );
    const change = vi.fn();
    const { user } = renderUI(
      <AuditPage search={{ limit: 100, actor: "3", sort: "action" }} onSearchChange={change} />,
    );
    expect(await screen.findByText("x.y")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    await user.selectOptions(screen.getByLabelText("Rows"), "200");
    expect(change).toHaveBeenLastCalledWith({ limit: 200, actor: "3", sort: "action" });
    await user.click(screen.getByRole("button", { name: /^Result/ }));
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ sort: expect.any(String) }));
    await user.click(screen.getByRole("button", { name: /Remove filter/ }));
    expect(change).toHaveBeenLastCalledWith({ limit: 100, sort: "action" });
    await user.click(screen.getByRole("button", { name: "Reset all" }));
    expect(change).toHaveBeenLastCalledWith({ limit: 100, sort: "action" });
    await user.clear(screen.getByLabelText("Actor ID"));
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(change).toHaveBeenLastCalledWith({ limit: 100, actor: undefined, sort: "action" });
  });

  it("filtered empty list clears; actor input follows outside changes; no sort on reset", async () => {
    signIn();
    server.use(http.get(api("/guard/audit"), () => HttpResponse.json({ data: [] })));
    const change = vi.fn();
    const Harness = () => {
      const [search, setSearch] = useState<{ limit: number; actor?: string }>({ limit: 50, actor: "9" });
      return (
        <>
          <button type="button" onClick={() => setSearch({ limit: 50 })}>
            outside
          </button>
          <AuditPage
            search={search}
            onSearchChange={(x) => {
              change(x);
            }}
          />
        </>
      );
    };
    const { user } = renderUI(<Harness />);
    await user.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(change).toHaveBeenLastCalledWith({ limit: 50 });
    expect(screen.getByLabelText("Actor ID")).toHaveValue("9");
    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.getByLabelText("Actor ID")).toHaveValue("");
  });
});

describe("PoliciesPage edges", () => {
  const pol = (o: Record<string, unknown> = {}) => ({
    id: "p1",
    name: "mine",
    resource: "post",
    action: "update",
    effect: "allow",
    priority: 5,
    enabled: true,
    roles: ["ghost"],
    root: {
      operator: "and",
      negate: false,
      conditions: [{ field: "a", operator: "eq", value: ["1"] }],
      groups: [
        { operator: "or", negate: false, conditions: [{ field: "b", operator: "eq", value: ["2"] }], groups: [] },
      ],
    },
    ...o,
  });
  const base = (policies: unknown[]) => [
    http.get(api("/guard/roles"), () => HttpResponse.json({ data: [{ name: "moderator", permissions: [] }] })),
    http.get(api("/guard/policies"), () => HttpResponse.json({ data: policies })),
  ];

  it("managed policies are read-only; read-only admins get no actions", async () => {
    signIn(["policy.read"]);
    server.use(...base([pol({ id: "m", name: "config: built-in", roles: [], root: null }), pol({ enabled: false })]));
    renderUI(<PoliciesPage />);
    expect(await screen.findByText("built-in")).toBeInTheDocument();
    expect(screen.getByText("always")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "New policy" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Enabled: mine" })).toBeDisabled();
  });

  it("toggle failure is reported", async () => {
    signIn();
    server.use(
      ...base([pol()]),
      http.put(api("/guard/policies/p1"), () => problem(500, "save failed")),
    );
    const { user } = renderUI(<PoliciesPage />);
    await user.click(await screen.findByRole("checkbox", { name: "Enabled: mine" }));
    expect(await screen.findByText(/save failed/)).toBeInTheDocument();
  });

  it("edits a policy with a stale role and nested groups, removes a condition, handles save failure then success", async () => {
    signIn();
    let n = 0;
    const bodies: unknown[] = [];
    server.use(
      ...base([pol()]),
      http.put(api("/guard/policies/p1"), async ({ request }) => {
        bodies.push(await request.json());
        return ++n === 1 ? problem(500, "boom") : HttpResponse.json({ data: pol() });
      }),
    );
    const { user } = renderUI(<PoliciesPage />);
    await user.click(await screen.findByRole("button", { name: "Edit: mine" }));
    const d = within(await screen.findByRole("dialog"));
    expect(await d.findByText("ghost")).toBeInTheDocument();
    expect(d.getByText(/nested|group/i)).toBeInTheDocument();
    await user.click(await d.findByRole("checkbox", { name: "moderator" }));
    await user.click(d.getByRole("checkbox", { name: "ghost" }));
    await user.click(d.getByRole("button", { name: "Remove condition 1" }));
    expect(d.getByText("No conditions: the policy matches every request for its target.")).toBeInTheDocument();
    await user.click(d.getByRole("button", { name: "Save" }));
    expect(await d.findByRole("alert")).toHaveTextContent("boom");
    await user.click(d.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(bodies).toHaveLength(2);
  });

  it("validates fields, applies templates, cancels", async () => {
    signIn();
    server.use(...base([]));
    const { user } = renderUI(<PoliciesPage />);
    await user.click(await screen.findByRole("button", { name: "New policy" }));
    const d = within(await screen.findByRole("dialog"));
    await user.click(d.getByRole("button", { name: "Add condition" }));
    await user.click(d.getByRole("button", { name: "Create" }));
    expect((await d.findAllByRole("alert")).length).toBeGreaterThan(0);
    await user.click(d.getByRole("button", { name: "Working hours" }));
    expect(d.getByLabelText("Field 1")).toHaveValue("env.time");
    await user.click(d.getByRole("button", { name: "IP allowlist" }));
    expect(d.getByLabelText("Field 1")).toHaveValue("env.ip");
    await user.selectOptions(d.getByLabelText("Operator 1"), "contains");
    await user.click(d.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("delete failure keeps the dialog open; cancel closes", async () => {
    signIn();
    server.use(
      ...base([pol({ roles: [], root: null })]),
      http.delete(api("/guard/policies/p1"), () => problem(500, "no")),
    );
    const { user } = renderUI(<PoliciesPage />);
    await user.click(await screen.findByRole("button", { name: "Delete: mine" }));
    const dlg = await screen.findByRole("alertdialog");
    await user.click(within(dlg).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());
    await user.click(within(dlg).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
