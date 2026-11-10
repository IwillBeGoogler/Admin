import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { clientError, page, problem, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { ClientErrorsPage } from "./ClientErrorsPage";

const search = { status: "open" } as const;

describe("ClientErrorsPage", () => {
  it("lists with count, shows details and ignores", async () => {
    signIn();
    let body: unknown;
    let query = "";
    server.use(
      http.get(api("/admin/client-errors"), ({ request }) => {
        query = new URL(request.url).search;
        return page([clientError()]);
      }),
      http.put(api("/admin/client-errors/5"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: clientError({ status: "ignored" }) });
      }),
    );
    const { user } = await renderRouted(<ClientErrorsPage search={search} onSearchChange={() => {}} />);
    expect(await screen.findByText("Cannot read properties of undefined")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(query).toContain("status=open");
    await user.click(screen.getByRole("button", { name: "View #5" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("https://blog.test/p/a")).toBeInTheDocument();
    expect(within(dialog).getByText(/at render/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Ignore" }));
    await waitFor(() => expect(body).toEqual({ status: "ignored" }));
  });

  it("offers reopen on a decided entry", async () => {
    signIn();
    let body: unknown;
    server.use(
      http.get(api("/admin/client-errors"), () => page([clientError({ status: "resolved" })])),
      http.put(api("/admin/client-errors/5"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: clientError() });
      }),
    );
    const { user } = await renderRouted(<ClientErrorsPage search={{ status: "all" }} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "View #5" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(body).toEqual({ status: "open" }));
  });

  it("filtered empty list offers clearing back to open; tabs and sort emit search changes", async () => {
    signIn();
    server.use(http.get(api("/admin/client-errors"), () => page([])));
    const change = vi.fn();
    const { user } = await renderRouted(<ClientErrorsPage search={{ status: "resolved" }} onSearchChange={change} />);
    await user.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(change).toHaveBeenLastCalledWith({ status: "open" });
    await user.click(screen.getByRole("button", { name: "Ignored" }));
    expect(change).toHaveBeenLastCalledWith({ status: "ignored" });
  });

  it("sort header emits a sort", async () => {
    signIn();
    server.use(http.get(api("/admin/client-errors"), () => page([clientError()])));
    const change = vi.fn();
    const { user } = await renderRouted(<ClientErrorsPage search={search} onSearchChange={change} />);
    await screen.findByText("7");
    await user.click(screen.getByRole("button", { name: /Count|Occurrences|Seen/ }));
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ sort: expect.any(String) }));
  });

  it("resolves, omitting empty detail rows and stack", async () => {
    signIn();
    let body: unknown;
    server.use(
      http.get(api("/admin/client-errors"), () => page([clientError({ page_url: "", user_agent: "", stack: "" })])),
      http.put(api("/admin/client-errors/5"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: clientError({ status: "resolved" }) });
      }),
    );
    const { user } = await renderRouted(<ClientErrorsPage search={search} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "View #5" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("https://blog.test/p/a")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(body).toEqual({ status: "resolved" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("a failed decision shows the error inline and the dialog closes by button", async () => {
    signIn();
    server.use(
      http.get(api("/admin/client-errors"), () => page([clientError()])),
      http.put(api("/admin/client-errors/5"), () => problem(500, "db down")),
    );
    const { user } = await renderRouted(<ClientErrorsPage search={search} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "View #5" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("db down");
    await user.click(within(dialog).getAllByRole("button", { name: "Close" })[0] as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("the error toast Retry action repeats the failed decision", async () => {
    signIn();
    const err = vi.spyOn(toast, "error").mockReturnValue(1);
    let calls = 0;
    server.use(
      http.get(api("/admin/client-errors"), () => page([clientError()])),
      http.put(api("/admin/client-errors/5"), () => {
        calls += 1;
        return calls === 1 ? problem(500, "db down") : HttpResponse.json({ data: clientError() });
      }),
    );
    const { user } = await renderRouted(<ClientErrorsPage search={search} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "View #5" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(err).toHaveBeenCalled());
    const action = (err.mock.calls[0] as unknown as [string, { action: { onClick: () => void } }])[1].action;
    action.onClick();
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    err.mockRestore();
  });

  it("Escape closes the decision dialog", async () => {
    signIn();
    server.use(http.get(api("/admin/client-errors"), () => page([clientError()])));
    const { user } = await renderRouted(<ClientErrorsPage search={search} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "View #5" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
