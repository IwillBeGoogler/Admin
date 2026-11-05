import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { page, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { CommentsPage } from "./CommentsPage";

const c = {
  id: 1,
  post_id: 4,
  parent_id: 0,
  user_id: 0,
  author: "Anonymous",
  text: "spammy\ncomment",
  created_at: "2030-01-01T00:00:00Z",
  likes: 0,
};

describe("CommentsPage", () => {
  it("lists and deletes with confirmation", async () => {
    signIn();
    let gone = false;
    server.use(
      http.get(api("/admin/comments"), () => page(gone ? [] : [c])),
      http.delete(api("/comments/1"), () => {
        gone = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<CommentsPage />);
    expect(await screen.findByText("spammy comment")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#4" })).toHaveAttribute("href", "/posts/4");
    await user.click(await screen.findByRole("button", { name: "Delete: #1" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete comment" }));
    await waitFor(() => expect(screen.getByText("No comments.")).toBeInTheDocument());
    expect(await screen.findByText("Comment #1 deleted")).toBeInTheDocument();
  });
  it("hides delete without comment.delete", async () => {
    signIn(["comment.moderate"]);
    server.use(http.get(api("/admin/comments"), () => page([c])));
    await renderRouted(<CommentsPage />);
    await screen.findByText("spammy comment");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Delete: #1" })).toBeNull());
  });

  it("bulk-deletes 3 comments with one confirm and one summary toast", async () => {
    signIn();
    const deleted: number[] = [];
    const rows = [1, 2, 3, 4].map((id) => ({ ...c, id, text: `comment ${id}` }));
    server.use(
      http.get(api("/admin/comments"), () => page(rows.filter((r) => !deleted.includes(r.id)))),
      http.delete(api("/comments/:id"), ({ params }) => {
        deleted.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<CommentsPage />);
    for (const id of [1, 2, 3]) await user.click(await screen.findByRole("checkbox", { name: `Select row #${id}` }));
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    expect(bar).toHaveTextContent("3 selected");
    await user.click(within(bar).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete 3 comments?");
    await user.click(within(dialog).getByRole("button", { name: "Delete comments" }));
    expect(await screen.findByText("3 deleted")).toBeInTheDocument();
    expect(deleted.sort()).toEqual([1, 2, 3]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
  });

  it("reports partial failure once and re-selects only the failed rows", async () => {
    signIn();
    const rows = [1, 2, 3].map((id) => ({ ...c, id, text: `comment ${id}` }));
    server.use(
      http.get(api("/admin/comments"), () => page(rows)),
      http.delete(api("/comments/:id"), ({ params }) =>
        params.id === "2"
          ? HttpResponse.json({ detail: "locked" }, { status: 409 })
          : new HttpResponse(null, { status: 204 }),
      ),
    );
    const { user } = await renderRouted(<CommentsPage />);
    await user.click(await screen.findByRole("checkbox", { name: "Select all rows" }));
    await user.click(
      within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", { name: "Delete" }),
    );
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete comments" }));
    expect(await screen.findByText("2 deleted, 1 failed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show failed" }));
    expect(await screen.findByRole("region", { name: "Bulk actions" })).toHaveTextContent("1 selected");
    expect(screen.getByRole("checkbox", { name: "Select row #2" })).toBeChecked();
  });

  it("Esc clears the selection", async () => {
    signIn();
    server.use(http.get(api("/admin/comments"), () => page([c])));
    const { user } = await renderRouted(<CommentsPage />);
    await user.click(await screen.findByRole("checkbox", { name: "Select row #1" }));
    expect(screen.getByRole("region", { name: "Bulk actions" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
  });

  it("filters loaded rows by text or author and offers Clear filters", async () => {
    signIn();
    server.use(http.get(api("/admin/comments"), () => page([c, { ...c, id: 2, author: "bob", text: "hello" }])));
    const onSearchChange = vi.fn();
    const { user } = await renderRouted(<CommentsPage search={{ q: "zzz" }} onSearchChange={onSearchChange} />);
    expect(await screen.findByText("No results for current filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onSearchChange).toHaveBeenCalledWith({});
    await user.click(screen.getByRole("button", { name: "Remove filter Search" }));
    expect(onSearchChange).toHaveBeenCalledWith({ q: undefined });
  });
});
