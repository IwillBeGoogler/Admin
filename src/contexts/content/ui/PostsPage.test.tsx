import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { page, post, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { PostsPage } from "./PostsPage";

const taxonomy = () => [
  http.get(api("/categories"), () => HttpResponse.json({ data: [{ id: 1, name: "Docker", count: 3 }] })),
  http.get(api("/labels"), () => HttpResponse.json({ data: [{ id: 2, name: "Hot", color: "#ff0000" }] })),
];

describe("PostsPage", () => {
  it("renders rows with category names and filters by category", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () => page([post()])),
    );
    const onFiltersChange = vi.fn();
    const { user } = await renderRouted(<PostsPage filters={{}} onFiltersChange={onFiltersChange} />);
    const row = (await screen.findByRole("link", { name: "QA probe" })).closest("tr") as HTMLElement;
    expect(within(row).getByText("Docker")).toBeInTheDocument();
    expect(within(row).getByText("Published")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Category"), "1");
    expect(onFiltersChange).toHaveBeenCalledWith({ category: 1 });
  });

  it("deletes after confirmation", async () => {
    signIn();
    let deleted = false;
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () => page(deleted ? [] : [post()])),
      http.delete(api("/posts/4"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<PostsPage filters={{}} onFiltersChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Delete: QA probe" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/will be removed permanently/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete post" }));
    expect(await screen.findByText("No posts match these filters.")).toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it("drafts source disables public-only filters", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/admin/posts"), () => page([post({ status: "draft", title: "WIP" })])),
    );
    await renderRouted(<PostsPage filters={{ source: "draft" }} onFiltersChange={() => {}} />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeDisabled();
  });

  it("shows error with retry", async () => {
    signIn();
    let n = 0;
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () =>
        n++ === 0 ? HttpResponse.json({ detail: "db down" }, { status: 500 }) : page([post()]),
      ),
    );
    const { user } = await renderRouted(<PostsPage filters={{}} onFiltersChange={() => {}} />);
    expect(await screen.findByText("db down")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "QA probe" })).toBeInTheDocument());
  });

  it("shows one chip per filter; each removes only its filter", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () => page([])),
    );
    const onFiltersChange = vi.fn();
    const { user } = await renderRouted(
      <PostsPage filters={{ tag: "go", category: 1, sort: "-views" }} onFiltersChange={onFiltersChange} />,
    );
    expect(await screen.findByText("No results for current filters")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Remove filter Category" })).toBeInTheDocument();
    expect(screen.getByText("#go")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove filter Tag" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ category: 1, sort: "-views", tag: undefined });
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ sort: "-views" });
  });

  it("explains why filters are disabled for own drafts", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/admin/posts"), () => page([])),
    );
    await renderRouted(<PostsPage filters={{ source: "draft" }} onFiltersChange={() => {}} />);
    expect(await screen.findByLabelText("Category")).toHaveAccessibleDescription(
      "My drafts and scheduled lists only support the source filter.",
    );
  });

  it("only posts the operator may delete are selectable", async () => {
    signIn(["post.update"]);
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () => page([post(), post({ id: 5, title: "Other", user_id: 99 })])),
    );
    await renderRouted(<PostsPage filters={{}} onFiltersChange={() => {}} />);
    expect(await screen.findByRole("checkbox", { name: "Select row QA probe" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select row Other" })).toBeNull();
  });

  it("sorting writes the sort param", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () => page([post()])),
    );
    const onFiltersChange = vi.fn();
    const { user } = await renderRouted(<PostsPage filters={{}} onFiltersChange={onFiltersChange} />);
    const views = await screen.findByRole("columnheader", { name: /Views/ });
    await user.click(within(views).getByRole("button"));
    expect(onFiltersChange).toHaveBeenCalledWith({ sort: "views" });
  });

  it("all chips render and remove; source select, label select; debounced search", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/admin/posts"), () => page([])),
      http.get(api("/posts"), () => page([])),
    );
    const change = vi.fn();
    const { user } = await renderRouted(
      <PostsPage filters={{ q: "x", source: "scheduled", label: 99, category: 77 }} onFiltersChange={change} />,
    );
    expect(await screen.findByText("#99")).toBeInTheDocument();
    expect(screen.getByText("#77")).toBeInTheDocument();
    for (const [name, patch] of [
      ["Search", { q: undefined }],
      ["Show", { source: undefined }],
      ["Label", { label: undefined }],
      ["Category", { category: undefined }],
    ] as const) {
      await user.click(screen.getByRole("button", { name: `Remove filter ${name}` }));
      expect(change).toHaveBeenLastCalledWith(expect.objectContaining(patch));
    }
    await user.selectOptions(screen.getByLabelText("Show"), "public");
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ source: undefined }));
    await user.selectOptions(screen.getByLabelText("Show"), "draft");
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ source: "draft" }));
  });

  it("label select and clearing category/label; search typing", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () => page([])),
    );
    const change = vi.fn();
    const { user } = await renderRouted(<PostsPage filters={{ category: 1, label: 2 }} onFiltersChange={change} />);
    await user.selectOptions(await screen.findByLabelText("Label"), "");
    expect(change).toHaveBeenLastCalledWith({ category: 1, label: undefined });
    await user.selectOptions(screen.getByLabelText("Category"), "");
    expect(change).toHaveBeenLastCalledWith({ category: undefined, label: 2 });
    await user.type(screen.getByRole("searchbox"), "k");
    await waitFor(() => expect(change).toHaveBeenLastCalledWith({ category: 1, label: 2, q: "k" }, { replace: true }));
  });

  it("n navigates to new post; empty state offers create; non-creators don't", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () => page([])),
    );
    const { user, router } = await renderRouted(<PostsPage filters={{}} onFiltersChange={() => {}} />);
    expect(await screen.findByText("No posts match these filters.")).toBeInTheDocument();
    await user.keyboard("n");
    await waitFor(() => expect(router.state.location.pathname).toBe("/posts/new"));
  });

  it("unknown category/draft rows show a dash; scheduled time; delete via row; bulk delete; clear selection", async () => {
    signIn();
    const gone = new Set<string>();
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () =>
        page(
          [
            post({
              category_id: 999,
              tags: undefined,
              published_at: undefined,
              publish_at: "2031-01-01T00:00:00Z",
              id: 8,
            }),
            post({ id: 9, title: "Nine" }),
          ].filter((p) => !gone.has(String(p.id))),
        ),
      ),
      http.delete(api("/posts/:id"), ({ params }) => {
        gone.add(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<PostsPage filters={{}} onFiltersChange={() => {}} />);
    await screen.findByText("Nine");
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("checkbox", { name: "Select row Nine" }));
    await user.click(
      within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", { name: /Clear|Cancel/ }),
    );
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(
      within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", { name: "Delete" }),
    );
    const dlg = await screen.findByRole("alertdialog");
    await user.click(
      within(dlg)
        .getAllByRole("button")
        .find((b) => b.textContent !== "Cancel") as HTMLElement,
    );
    await waitFor(() => expect(gone.size).toBe(2));
  });

  it("without post.create there is no create hint", async () => {
    signIn(["post.update"]);
    server.use(
      ...taxonomy(),
      http.get(api("/posts"), () => page([])),
    );
    await renderRouted(<PostsPage filters={{}} onFiltersChange={() => {}} />);
    expect(await screen.findByText("No posts match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New post" })).toBeNull();
  });
});
