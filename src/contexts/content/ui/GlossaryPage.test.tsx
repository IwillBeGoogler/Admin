import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { problem, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { GlossaryPage } from "./GlossaryPage";

const cache = { id: 1, term: "Cache", aliases: ["caching"], definition: "Fast store", lang: "" };

describe("GlossaryPage", () => {
  it("creates a term with parsed aliases, then edits and deletes", async () => {
    signIn();
    let rows = [cache];
    let created: unknown;
    let updated: unknown;
    server.use(
      http.get(api("/glossary"), () => HttpResponse.json({ data: rows })),
      http.post(api("/glossary"), async ({ request }) => {
        created = await request.json();
        rows = [...rows, { ...(created as typeof cache), id: 2 }];
        return HttpResponse.json({ data: rows[1] }, { status: 201 });
      }),
      http.put(api("/glossary/1"), async ({ request }) => {
        updated = await request.json();
        rows = rows.map((r) => (r.id === 1 ? { ...r, ...(updated as object) } : r));
        return HttpResponse.json({ data: rows[0] });
      }),
      http.delete(api("/glossary/2"), () => {
        rows = rows.filter((r) => r.id !== 2);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<GlossaryPage />);
    expect(await screen.findByText("Fast store")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New term" }));
    await user.type(await screen.findByLabelText("Term"), "Index");
    await user.type(screen.getByLabelText("Other forms"), "indexes, indices, indexes");
    await user.type(screen.getByLabelText("Definition"), "Lookup structure");
    await user.selectOptions(screen.getByLabelText("Language"), "en");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(created).toEqual({
        term: "Index",
        aliases: ["indexes", "indices"],
        definition: "Lookup structure",
        lang: "en",
      }),
    );
    expect(await screen.findByText("Lookup structure")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit: Cache" }));
    const def = await screen.findByLabelText("Definition");
    expect(screen.getByLabelText("Term")).toHaveValue("Cache");
    expect(screen.getByLabelText("Other forms")).toHaveValue("caching");
    await user.clear(def);
    await user.type(def, "Quick store");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updated).toMatchObject({ term: "Cache", definition: "Quick store" }));

    await user.click(screen.getByRole("button", { name: "Delete: Index" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete term" }));
    await waitFor(() => expect(screen.queryByText("Lookup structure")).toBeNull());
    expect(await screen.findByText("Term “Index” deleted")).toBeInTheDocument();
  });

  it("shows a server conflict", async () => {
    signIn();
    server.use(
      http.get(api("/glossary"), () => HttpResponse.json({ data: [] })),
      http.post(api("/glossary"), () => problem(409, "already exists")),
    );
    const { user } = await renderRouted(<GlossaryPage />);
    await user.click(await screen.findByRole("button", { name: "New term" }));
    await user.type(await screen.findByLabelText("Term"), "Index");
    await user.type(screen.getByLabelText("Definition"), "Lookup");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText(/already exists \(request req-1\)/)).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    signIn();
    server.use(http.get(api("/glossary"), () => HttpResponse.json({ data: [] })));
    await renderRouted(<GlossaryPage />);
    expect(await screen.findByText("No terms yet.")).toBeInTheDocument();
  });
});
