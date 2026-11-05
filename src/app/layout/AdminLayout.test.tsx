import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { page, report, signIn } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { Providers } from "../providers";
import { createQueryClient } from "../queryClient";
import { routeTree } from "../routeTree.gen";

function renderApp(path: string) {
  localStorage.setItem("admin.locale", "en");
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const r = render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...r, router, user: userEvent.setup() };
}

const apiMocks = (openReports = 0) => [
  http.get(api("/admin/stats"), () =>
    HttpResponse.json({ data: { posts: 1, comments: 0, likes: 0, categories: 0, users: 1 } }),
  ),
  http.get(api("/categories"), () => HttpResponse.json({ data: [] })),
  http.get(api("/labels"), () => HttpResponse.json({ data: [] })),
  http.get(api("/admin/reports"), () => page(openReports ? [report()] : [], { total: openReports })),
  http.get(api("/admin/comments"), () => page([])),
  http.get(api("/admin/users"), () => page([])),
  http.get(api("/posts"), () => page([])),
];

const sidebarNav = () => screen.getAllByRole("navigation", { name: "Menu" })[0] as HTMLElement;
const ctrlK = () => fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });

describe("AdminLayout", () => {
  it("Ctrl+K, type 'rep', Enter goes to /reports", async () => {
    signIn();
    server.use(...apiMocks());
    const { router, user } = renderApp("/comments");
    await screen.findByRole("heading", { name: "Comments", level: 1 });
    ctrlK();
    const input = await screen.findByPlaceholderText("Type a command or search…");
    await user.type(input, "rep");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/reports"));
    expect(screen.queryByPlaceholderText("Type a command or search…")).toBeNull();
  });

  it("palette never lists what the admin may not use and closes on Esc", async () => {
    signIn(["report.moderate", "comment.moderate"]);
    server.use(...apiMocks());
    const { user } = renderApp("/reports");
    await screen.findByRole("heading", { name: "Reports", level: 1 });
    await user.click(screen.getByRole("button", { name: "Command palette" }));
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    expect(within(dialog).getByRole("option", { name: /Comments/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: /Users/ })).toBeNull();
    expect(within(dialog).queryByRole("option", { name: /New post/ })).toBeNull();
    expect(within(dialog).getByRole("option", { name: /Switch language → Русский/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull());
  });

  it("g r navigates, ? lists every binding, typing g in search does nothing", async () => {
    signIn();
    server.use(...apiMocks());
    const { router, user } = renderApp("/users");
    const search = await screen.findByRole("searchbox");
    await user.type(search, "gr");
    expect(router.state.location.pathname).toBe("/users");
    search.blur();
    fireEvent.keyDown(document.body, { key: "g" });
    fireEvent.keyDown(document.body, { key: "r" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/reports"));
    await screen.findByRole("heading", { name: "Reports", level: 1 });
    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    const help = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    for (const label of ["Open command palette", "Next row", "Select or deselect row", "Save and publish"])
      expect(within(help).getByText(label)).toBeInTheDocument();
    expect(within(help).getByText("Go to Reports")).toBeInTheDocument();
  });

  it("/ focuses the list search", async () => {
    signIn();
    server.use(...apiMocks());
    renderApp("/users");
    const search = await screen.findByRole("searchbox");
    fireEvent.keyDown(document.body, { key: "/" });
    expect(search).toHaveFocus();
  });

  it("collapsed sidebar survives a reload and keeps accessible names", async () => {
    signIn();
    server.use(...apiMocks());
    const first = renderApp("/reports");
    await screen.findByRole("heading", { name: "Reports", level: 1 });
    await first.user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(localStorage.getItem("admin.sidebar")).toBe("collapsed");
    first.unmount();
    renderApp("/reports");
    await screen.findByRole("heading", { name: "Reports", level: 1 });
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
    const links = within(sidebarNav()).getAllByRole("link");
    for (const a of links) expect(a).toHaveAccessibleName();
    expect(within(sidebarNav()).getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page");
  });

  it("nav pill is part of the Reports link name", async () => {
    signIn(["report.moderate"]);
    server.use(...apiMocks(5));
    renderApp("/reports");
    await screen.findByRole("heading", { name: "Reports", level: 1 });
    expect(await within(sidebarNav()).findByRole("link", { name: "Reports, 5 open" })).toBeInTheDocument();
  });

  it("sets the tab title and moves focus to h1 after navigation", async () => {
    signIn();
    server.use(...apiMocks());
    const { router } = renderApp("/comments");
    await screen.findByRole("heading", { name: "Comments", level: 1 });
    expect(document.title).toBe("Comments · Blog Admin");
    await router.navigate({ to: "/reports" });
    const h1 = await screen.findByRole("heading", { name: "Reports", level: 1 });
    await waitFor(() => expect(h1).toHaveFocus());
    expect(document.title).toBe("Reports · Blog Admin");
    expect(JSON.parse(localStorage.getItem("admin.recent") ?? "[]")[0]).toBe("/reports?status=open");
  });
});
