import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { http as apiHttp, tokens } from "@/shared/api";
import { adminUser, page, signIn } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { Providers } from "./providers";
import { createQueryClient } from "./queryClient";
import { routeTree } from "./routeTree.gen";

function renderApp(path: string, pendingMs = 1000) {
  localStorage.setItem("admin.locale", "en");
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPendingMs: pendingMs,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { router, user: userEvent.setup() };
}

const quiet = () => [
  http.get(api("/admin/stats"), () =>
    HttpResponse.json({ data: { posts: 1, comments: 0, likes: 0, categories: 0, users: 1 } }),
  ),
  http.get(api("/categories"), () => HttpResponse.json({ data: [] })),
  http.get(api("/admin/reports"), () => page([])),
  http.get(api("/labels"), () => HttpResponse.json({ data: [] })),
];

describe("auth flow edges", () => {
  it("a non-401 failure loading the admin shows the root error state with retry", async () => {
    signIn();
    server.use(http.get(api("/me"), () => HttpResponse.json({ detail: "db down" }, { status: 500 })));
    const { user } = renderApp("/");
    expect(await screen.findByRole("alert")).toHaveTextContent("db down");
    server.use(...quiet());
    await user.click(screen.getByRole("button", { name: "Retry" }));
  });

  it("shows a loading placeholder while the admin loads", async () => {
    signIn();
    server.use(
      http.get(api("/me"), async () => {
        await new Promise((r) => setTimeout(r, 300));
        return HttpResponse.json({ data: adminUser });
      }),
      ...quiet(),
    );
    renderApp("/", 0);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Dashboard", level: 1 })).toBeInTheDocument();
  });

  it("NoAccess offers sign out", async () => {
    signIn(["post.create"]);
    server.use(http.post(api("/auth/logout"), () => new HttpResponse(null, { status: 204 })));
    const { router, user } = renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("session expiry mid-use leaves once for login", async () => {
    signIn();
    server.use(
      ...quiet(),
      http.get(api("/boom"), () => HttpResponse.json({ detail: "no" }, { status: 401 })),
      http.post(api("/auth/refresh"), () => HttpResponse.json({ detail: "no" }, { status: 401 })),
    );
    const { router } = renderApp("/");
    await screen.findByRole("heading", { name: "Dashboard", level: 1 });
    const call = () => apiHttp("/boom" as never).catch(() => {});
    await call();
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    await call();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("signed-in visitors of /login go to a safe redirect target", async () => {
    signIn();
    server.use(...quiet());
    const a = renderApp("/login?redirect=/reports");
    await waitFor(() => expect(a.router.state.location.pathname).toBe("/reports"));
  });

  it("unsafe redirect targets fall back to the dashboard", async () => {
    signIn();
    server.use(...quiet());
    const a = renderApp("/login?redirect=//evil.example");
    await waitFor(() => expect(a.router.state.location.pathname).toBe("/"));
    expect(tokens.get()).not.toBeNull();
  });
});
