import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { page, problem, report, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { ReportsPage } from "./ReportsPage";

describe("ReportsPage", () => {
  it("resolves with content removal", async () => {
    signIn();
    let body: unknown;
    let decided = false;
    server.use(
      http.get(api("/admin/reports"), () => page(decided ? [] : [report()])),
      http.put(api("/admin/reports/7"), async ({ request }) => {
        body = await request.json();
        decided = true;
        return HttpResponse.json({ data: report({ status: "resolved" }) });
      }),
    );
    const { user } = await renderRouted(<ReportsPage search={{ status: "open" }} onSearchChange={() => {}} />);
    expect(await screen.findByRole("button", { name: "Open, 1 open" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Resolve #7" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByLabelText("Also remove the reported content"));
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(body).toEqual({ status: "resolved", remove_content: true }));
    expect(await screen.findByText("No reports with this status.")).toBeInTheDocument();
    // the shared "open" query was invalidated, so the count pill disappears
    expect(await screen.findByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("explains a 409 conflict and refreshes", async () => {
    signIn();
    let calls = 0;
    server.use(
      http.get(api("/admin/reports"), () => {
        calls++;
        return page([report()]);
      }),
      http.put(api("/admin/reports/7"), () => problem(409, "already decided")),
    );
    const { user } = await renderRouted(<ReportsPage search={{ status: "open" }} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Dismiss #7" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Also remove the reported content")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    expect(await screen.findByText(/already decided this report/)).toBeInTheDocument();
    await waitFor(() => expect(calls).toBeGreaterThan(1));
  });

  it("switches status filter", async () => {
    signIn();
    server.use(http.get(api("/admin/reports"), () => page([])));
    const onSearchChange = vi.fn();
    const { user } = await renderRouted(<ReportsPage search={{ status: "open" }} onSearchChange={onSearchChange} />);
    await user.click(await screen.findByRole("button", { name: "Resolved" }));
    expect(onSearchChange).toHaveBeenCalledWith({ status: "resolved" });
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the open count on the Open tab as part of its name", async () => {
    signIn();
    server.use(http.get(api("/admin/reports"), () => page([report()], { total: 5 })));
    await renderRouted(<ReportsPage search={{ status: "open" }} onSearchChange={() => {}} />);
    expect(await screen.findByRole("button", { name: "Open, 5 open" })).toHaveAttribute("aria-pressed", "true");
  });

  it("bulk-resolves selected open reports with one confirm", async () => {
    signIn();
    const bodies: unknown[] = [];
    server.use(
      http.get(api("/admin/reports"), () => page([report(), report({ id: 8 }), report({ id: 9, status: "resolved" })])),
      http.put(api("/admin/reports/:id"), async ({ request, params }) => {
        bodies.push({ id: params.id, ...((await request.json()) as object) });
        return HttpResponse.json({ data: report({ id: Number(params.id), status: "resolved" }) });
      }),
    );
    const { user } = await renderRouted(<ReportsPage search={{ status: "all" }} onSearchChange={() => {}} />);
    await screen.findByRole("checkbox", { name: "Select row #7" });
    expect(screen.queryByRole("checkbox", { name: "Select row #9" })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(
      within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", { name: "Resolve" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Resolve 2 reports?");
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
    expect(await screen.findByText("2 resolved")).toBeInTheDocument();
    expect(bodies).toEqual([
      { id: "7", status: "resolved", remove_content: false },
      { id: "8", status: "resolved", remove_content: false },
    ]);
  });

  it("locks the decide dialog while the request runs", async () => {
    signIn();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let calls = 0;
    server.use(
      http.get(api("/admin/reports"), () => page([report()])),
      http.put(api("/admin/reports/7"), async () => {
        calls++;
        await gate;
        return HttpResponse.json({ data: report({ status: "resolved" }) });
      }),
    );
    const { user } = await renderRouted(<ReportsPage search={{ status: "open" }} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Resolve #7" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByLabelText("Also remove the reported content"));
    const confirm = within(dialog).getByRole("button", { name: "Resolve" });
    expect(confirm.className).toMatch(/bg-destructive/);
    await user.dblClick(confirm);
    await waitFor(() => expect(confirm).toHaveAttribute("aria-busy", "true"));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls).toBe(1);
  });

  it("reports a diagram target by file id and links to its project", async () => {
    signIn();
    let body: unknown;
    server.use(
      http.get(api("/admin/reports"), () =>
        page([
          report({
            id: 11,
            target_type: "diagram",
            target_id: undefined,
            target_file_id: "f_9",
            target_project_id: "p1",
          }),
        ]),
      ),
      http.put(api("/admin/reports/11"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: report({ id: 11, status: "resolved" }) });
      }),
    );
    const { user } = await renderRouted(<ReportsPage search={{ status: "open" }} onSearchChange={() => {}} />);
    expect(await screen.findByRole("link", { name: "Diagram f_9" })).toHaveAttribute("href", "/diagrams/p1");
    await user.click(screen.getByRole("button", { name: "Resolve #11" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByLabelText("Also remove the reported content"));
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(body).toEqual({ status: "resolved", remove_content: true }));
  });

  it("diagram target without a project is plain text; user/comment targets; unknown reason; empty reporter", async () => {
    signIn();
    server.use(
      http.get(api("/admin/reports"), () =>
        page([
          report({ id: 21, target_type: "diagram", target_file_id: undefined, target_project_id: undefined }),
          report({ id: 22, target_type: "comment", target_id: 5, reason: "weird_reason", note: "", reporter: "" }),
          report({ id: 23, target_type: "user", target_id: 6 }),
        ]),
      ),
    );
    await renderRouted(<ReportsPage search={{ status: "open" }} onSearchChange={() => {}} />);
    expect(await screen.findByText("weird_reason")).toBeInTheDocument();
    expect(screen.getByText("Comment #5")).toBeInTheDocument();
    expect(screen.getByText("User #6")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("status tab keeps the sort; sort header emits; user reports hide the remove-content option", async () => {
    signIn();
    server.use(http.get(api("/admin/reports"), () => page([report({ target_type: "user" })])));
    const change = vi.fn();
    const { user } = await renderRouted(
      <ReportsPage search={{ status: "open", sort: "id" }} onSearchChange={change} />,
    );
    await user.click(await screen.findByRole("button", { name: "Resolved" }));
    expect(change).toHaveBeenLastCalledWith({ status: "resolved", sort: "id" });
    await user.click(screen.getByRole("button", { name: /^Reason/ }));
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ sort: expect.any(String) }));
    await user.click(screen.getByRole("button", { name: "Resolve #7" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Also remove the reported content")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("bulk dismiss, clear selection, and a failed decide shows the error inline", async () => {
    signIn();
    server.use(
      http.get(api("/admin/reports"), () => page([report(), report({ id: 8 })])),
      http.put(api("/admin/reports/7"), () => problem(500, "db down")),
      http.put(api("/admin/reports/8"), () => HttpResponse.json({ data: report({ id: 8, status: "dismissed" }) })),
    );
    const { user } = await renderRouted(<ReportsPage search={{ status: "open" }} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("checkbox", { name: "Select row #8" }));
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    await user.click(within(bar).getByRole("button", { name: "Dismiss" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Dismiss" }));
    expect(await screen.findByText("1 dismissed")).toBeInTheDocument();
    await user.click(await screen.findByRole("checkbox", { name: "Select row #7" }));
    await user.click(
      within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", { name: /Clear|Cancel/ }),
    );
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Dismiss #7" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("db down");
  });
});
