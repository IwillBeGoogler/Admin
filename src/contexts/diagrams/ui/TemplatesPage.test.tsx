import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { diagramTemplate, page, problem, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { TemplatesPage } from "./TemplatesPage";

describe("TemplatesPage", () => {
  it("lists templates in position order", async () => {
    signIn(["templates.manage"]);
    server.use(
      http.get(api("/admin/diagrams/templates"), () =>
        page([
          diagramTemplate({ id: "b", title: "Second", position: 2 }),
          diagramTemplate({ id: "a", title: "First" }),
        ]),
      ),
    );
    await renderRouted(<TemplatesPage />);
    await screen.findByText("First");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("First");
    expect(rows[1]).toHaveTextContent("Second");
  });

  it("creates a template appended last", async () => {
    signIn(["templates.manage"]);
    let body: unknown;
    server.use(
      http.get(api("/admin/diagrams/templates"), () => page([diagramTemplate({ position: 4 })])),
      http.post(api("/admin/diagrams/templates"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: diagramTemplate({ id: "n" }) }, { status: 201 });
      }),
    );
    const { user } = await renderRouted(<TemplatesPage />);
    await screen.findByText("URL shortener");
    await user.click(screen.getByRole("button", { name: "New template" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findAllByText("Required")).toHaveLength(2);
    await user.type(within(dialog).getByLabelText("Title"), "Chat app");
    await user.selectOptions(within(dialog).getByLabelText("Type"), "db");
    await user.type(within(dialog).getByLabelText("Source file ID"), "f9");
    await user.click(within(dialog).getByLabelText("Published"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(body).toEqual({
        title: "Chat app",
        kind: "db",
        description: "",
        file_id: "f9",
        published: true,
        position: 5,
      }),
    );
  });

  it("toggles published and shows server errors inline when editing", async () => {
    signIn(["templates.manage"]);
    const patches: unknown[] = [];
    server.use(
      http.get(api("/admin/diagrams/templates"), () => page([diagramTemplate()])),
      http.patch(api("/admin/diagrams/templates/t1"), async ({ request }) => {
        const b = (await request.json()) as { title?: string };
        patches.push(b);
        return b.title
          ? problem(409, "file is not a diagram")
          : HttpResponse.json({ data: diagramTemplate({ published: false }) });
      }),
    );
    const { user } = await renderRouted(<TemplatesPage />);
    await user.click(await screen.findByRole("button", { name: "Published: URL shortener" }));
    await waitFor(() => expect(patches[0]).toEqual({ published: false }));
    await user.click(screen.getByRole("button", { name: "Edit: URL shortener" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("file is not a diagram")).toBeInTheDocument();
  });

  it("reorders with one call and deletes after confirmation", async () => {
    signIn(["templates.manage"]);
    const reorders: unknown[] = [];
    let removed = false;
    let swapped = false;
    const first = diagramTemplate({ id: "a", title: "First" });
    const second = diagramTemplate({ id: "b", title: "Second", position: 2 });
    server.use(
      http.get(api("/admin/diagrams/templates"), () =>
        page(
          removed
            ? []
            : swapped
              ? [
                  { ...second, position: 1 },
                  { ...first, position: 2 },
                ]
              : [first, second],
        ),
      ),
      http.post(api("/admin/diagrams/templates/reorder"), async ({ request }) => {
        reorders.push(await request.json());
        swapped = true;
        return HttpResponse.json([]);
      }),
      http.delete(api("/admin/diagrams/templates/a"), () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<TemplatesPage />);
    await user.click(await screen.findByRole("button", { name: "Move down: First" }));
    await waitFor(() => expect(reorders).toHaveLength(1));
    expect(reorders).toEqual([{ ids: ["b", "a"] }]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Move down: First" })).toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Delete: First" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("No templates yet.")).toBeInTheDocument();
  });
});
