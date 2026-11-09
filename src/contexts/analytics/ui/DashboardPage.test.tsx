import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { problem, signIn } from "@/test/fixtures";
import { renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import { DashboardPage } from "./DashboardPage";

describe("DashboardPage", () => {
  it("shows stat cards and derived ratios", async () => {
    signIn();
    server.use(
      http.get(api("/admin/stats"), () =>
        HttpResponse.json({ data: { posts: 4, comments: 2, likes: 6, categories: 1, users: 9 } }),
      ),
      http.get(api("/categories"), () => HttpResponse.json({ data: [{ id: 1, name: "Docker", count: 3 }] })),
    );
    renderUI(<DashboardPage />);
    expect(await screen.findByText("Likes / post: 1.5")).toBeInTheDocument();
    expect(screen.getByText("Comments / post: 0.5")).toBeInTheDocument();
    expect(screen.getAllByText("9").length).toBeGreaterThan(0);
    expect(await screen.findByText("Docker: 75% of posts")).toBeInTheDocument();
  });

  it("shows forbidden state on 403", async () => {
    signIn();
    server.use(
      http.get(api("/admin/stats"), () => problem(403, "forbidden")),
      http.get(api("/categories"), () => HttpResponse.json({ data: [] })),
    );
    renderUI(<DashboardPage />);
    expect(await screen.findByText("You do not have permission to view this.")).toBeInTheDocument();
  });

  it("stats error and categories error each offer retry; empty categories shows empty state", async () => {
    signIn();
    let n = 0;
    server.use(
      http.get(api("/admin/stats"), () =>
        ++n === 1
          ? problem(500, "stats down")
          : HttpResponse.json({ data: { posts: 0, comments: 0, likes: 0, categories: 0, users: 1 } }),
      ),
      http.get(api("/categories"), () => problem(500, "cats down")),
      http.get(api("/admin/analytics"), () => HttpResponse.json({ data: { days: 30, mau: 0, funnel: [] } })),
    );
    const { user } = renderUI(<DashboardPage />);
    expect(await screen.findByText(/stats down/)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Retry" })[0] as HTMLElement);
    await waitFor(() => expect(n).toBeGreaterThan(1));
    expect(await screen.findByText(/cats down/)).toBeInTheDocument();
    server.use(http.get(api("/categories"), () => HttpResponse.json({ data: [] })));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No categories yet.")).toBeInTheDocument();
  });
});
