import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { diagramProject, problem, signIn } from "@/test/fixtures";
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

  it("loading, empty sections, unknown role/kind, expired and never-expiring links", async () => {
    signIn(["diagrams.read"]);
    server.use(
      http.get(api("/admin/diagrams/projects/p1"), () =>
        HttpResponse.json({
          data: {
            ...diagramProject({ files: undefined }),
            files: [{ id: "f9", name: "Odd", kind: "weird", version: 1, updated_at: "2030-01-01T00:00:00Z" }],
            members: [{ user_id: "5", username: "bob", role: "godmode" }],
            shares: [
              share({ id: "s2", expires_at: "2000-01-01T00:00:00Z" }),
              share({ id: "s3", role: "alien", expires_at: "2099-01-01T00:00:00Z" }),
              share({ id: "s4" }),
            ],
          },
        }),
      ),
    );
    await renderRouted(<DiagramProjectPage id="p1" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText("weird")).toBeInTheDocument();
    expect(screen.getByText("godmode")).toBeInTheDocument();
    expect(screen.getByText("alien")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("empty files, members and shares", async () => {
    signIn(["diagrams.read"]);
    server.use(
      http.get(api("/admin/diagrams/projects/p1"), () =>
        HttpResponse.json({ data: { ...diagramProject({ files: undefined }), files: [], members: [], shares: [] } }),
      ),
    );
    await renderRouted(<DiagramProjectPage id="p1" />);
    expect(await screen.findByText("No files.")).toBeInTheDocument();
  });

  it("deleting the project navigates back to the list", async () => {
    signIn(["diagrams.read", "diagrams.manage"]);
    let deleted = false;
    server.use(
      http.get(api("/admin/diagrams/projects/p1"), () => HttpResponse.json(detail([]))),
      http.delete(api("/admin/diagrams/projects/p1"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, router } = await renderRouted(<DiagramProjectPage id="p1" />, { path: "/diagrams/p1" });
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(router.state.location.pathname).toBe("/diagrams"));
  });

  it("failed revoke keeps the dialog open", async () => {
    signIn(["diagrams.read", "diagrams.manage"]);
    server.use(
      http.get(api("/admin/diagrams/projects/p1"), () => HttpResponse.json(detail([share()]))),
      http.post(api("/admin/diagrams/shares/s1/revoke"), () => problem(500, "no")),
    );
    const { user } = await renderRouted(<DiagramProjectPage id="p1" />);
    await user.click(await screen.findByRole("button", { name: "Revoke: Viewer #s1" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());
  });
});
