import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { problem, signIn } from "@/test/fixtures";
import { renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import { SiteStats } from "./SiteStats";

describe("SiteStats", () => {
  it("shows totals and top lists", async () => {
    signIn();
    server.use(
      http.get(api("/admin/stats/site"), () =>
        HttpResponse.json({
          data: {
            totals: { post_views: 1200, diagram_views: 340, visitors: 77, posts: 5, diagrams: 2, users: 9 },
            top_posts: [{ id: 1, slug: "a", title: "Caching 101", author: "ali", views: 800 }],
            top_diagrams: [{ slug: "d1", title: "Queue design", author: "vali", views: 300 }],
            days: [{ day: "2026-11-09", post_views: 3, diagram_views: 1, page_views: 9 }],
          },
        }),
      ),
    );
    renderUI(<SiteStats />);
    expect(await screen.findByText("Caching 101")).toBeInTheDocument();
    expect(screen.getByText("Queue design")).toBeInTheDocument();
    expect(screen.getAllByText("Post views").length).toBeGreaterThan(0);
  });

  it("shows empty state when nothing was viewed", async () => {
    signIn();
    server.use(http.get(api("/admin/stats/site"), () => HttpResponse.json({ data: { totals: {}, days: [] } })));
    renderUI(<SiteStats />);
    expect(await screen.findByText("Nothing viewed yet.")).toBeInTheDocument();
  });

  it("shows error on failure", async () => {
    signIn();
    server.use(http.get(api("/admin/stats/site"), () => problem(500, "site down")));
    renderUI(<SiteStats />);
    expect(await screen.findByText(/site down/)).toBeInTheDocument();
  });
});
