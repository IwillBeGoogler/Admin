import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { diagramProject, page, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { DiagramsPage } from "./DiagramsPage";

const stats = {
  projects: 12,
  files: 40,
  files_by_kind: { sdd: 20, erd: 10, uml: 6, board: 4 },
  active_editors_7d: 7,
  storage_bytes: 1536,
};

describe("DiagramsPage", () => {
  const stub = () =>
    server.use(
      http.get(api("/admin/diagrams/stats"), () => HttpResponse.json({ data: stats })),
      http.get(api("/admin/diagrams/projects"), () => page([diagramProject()])),
    );

  it("shows stats and projects", async () => {
    signIn(["diagrams.read"]);
    stub();
    await renderRouted(<DiagramsPage search={{}} onSearchChange={() => {}} />);
    expect(await screen.findByText("1.5 KB")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/System design 20 · DB diagram 10 · OOD diagram 6 · Board 4/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Payments" })).toBeInTheDocument();
    // read-only admins get no delete action
    expect(screen.queryByRole("button", { name: "Delete: Payments" })).toBeNull();
  });

  it("filters by owner via the row button", async () => {
    signIn(["diagrams.read"]);
    stub();
    const onSearchChange = vi.fn();
    const { user } = await renderRouted(<DiagramsPage search={{}} onSearchChange={onSearchChange} />);
    await user.click(await screen.findByRole("button", { name: "Filter by owner @ali" }));
    expect(onSearchChange).toHaveBeenCalledWith({ owner: "ali" });
  });

  it("sends q and owner to the API and shows chips", async () => {
    signIn(["diagrams.read"]);
    let seen: string[] = [];
    server.use(
      http.get(api("/admin/diagrams/stats"), () => HttpResponse.json({ data: stats })),
      http.get(api("/admin/diagrams/projects"), ({ request }) => {
        const u = new URL(request.url).searchParams;
        seen = [u.get("q") ?? "", u.get("owner") ?? ""];
        return page([]);
      }),
    );
    await renderRouted(<DiagramsPage search={{ q: "pay", owner: "ali" }} onSearchChange={() => {}} />);
    expect(await screen.findByText("No results for current filters")).toBeInTheDocument();
    expect(seen).toEqual(["pay", "ali"]);
    expect(screen.getByText("@ali")).toBeInTheDocument();
  });

  it("deletes a project after confirmation (manage only)", async () => {
    signIn(["diagrams.read", "diagrams.manage"]);
    let deleted = false;
    server.use(
      http.get(api("/admin/diagrams/stats"), () => HttpResponse.json({ data: stats })),
      http.get(api("/admin/diagrams/projects"), () => page(deleted ? [] : [diagramProject()])),
      http.delete(api("/admin/diagrams/projects/p1"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<DiagramsPage search={{}} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Delete: Payments" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleted).toBe(true));
    expect(await screen.findByText("No diagram projects.")).toBeInTheDocument();
  });

  it("shows a retryable error when the list fails", async () => {
    signIn(["diagrams.read"]);
    server.use(
      http.get(api("/admin/diagrams/stats"), () => HttpResponse.json({ data: stats })),
      http.get(api("/admin/diagrams/projects"), () =>
        HttpResponse.json({ title: "boom", status: 500 }, { status: 500 }),
      ),
    );
    await renderRouted(<DiagramsPage search={{}} onSearchChange={() => {}} />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});
