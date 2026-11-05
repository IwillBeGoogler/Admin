import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { tokens } from "@/shared/api";
import { adminUser, page, signIn } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { Providers } from "./providers";
import { createQueryClient } from "./queryClient";
import { routeTree } from "./routeTree.gen";

function renderApp(path: string) {
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

const stats = () =>
  http.get(api("/admin/stats"), () =>
    HttpResponse.json({ data: { posts: 1, comments: 0, likes: 0, categories: 0, users: 1 } }),
  );
const cats = () => http.get(api("/categories"), () => HttpResponse.json({ data: [] }));

describe("app routing", () => {
  it("redirects anonymous visitors to /login and back after sign-in", async () => {
    localStorage.setItem("admin.locale", "en");
    server.use(
      http.post(api("/auth/login"), () => {
        return HttpResponse.json({ data: { token: "tok", expires_at: "2030-01-01T00:00:00Z", user: adminUser } });
      }),
      stats(),
      cats(),
      http.get(api("/admin/reports"), () => page([])),
    );
    signIn();
    tokens.set(null);
    const { router, user } = renderApp("/reports?status=open");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    await user.type(screen.getByLabelText("Username or email"), "admin");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/reports"));
    expect(await screen.findByRole("heading", { name: "Reports" })).toBeInTheDocument();
  });

  it("menu shows only what a moderator may use", async () => {
    localStorage.setItem("admin.locale", "en");
    signIn(["report.moderate", "comment.moderate"]);
    server.use(http.get(api("/admin/reports"), () => page([])));
    renderApp("/reports");
    const nav = (await screen.findAllByRole("navigation", { name: "Menu" }))[0] as HTMLElement;
    const links = within(nav)
      .getAllByRole("link")
      .map((a) => a.textContent);
    expect(links).toEqual(["Tags", "Reports", "Feedback", "Client errors", "Comments", "Sessions"]);
  });

  it("direct visit to a forbidden page shows a permission error", async () => {
    localStorage.setItem("admin.locale", "en");
    signIn(["report.moderate"]);
    renderApp("/users");
    expect(await screen.findByText("You do not have permission to view this.")).toBeInTheDocument();
  });

  it("accounts without admin permissions are turned away", async () => {
    localStorage.setItem("admin.locale", "en");
    signIn(["post.create"]);
    renderApp("/");
    expect(await screen.findByText("This account has no admin permissions.")).toBeInTheDocument();
  });

  it("an expired session that cannot refresh returns to login", async () => {
    localStorage.setItem("admin.locale", "en");
    tokens.set({ token: "stale", expiresAt: "2030-01-01T00:00:00Z" });
    server.use(
      http.get(api("/me"), () => HttpResponse.json({ detail: "unauthorized" }, { status: 401 })),
      http.get(api("/guard/auth/me"), () => HttpResponse.json({ detail: "unauthorized" }, { status: 401 })),
      http.post(api("/auth/refresh"), () => HttpResponse.json({ detail: "unauthorized" }, { status: 401 })),
    );
    const { router } = renderApp("/");
    expect(await screen.findByText("Your session expired. Please sign in again.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(tokens.get()).toBeNull();
  });

  it("logout clears the token and returns to login", async () => {
    localStorage.setItem("admin.locale", "en");
    signIn();
    server.use(
      stats(),
      cats(),
      http.post(api("/auth/logout"), () => new HttpResponse(null, { status: 204 })),
    );
    const { router, user } = renderApp("/");
    // Sign out lives in the account menu in the sidebar footer.
    await user.click(await screen.findByRole("button", { name: "Account menu: admin" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(tokens.get()).toBeNull();
  });
});
