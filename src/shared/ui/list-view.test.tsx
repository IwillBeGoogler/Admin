import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderUI } from "@/test/render";
import { type ListQuery, ListView } from "./list-view";

const q = (o: Partial<ListQuery> = {}): ListQuery => ({
  isPending: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
  ...o,
});

const view = (query: ListQuery, items: string[], extra: { filtered?: boolean; onClearFilters?: () => void } = {}) => (
  <ListView
    query={query}
    items={items}
    empty={{ title: "No posts yet", hint: "Write one", action: <button type="button">New post</button> }}
    {...extra}
  >
    {(rows) => (
      <ul>
        {rows.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    )}
  </ListView>
);

describe("ListView", () => {
  it("shows skeleton rows while pending", () => {
    renderUI(view(q({ isPending: true, isFetching: true }), []));
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });
  it("shows the error with retry", async () => {
    const refetch = vi.fn();
    const { user } = renderUI(view(q({ isError: true, error: new Error("boom"), refetch }), []));
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
  it("empty without filters shows title, hint and action", () => {
    renderUI(view(q(), []));
    expect(screen.getByText("No posts yet")).toBeInTheDocument();
    expect(screen.getByText("Write one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New post" })).toBeInTheDocument();
  });
  it("empty with filters offers Clear filters", async () => {
    const onClearFilters = vi.fn();
    const { user } = renderUI(view(q(), [], { filtered: true, onClearFilters }));
    expect(screen.getByText("No results for current filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearFilters).toHaveBeenCalled();
  });
  it("keeps stale rows during a background refetch and shows the bar", () => {
    renderUI(view(q({ isFetching: true }), ["a", "b"]));
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Refreshing…" })).toBeInTheDocument();
  });
  it("renders Load more for infinite queries", async () => {
    const fetchNextPage = vi.fn();
    const { user } = renderUI(
      view(q({ data: { pages: [{ meta: { total: 40 } }] }, hasNextPage: true, fetchNextPage }), ["a"]),
    );
    expect(screen.getByText(/40 total/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(fetchNextPage).toHaveBeenCalled();
  });
});
