import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { problem, signIn } from "@/test/fixtures";
import { renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import type { InsightsSearch } from "../domain/insights";
import { InsightsPage } from "./InsightsPage";

const report = {
  days: 30,
  posts: {
    total: 12,
    published: 9,
    drafts: 3,
    likes: 40,
    created: [{ day: "2026-11-10", count: 2 }],
    top_liked: [{ id: 1, slug: "a", title: "Caching 101", author: "ali", likes: 7, comments: 2 }],
  },
  users: { total: 5, new: 2, top_authors: [{ key: "ali", count: 4 }] },
  diagrams: { projects: 3, files: 8 },
  moderation: { open_reports: 6 },
};

const page = (search: Partial<InsightsSearch> = {}, onChange = () => {}) =>
  renderUI(<InsightsPage search={{ tab: "posts", days: 30, ...search }} onSearchChange={onChange} />);

describe("InsightsPage", () => {
  it("shows the posts tab", async () => {
    signIn();
    server.use(http.get(api("/admin/insights"), () => HttpResponse.json({ data: report })));
    page();
    expect((await screen.findAllByText("Caching 101")).length).toBeGreaterThan(0);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("switches tab and period through search params", async () => {
    signIn();
    server.use(http.get(api("/admin/insights"), () => HttpResponse.json({ data: report })));
    const calls: InsightsSearch[] = [];
    const user = userEvent.setup();
    renderUI(<InsightsPage search={{ tab: "posts", days: 30 }} onSearchChange={(s) => calls.push(s)} />);
    await user.click(await screen.findByRole("tab", { name: "Users" }));
    await user.click(screen.getByRole("button", { name: "7 days" }));
    expect(calls).toEqual([
      { tab: "users", days: 30 },
      { tab: "posts", days: 7 },
    ]);
  });

  it("shows the users tab", async () => {
    signIn();
    server.use(http.get(api("/admin/insights"), () => HttpResponse.json({ data: report })));
    page({ tab: "users" });
    expect(await screen.findByText("@ali")).toBeInTheDocument();
  });

  it("draws the extra charts on every tab", async () => {
    signIn();
    const days = Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, count: i }));
    const rich = {
      ...report,
      posts: {
        ...report.posts,
        created: [...days].reverse().map((d, i) => ({ day: days[i]?.day ?? d.day, count: d.count })),
        published_per_day: days.map((d) => ({ ...d, count: 3 })),
        comments_per_day: days,
        by_category: [
          { key: "Data", count: 4 },
          { key: "", count: 2 },
        ],
        top_commented: [{ id: 2, slug: "b", title: "Sharding", author: "bo", likes: 1, comments: 9 }],
      },
      users: { total: 20, new: 5, verified: 12, sanctioned: 1, signups: days, top_authors: [] },
      diagrams: {
        projects: 3,
        files: 8,
        by_kind: [{ key: "sdd", count: 5 }],
        by_visibility: [
          { key: "public", count: 2 },
          { key: "", count: 1 },
        ],
      },
      moderation: {
        open_reports: 6,
        open_feedback: 1,
        open_errors: 2,
        avg_resolve_hours: 30,
        opened: days,
        resolved: days,
      },
    };
    server.use(http.get(api("/admin/insights"), () => HttpResponse.json({ data: rich })));
    const { unmount } = page();
    expect((await screen.findAllByText("Likes vs comments")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Categories: Pareto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Publishing by weekday").length).toBeGreaterThan(0);
    unmount();
    const u = page({ tab: "users" });
    expect((await screen.findAllByText("Total users over time")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Email verified: 60%").length).toBeGreaterThan(0);
    u.unmount();
    const g = page({ tab: "diagrams" });
    expect((await screen.findAllByText("Kinds by size")).length).toBeGreaterThan(0);
    g.unmount();
    page({ tab: "moderation" });
    expect((await screen.findAllByText("Open backlog")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resolve time against 24 h target").length).toBeGreaterThan(0);
  });

  it("shows an error", async () => {
    signIn();
    server.use(http.get(api("/admin/insights"), () => problem(500, "reports down")));
    page();
    expect(await screen.findByText(/reports down/)).toBeInTheDocument();
  });
});
