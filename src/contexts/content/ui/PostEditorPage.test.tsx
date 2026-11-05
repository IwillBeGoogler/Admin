import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { post, problem, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { PostEditorPage } from "./PostEditorPage";

const taxonomy = () => [
  http.get(api("/categories"), () => HttpResponse.json({ data: [{ id: 1, name: "Docker", count: 3 }] })),
  http.get(api("/labels"), () => HttpResponse.json({ data: [{ id: 2, name: "Hot", color: "#ff0000" }] })),
];

describe("PostEditorPage", () => {
  it("validates, then creates with the draft payload", async () => {
    signIn();
    let body: Record<string, unknown> | undefined;
    server.use(
      ...taxonomy(),
      http.post(api("/posts"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: post({ id: 11, ...body }) }, { status: 201 });
      }),
    );
    const onSaved = vi.fn();
    const { user } = await renderRouted(<PostEditorPage onSaved={onSaved} />);
    await user.click(await screen.findByRole("button", { name: "Create" }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Title"), "Hello");
    await user.type(screen.getByLabelText("Tags (comma separated)"), "Go, go");
    await user.selectOptions(await screen.findByLabelText("Category"), "1");
    await user.click(await screen.findByLabelText("Hot"));
    await user.type(screen.getByLabelText("Body (Markdown)"), "text");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(11));
    expect(body).toMatchObject({
      title: "Hello",
      status: "draft",
      category_id: 1,
      tags: ["go"],
      label_ids: [2],
      publish_at: null,
    });
  });

  it("scheduled needs a publish time", async () => {
    signIn();
    server.use(...taxonomy());
    const { user } = await renderRouted(<PostEditorPage onSaved={() => {}} />);
    await user.type(await screen.findByLabelText("Title"), "x");
    await user.selectOptions(screen.getByLabelText("Status"), "scheduled");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Pick a publish time for scheduled posts")).toBeInTheDocument();
  });

  it("shows server 400 detail inline", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.post(api("/posts"), () => problem(400, "too many tags")),
    );
    const { user } = await renderRouted(<PostEditorPage onSaved={() => {}} />);
    await user.type(await screen.findByLabelText("Title"), "x");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("too many tags")).toBeInTheDocument();
  });

  it("edits, views a revision diff and restores it", async () => {
    signIn();
    let restored = false;
    server.use(
      ...taxonomy(),
      http.get(api("/posts/4"), () =>
        HttpResponse.json({ data: post(restored ? { title: "Old", updated_at: "2026-10-06T00:00:00Z" } : {}) }),
      ),
      http.get(api("/posts/4/revisions"), () =>
        HttpResponse.json({
          data: [
            {
              id: 1,
              post_id: 4,
              version: 1,
              title: "Old",
              subtitle: "",
              editor_id: 3,
              editor: "admin",
              created_at: "2026-10-05T00:00:00Z",
            },
          ],
        }),
      ),
      http.get(api("/posts/4/revisions/1"), () =>
        HttpResponse.json({
          data: {
            id: 1,
            post_id: 4,
            version: 1,
            title: "Old",
            created_at: "2026-10-05T00:00:00Z",
            diff: {
              title: [
                { op: "-", text: "Old" },
                { op: "+", text: "QA probe" },
              ],
              subtitle: [],
              body: [],
              added: 1,
              removed: 1,
            },
          },
        }),
      ),
      http.post(api("/posts/4/revisions/1/restore"), () => {
        restored = true;
        return HttpResponse.json({ data: post({ title: "Old" }) });
      }),
    );
    const { user } = await renderRouted(<PostEditorPage postId={4} onSaved={() => {}} />);
    expect(await screen.findByDisplayValue("QA probe")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Version 1 · Old/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("+1 / −1")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Restore" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Old"));
  });

  it("prompts before leaving a dirty editor; a clean one leaves freely", async () => {
    signIn();
    server.use(...taxonomy());
    const { user, router } = await renderRouted(<PostEditorPage onSaved={() => {}} />, { path: "/posts/new" });
    await screen.findByLabelText("Title");
    await router.navigate({ to: "/elsewhere" as "/" });
    expect(router.state.location.pathname).toBe("/elsewhere");
    await router.navigate({ to: "/posts/new" as "/" });
    await user.type(await screen.findByLabelText("Title"), "draft");
    void router.navigate({ to: "/away" as "/" });
    const dialog = await screen.findByRole("alertdialog", { name: "Discard changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/posts/new");
    expect(screen.getByLabelText("Title")).toHaveValue("draft");
    void router.navigate({ to: "/away" as "/" });
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/away"));
  });

  it("Mod+S saves from inside a field", async () => {
    signIn();
    let saved = false;
    server.use(
      ...taxonomy(),
      http.post(api("/posts"), async ({ request }) => {
        saved = true;
        return HttpResponse.json({ data: post({ id: 12, ...((await request.json()) as object) }) }, { status: 201 });
      }),
    );
    const onSaved = vi.fn();
    const { user } = await renderRouted(<PostEditorPage onSaved={onSaved} />);
    await user.type(await screen.findByLabelText("Title"), "Hi");
    await user.keyboard("{Control>}s{/Control}");
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(12));
    expect(saved).toBe(true);
  });
});
