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
});
