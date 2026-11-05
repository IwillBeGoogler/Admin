import { screen } from "@testing-library/react";
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
});
