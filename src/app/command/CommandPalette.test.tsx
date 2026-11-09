import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { adminUser, page, post, signIn } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { Providers } from "../providers";
import { createQueryClient } from "../queryClient";
import { routeTree } from "../routeTree.gen";
import { pushRecent, readRecent } from "./recent";

function renderApp(path: string) {
  localStorage.setItem("admin.locale", "en");
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { router, user: userEvent.setup() };
}

const mocks = () => [
  http.get(api("/admin/stats"), () =>
    HttpResponse.json({ data: { posts: 1, comments: 0, likes: 0, categories: 0, users: 1 } }),
  ),
  http.get(api("/categories"), () => HttpResponse.json({ data: [] })),
  http.get(api("/labels"), () => HttpResponse.json({ data: [] })),
  http.get(api("/admin/reports"), () => page([])),
  http.get(api("/admin/comments"), () => page([])),
  http.get(api("/admin/users"), () => page([{ ...adminUser, id: 9, username: "alice" }])),
  http.get(api("/posts"), () => page([post({ id: 4, title: "Kubernetes intro" })])),
];

const open = async (path = "/comments", heading = "Comments") => {
  const app = renderApp(path);
  await screen.findByRole("heading", { name: heading, level: 1 });
  fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
  const input = await screen.findByPlaceholderText("Type a command or search…");
  return { ...app, input };
};

describe("recent", () => {
  it("keeps newest first, unique, max 5, skips login and non-paths", () => {
    for (const p of ["/a", "/b", "/c", "/d", "/e", "/f", "/a"]) pushRecent(p);
    pushRecent("/login?x=1");
    pushRecent("http://evil");
    expect(readRecent()).toEqual(["/a", "/f", "/e", "/d", "/c"]);
  });

  it("tolerates corrupt storage", () => {
    localStorage.setItem("admin.recent", "{nope");
    expect(readRecent()).toEqual([]);
    localStorage.setItem("admin.recent", '{"a":1}');
    expect(readRecent()).toEqual([]);
    localStorage.setItem("admin.recent", '["/x", 3]');
    expect(readRecent()).toEqual(["/x"]);
  });
});

describe("CommandPalette", () => {
  it("lists recent routes and navigates when one is chosen", async () => {
    signIn();
    server.use(...mocks());
    localStorage.setItem("admin.recent", JSON.stringify(["/reports", "/unknown-route"]));
    const { router, user } = await open();
    expect(await screen.findByText("Recent")).toBeInTheDocument();
    await user.click(screen.getAllByRole("option", { name: /Reports/ })[0] as HTMLElement);
    await waitFor(() => expect(router.state.location.pathname).toBe("/reports"));
  });

  it("recent hides routes the admin cannot see", async () => {
    signIn(["comment.moderate", "report.moderate"]);
    server.use(...mocks());
    localStorage.setItem("admin.recent", JSON.stringify(["/users"]));
    await open();
    expect(screen.queryAllByRole("option", { name: /Users/ })).toHaveLength(0);
  });

  it("searches posts and users remotely and navigates to them", async () => {
    signIn();
    server.use(...mocks());
    const { router, user, input } = await open();
    await user.type(input, "ku");
    const postOpt = await screen.findByRole("option", { name: /Kubernetes intro/ });
    await user.click(postOpt);
    await waitFor(() => expect(router.state.location.pathname).toBe("/posts/4"));
  });

  it("user result goes to the users list filtered by username", async () => {
    signIn();
    server.use(...mocks());
    const { router, user, input } = await open();
    await user.type(input, "al");
    await user.click(await screen.findByRole("option", { name: /@alice/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/users"));
    expect(router.state.location.searchStr).toContain("alice");
  });

  it("shows searching state then empty state", async () => {
    signIn();
    server.use(
      http.get(api("/posts"), async () => {
        await new Promise((r) => setTimeout(r, 200));
        return page([]);
      }),
      http.get(api("/admin/users"), () => page([])),
      ...mocks(),
    );
    const { user, input } = await open();
    await user.type(input, "zzqq");
    expect((await screen.findAllByText("Searching…")).length).toBeGreaterThan(0);
    expect(await screen.findByText("No results.", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("new post action navigates to /posts/new", async () => {
    signIn();
    server.use(...mocks());
    const { router, user } = await open();
    await user.click(screen.getByRole("option", { name: /New post/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/posts/new"));
  });

  it("toggle theme flips dark class and closes", async () => {
    signIn();
    server.use(...mocks());
    const { user } = await open();
    const before = document.documentElement.classList.contains("dark");
    await user.click(screen.getByRole("option", { name: /theme/i }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(!before));
    expect(screen.queryByPlaceholderText("Type a command or search…")).toBeNull();
  });

  it("logout action signs out", async () => {
    signIn();
    server.use(
      ...mocks(),
      http.post(api("/auth/logout"), () => new HttpResponse(null, { status: 204 })),
    );
    const { router, user } = await open();
    await user.click(screen.getByRole("option", { name: /Log out|Sign out/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("switch language changes locale", async () => {
    signIn();
    server.use(...mocks());
    const { user } = await open();
    await user.click(screen.getByRole("option", { name: /Switch language → Русский/ }));
    await waitFor(() => expect(localStorage.getItem("admin.locale")).toBe("ru"));
  });
});
