import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { diagramProject, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { DiagramProjectPage } from "./DiagramProjectPage";

const detail = (shares: unknown[]) => ({
  data: {
    ...diagramProject({ files: undefined }),
    files: [{ id: "f1", name: "Checkout", kind: "sdd", version: 4, updated_at: "2030-01-01T00:00:00Z" }],
    members: [{ user_id: "5", username: "bob", role: "editor" }],
    shares,
  },
});
const share = (o: Record<string, unknown> = {}) => ({
  id: "s1",
  role: "viewer",
  created_by: "ali",
  created_at: "2030-01-01T00:00:00Z",
  ...o,
});

describe("DiagramProjectPage", () => {
  it("lists files, members and shares, and revokes a link", async () => {
    signIn(["diagrams.read", "diagrams.manage"]);
    let revoked = false;
    server.use(
      http.get(api("/admin/diagrams/projects/p1"), () =>
        HttpResponse.json(detail([share(revoked ? { revoked_at: "2030-02-01T00:00:00Z" } : {})])),
      ),
      http.post(api("/admin/diagrams/shares/s1/revoke"), () => {
        revoked = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<DiagramProjectPage id="p1" />);
    expect(await screen.findByText("Checkout")).toBeInTheDocument();
    expect(screen.getByText("System design")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke: Viewer #s1" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revoked).toBe(true));
    expect(await screen.findByText("Revoked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revoke:/ })).toBeNull();
  });

  it("hides write actions without diagrams.manage", async () => {
    signIn(["diagrams.read"]);
    server.use(http.get(api("/admin/diagrams/projects/p1"), () => HttpResponse.json(detail([share()]))));
    await renderRouted(<DiagramProjectPage id="p1" />);
    await screen.findByText("Checkout");
    expect(screen.queryByRole("button", { name: /Revoke/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("shows the 404 problem", async () => {
    signIn(["diagrams.read"]);
    server.use(
      http.get(api("/admin/diagrams/projects/p1"), () =>
        HttpResponse.json({ title: "project not found", detail: "project not found", status: 404 }, { status: 404 }),
      ),
    );
    await renderRouted(<DiagramProjectPage id="p1" />);
    expect(await screen.findByText("project not found")).toBeInTheDocument();
  });
});
