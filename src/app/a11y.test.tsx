import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { tokens } from "@/shared/api";
import { adminUser, page, post, report, signIn } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { Providers } from "./providers";
import { createQueryClient } from "./queryClient";
import { routeTree } from "./routeTree.gen";

/**
 * axe-core over every route in light and dark themes. jsdom computes no
 * layout or colours, so `color-contrast` is disabled here; contrast was
 * computed from the OKLCH tokens instead (see styles.css header).
 */
const ts = "2030-01-01T00:00:00Z";
const mocks = () => [
  http.get(api("/admin/stats"), () =>
    HttpResponse.json({ data: { posts: 1, comments: 1, likes: 0, categories: 1, users: 1 } }),
  ),
  http.get(api("/admin/analytics"), () => HttpResponse.json({ detail: "not configured" }, { status: 503 })),
  http.get(api("/categories"), () => HttpResponse.json({ data: [{ id: 1, name: "Docker", count: 3 }] })),
  http.get(api("/labels"), () => HttpResponse.json({ data: [{ id: 2, name: "Hot", color: "#ff0000" }] })),
  http.get(api("/tags"), () => HttpResponse.json({ data: [{ name: "go", count: 2 }] })),
  http.get(api("/posts"), () => page([post()])),
  http.get(api("/posts/4"), () => HttpResponse.json({ data: post() })),
  http.get(api("/posts/4/revisions"), () => HttpResponse.json({ data: [] })),
  http.get(api("/admin/reports"), () => page([report()])),
  http.get(api("/admin/comments"), () =>
    page([{ id: 1, post_id: 4, parent_id: 0, user_id: 2, author: "ali", text: "hi", created_at: ts, likes: 0 }]),
  ),
  http.get(api("/admin/users"), () => page([adminUser, { ...adminUser, id: 9, username: "ali" }])),
  http.get(api("/admin/bans"), () =>
    page([{ user_id: 9, username: "ali", kind: "banned", reason: "spam", actor_id: 3, created_at: ts }]),
  ),
  http.get(api("/guard/roles"), () =>
    HttpResponse.json({
      data: [
        {
          name: "editor",
          title: "Editor",
          is_system: false,
          wildcard: false,
          permissions: [{ resource: "post", action: "update" }],
        },
      ],
    }),
  ),
  http.get(api("/guard/permissions"), () =>
    HttpResponse.json({ data: [{ resource: "post", action: "update", description: "Edit posts" }] }),
  ),
  http.get(api("/me/sessions"), () =>
    HttpResponse.json({
      data: [
        {
          id: "a",
          current: true,
          ip: "1.1.1.1",
          user_agent: "Mozilla/5.0 (Macintosh)",
          created_at: ts,
          last_seen_at: ts,
          expires_at: ts,
        },
      ],
    }),
  ),
  http.get(api("/guard/audit"), () =>
    HttpResponse.json({
      data: [
        {
          id: "e1",
          occurred_at: ts,
          actor_id: "3",
          action: "auth.login",
          target: "user:3",
          success: true,
          ip: "1.1.1.1",
        },
      ],
    }),
  ),
];

const routes: [string, string][] = [
  ["/", "Dashboard"],
  ["/posts", "Posts"],
  ["/posts/new", "New post"],
  ["/posts/4", "Edit post"],
  ["/categories", "Categories"],
  ["/labels", "Labels"],
  ["/tags", "Tags"],
  ["/reports", "Reports"],
  ["/comments", "Comments"],
  ["/users", "Users"],
  ["/bans", "Bans & suspensions"],
  ["/roles", "Roles"],
  ["/permissions", "Permissions"],
  ["/sessions", "Sessions"],
  ["/audit", "Audit log"],
];

async function audit() {
  const result = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false } },
    resultTypes: ["violations"],
  });
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

function renderApp(path: string, theme: "light" | "dark") {
  localStorage.setItem("admin.locale", "en");
  localStorage.setItem("admin.theme", theme);
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
}

describe("accessibility (axe, serious + critical)", () => {
  it("the audit is not vacuous: it flags a nameless button", async () => {
    const { unmount } = render(
      <main>
        <h1>x</h1>
        <button type="button" />
      </main>,
    );
    expect((await audit()).join()).toMatch(/button-name/);
    unmount();
  });

  for (const theme of ["light", "dark"] as const) {
    for (const [path, heading] of routes) {
      it(`${path} in ${theme} theme`, async () => {
        signIn();
        server.use(...mocks());
        renderApp(path, theme);
        await screen.findByRole("heading", { name: heading, level: 1 });
        // let list queries settle so rows (not skeletons) are audited
        await new Promise((r) => setTimeout(r, 50));
        expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark");
        expect(await audit()).toEqual([]);
      });
    }

    it(`login, palette and shortcut help in ${theme} theme`, async () => {
      signIn();
      server.use(...mocks());
      const app = renderApp("/reports", theme);
      await screen.findByRole("heading", { name: "Reports", level: 1 });
      fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
      await screen.findByRole("dialog", { name: "Command palette" });
      expect(await audit()).toEqual([]);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      app.unmount();
      tokens.set(null);
      renderApp("/login", theme);
      await screen.findByRole("heading", { name: "Sign in" });
      expect(await audit()).toEqual([]);
    });
  }
});
