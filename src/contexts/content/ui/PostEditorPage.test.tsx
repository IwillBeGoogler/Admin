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

  it("loading state, then load error with retry", async () => {
    signIn();
    let n = 0;
    server.use(
      ...taxonomy(),
      http.get(api("/posts/4/revisions"), () => HttpResponse.json({ data: [] })),
      http.get(api("/posts/4"), async () => {
        n++;
        if (n === 1) {
          await new Promise((r) => setTimeout(r, 100));
          return problem(500, "db down");
        }
        return HttpResponse.json({ data: post() });
      }),
    );
    const { user } = await renderRouted(<PostEditorPage postId={4} onSaved={() => {}} />);
    expect(await screen.findByRole("status", { name: "Loading…" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("db down");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByDisplayValue("QA probe")).toBeInTheDocument();
    expect(await screen.findByText("No earlier revisions.")).toBeInTheDocument();
  });

  it("unexpected save failures toast instead of inline; scheduled shows the time field; labels toggle; Mod+Enter publishes", async () => {
    signIn();
    let bodies: Record<string, unknown>[] = [];
    server.use(
      ...taxonomy(),
      http.post(api("/posts"), async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return problem(500, "kaput");
      }),
    );
    const { user } = await renderRouted(<PostEditorPage onSaved={() => {}} />);
    await user.type(await screen.findByLabelText("Title"), "Hi");
    await user.selectOptions(screen.getByLabelText("Status"), "scheduled");
    expect(screen.getByLabelText("Publish at")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "draft");
    const hot = await screen.findByLabelText("Hot");
    await user.click(hot);
    await user.click(hot);
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText(/kaput/)).toBeInTheDocument();
    expect(screen.queryByText("kaput", { selector: "p" })).toBeNull();
    bodies = [];
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(bodies[0]).toMatchObject({ status: "published" });
  });

  it("revision dialog: load error, empty editor name, close", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/posts/4"), () => HttpResponse.json({ data: post() })),
      http.get(api("/posts/4/revisions"), () =>
        HttpResponse.json({
          data: [
            {
              id: 1,
              post_id: 4,
              version: 1,
              title: "Old",
              subtitle: "",
              editor_id: 0,
              editor: "",
              created_at: "2026-10-05T00:00:00Z",
            },
          ],
        }),
      ),
      http.get(api("/posts/4/revisions/1"), () => problem(500, "no diff")),
    );
    const { user } = await renderRouted(<PostEditorPage postId={4} onSaved={() => {}} />);
    await user.click(await screen.findByRole("button", { name: /Version 1/ }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("no diff");
    await user.click(within(dlg).getAllByRole("button", { name: "Close" })[0] as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("diff view renders context lines and subtitle/body changes", async () => {
    signIn();
    server.use(
      ...taxonomy(),
      http.get(api("/posts/4"), () => HttpResponse.json({ data: post() })),
      http.get(api("/posts/4/revisions"), () =>
        HttpResponse.json({
          data: [
            {
              id: 2,
              post_id: 4,
              version: 2,
              title: "T",
              subtitle: "",
              editor_id: 3,
              editor: "admin",
              created_at: "2026-10-05T00:00:00Z",
            },
          ],
        }),
      ),
      http.get(api("/posts/4/revisions/2"), () =>
        HttpResponse.json({
          data: {
            id: 2,
            post_id: 4,
            version: 2,
            title: "T",
            created_at: "2026-10-05T00:00:00Z",
            diff: {
              title: [],
              subtitle: [{ op: "+", text: "sub" }],
              body: [
                { op: "=", text: "" },
                { op: "-", text: "gone" },
              ],
              added: 1,
              removed: 1,
            },
          },
        }),
      ),
    );
    const { user } = await renderRouted(<PostEditorPage postId={4} onSaved={() => {}} />);
    await user.click(await screen.findByRole("button", { name: /Version 2/ }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("sub")).toBeInTheDocument();
    expect(within(dlg).getByText("gone")).toBeInTheDocument();
  });

  describe("glossary", () => {
    it("adds an article term from the selection and sends it", async () => {
      signIn([]);
      let body: Record<string, unknown> | undefined;
      server.use(
        ...taxonomy(),
        http.post(api("/posts"), async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ data: post({ id: 12 }) }, { status: 201 });
        }),
      );
      const onSaved = vi.fn();
      const { user } = await renderRouted(<PostEditorPage onSaved={onSaved} />);
      await user.type(await screen.findByLabelText("Title"), "G");
      const ta = screen.getByLabelText("Body (Markdown)") as HTMLTextAreaElement;
      await user.type(ta, "learn Kubernetes now");
      ta.setSelectionRange(6, 16);
      await user.click(screen.getByRole("button", { name: "Add to glossary" }));
      const dlg = await screen.findByRole("dialog");
      expect(within(dlg).getByLabelText("Term")).toHaveValue("Kubernetes");
      expect(within(dlg).queryByLabelText("Scope")).not.toBeInTheDocument();
      await user.type(within(dlg).getByLabelText("Other forms"), "k8s");
      await user.type(within(dlg).getByLabelText("Definition"), "Orchestrator");
      await user.click(within(dlg).getByRole("button", { name: "Create" }));
      expect(await screen.findByText("Orchestrator")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(12));
      expect(body?.glossary).toEqual([{ term: "Kubernetes", aliases: ["k8s"], definition: "Orchestrator" }]);
    });

    it("rejects a duplicate, then edits and removes", async () => {
      signIn([]);
      server.use(
        ...taxonomy(),
        http.get(api("/posts/4"), () =>
          HttpResponse.json({ data: post({ glossary: [{ term: "Pod", aliases: [], definition: "Unit" }] }) }),
        ),
      );
      const { user } = await renderRouted(<PostEditorPage postId={4} onSaved={() => {}} />);
      await user.click(await screen.findByRole("button", { name: "Add to glossary" }));
      let dlg = await screen.findByRole("dialog");
      await user.type(within(dlg).getByLabelText("Term"), "pod");
      await user.type(within(dlg).getByLabelText("Definition"), "x");
      await user.click(within(dlg).getByRole("button", { name: "Create" }));
      expect(await within(dlg).findByText("This term or form is already in the article")).toBeInTheDocument();
      await user.click(within(dlg).getByRole("button", { name: "Close" }));
      await user.click(await screen.findByRole("button", { name: "Edit: Pod" }));
      dlg = await screen.findByRole("dialog");
      await user.clear(within(dlg).getByLabelText("Definition"));
      await user.type(within(dlg).getByLabelText("Definition"), "Smallest unit");
      await user.click(within(dlg).getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Smallest unit")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Delete: Pod" }));
      expect(screen.getByText("No terms for this article yet.")).toBeInTheDocument();
    });

    it("glossary.write can add a site-wide term with a language", async () => {
      signIn("all");
      let sent: Record<string, unknown> | undefined;
      server.use(
        ...taxonomy(),
        http.post(api("/glossary"), async ({ request }) => {
          sent = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ data: { id: 1, ...sent } }, { status: 201 });
        }),
      );
      const { user } = await renderRouted(<PostEditorPage onSaved={() => {}} />);
      await user.click(await screen.findByRole("button", { name: "Add to glossary" }));
      const dlg = await screen.findByRole("dialog");
      await user.type(within(dlg).getByLabelText("Term"), "Pod");
      await user.type(within(dlg).getByLabelText("Definition"), "Unit");
      await user.selectOptions(within(dlg).getByLabelText("Scope"), "all");
      await user.selectOptions(within(dlg).getByLabelText("Language"), "uz");
      await user.click(within(dlg).getByRole("button", { name: "Create" }));
      await waitFor(() => expect(sent).toMatchObject({ term: "Pod", definition: "Unit", lang: "uz", aliases: [] }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByText("No terms for this article yet.")).toBeInTheDocument();
    });
  });
});
