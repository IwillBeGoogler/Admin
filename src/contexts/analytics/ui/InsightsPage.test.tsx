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
    expect(await screen.findByText("Caching 101")).toBeInTheDocument();
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

  it("shows an error", async () => {
    signIn();
    server.use(http.get(api("/admin/insights"), () => problem(500, "reports down")));
    page();
    expect(await screen.findByText(/reports down/)).toBeInTheDocument();
  });
});
