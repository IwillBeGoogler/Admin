import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { problem, signIn } from "@/test/fixtures";
import { renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import type { InsightsSearch } from "../domain/insights";
import { InsightsPage } from "./InsightsPage";

const day = new Date().toISOString().slice(0, 10);
const series = [{ day, count: 2 }];
const named = [
  { key: "", count: 3 },
  { key: "zero", count: 0 },
];
const report = {
  days: 30,
  posts: {
    total: 1,
    published: 1,
    drafts: 0,
    likes: 1,
    created: series,
    published_per_day: series,
    comments_per_day: series,
    by_category: named,
    top_liked: [{ id: 1, slug: "a", title: "Liked", author: "ali", likes: 7, comments: 2 }],
    top_commented: [{ id: 2, slug: "b", title: "Talked", author: "ali", likes: 1, comments: 9 }],
  },
  users: { total: 5, new: 2, signups: series, top_authors: [{ key: "ali", count: 4 }] },
  diagrams: {
    projects: 3,
    files: 8,
    created: series,
    by_kind: named,
    by_visibility: named,
    top_owners: [{ key: "vali", count: 2 }],
  },
  moderation: { open_reports: 6, opened: series, resolved: series, by_reason: named, feedback_by_kind: [] },
};

const audit = [
  {
    id: "1",
    occurred_at: `${day}T01:00:00Z`,
    actor_id: "3",
    action: "auth.login",
    target: "3",
    success: true,
    metadata: null,
  },
  {
    id: "2",
    occurred_at: `${day}T02:00:00Z`,
    actor_id: "",
    action: "auth.login",
    target: "3",
    success: false,
    metadata: null,
  },
];

const render = (search: Partial<InsightsSearch>) =>
  renderUI(<InsightsPage search={{ tab: "posts", days: 30, ...search }} onSearchChange={() => {}} />);

afterEach(() => vi.restoreAllMocks());

describe("InsightsPage tabs and export", () => {
  it.each(["posts", "users", "diagrams", "moderation"] as const)("exports the %s tab as CSV", async (tab) => {
    signIn();
    server.use(http.get(api("/admin/insights"), () => HttpResponse.json({ data: report })));
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render({ tab });
    await userEvent.setup().click(await screen.findByRole("button", { name: /Export CSV/ }));
    expect(click).toHaveBeenCalled();
  });

  it("shows activity from the audit log for auditors", async () => {
    signIn();
    server.use(
      http.get(api("/admin/insights"), () => HttpResponse.json({ data: report })),
      http.get(api("/guard/audit"), () => HttpResponse.json({ data: audit })),
    );
    render({ tab: "activity", days: 7 });
    expect(await screen.findByRole("tab", { name: "Activity" })).toBeInTheDocument();
    expect(await screen.findAllByText("Audit events per day")).not.toHaveLength(0);
    expect(screen.getByText("Logins and sessions")).toBeInTheDocument();
  });

  it("shows an audit error with retry", async () => {
    signIn();
    server.use(
      http.get(api("/admin/insights"), () => HttpResponse.json({ data: report })),
      http.get(api("/guard/audit"), () => problem(500, "audit down")),
    );
    render({ tab: "activity" });
    expect(await screen.findByText(/audit down/)).toBeInTheDocument();
  });

  it("falls back to posts when activity is not allowed", async () => {
    signIn(["insights.read"]);
    server.use(http.get(api("/admin/insights"), () => HttpResponse.json({ data: report })));
    render({ tab: "activity" });
    expect(await screen.findByText("Liked")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Activity" })).toBeNull();
  });
});
