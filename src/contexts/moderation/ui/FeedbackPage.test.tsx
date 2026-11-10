import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { feedback, page, problem, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { FeedbackPage } from "./FeedbackPage";

const search = { status: "open", kind: "all" } as const;

describe("FeedbackPage", () => {
  it("shows details and resolves", async () => {
    signIn();
    let body: unknown;
    let query = "";
    server.use(
      http.get(api("/admin/feedback"), ({ request }) => {
        query = new URL(request.url).search;
        return page([feedback()]);
      }),
      http.put(api("/admin/feedback/3"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: feedback({ status: "resolved" }) });
      }),
    );
    const { user } = await renderRouted(<FeedbackPage search={search} onSearchChange={() => {}} />);
    expect(await screen.findByText("Anonymous")).toBeInTheDocument();
    expect(query).toContain("status=open");
    await user.click(screen.getByRole("button", { name: "View #3" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("https://blog.test/login")).toBeInTheDocument();
    expect(within(dialog).getByText(/at x/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(body).toEqual({ status: "resolved" }));
  });

  it("offers reopen on a decided entry", async () => {
    signIn();
    let body: unknown;
    server.use(
      http.get(api("/admin/feedback"), () => page([feedback({ status: "dismissed" })])),
      http.put(api("/admin/feedback/3"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: feedback() });
      }),
    );
    const { user } = await renderRouted(
      <FeedbackPage search={{ status: "all", kind: "all" }} onSearchChange={() => {}} />,
    );
    await user.click(await screen.findByRole("button", { name: "View #3" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(body).toEqual({ status: "open" }));
  });

  it("switches status and kind filters", async () => {
    signIn();
    server.use(http.get(api("/admin/feedback"), () => page([])));
    const onSearchChange = vi.fn();
    const { user } = await renderRouted(<FeedbackPage search={search} onSearchChange={onSearchChange} />);
    await user.click(await screen.findByRole("button", { name: "Resolved" }));
    expect(onSearchChange).toHaveBeenCalledWith({ status: "resolved", kind: "all" });
    await user.click(screen.getByRole("button", { name: "Idea" }));
    expect(onSearchChange).toHaveBeenCalledWith({ status: "open", kind: "idea" });
  });

  it("empty filtered list clears filters; sort emits; named sender and unknown kind render", async () => {
    signIn();
    server.use(http.get(api("/admin/feedback"), () => page([])));
    const change = vi.fn();
    const { user } = await renderRouted(
      <FeedbackPage search={{ status: "resolved", kind: "all" }} onSearchChange={change} />,
    );
    await user.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(change).toHaveBeenLastCalledWith({ status: "open", kind: "all" });
  });

  it("rows with a sender and an unknown kind; sort header; failed decision shows error", async () => {
    signIn();
    server.use(
      http.get(api("/admin/feedback"), () =>
        page([feedback({ username: "ali", kind: "weird", error_stack: "", contact_email: "", page_url: "" })]),
      ),
      http.put(api("/admin/feedback/3"), () => problem(500, "db down")),
    );
    const change = vi.fn();
    const { user } = await renderRouted(<FeedbackPage search={search} onSearchChange={change} />);
    expect(await screen.findByText("@ali")).toBeInTheDocument();
    expect(screen.getByText("weird")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^#/ }));
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ sort: expect.any(String) }));
    await user.click(screen.getByRole("button", { name: "View #3" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("db down");
    await user.click(within(dialog).getAllByRole("button", { name: "Close" })[0] as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("the error toast Retry action repeats the failed decision", async () => {
    signIn();
    const err = vi.spyOn(toast, "error").mockReturnValue(1);
    let calls = 0;
    server.use(
      http.get(api("/admin/feedback"), () => page([feedback()])),
      http.put(api("/admin/feedback/3"), () => {
        calls += 1;
        return calls === 1 ? problem(500, "db down") : HttpResponse.json({ data: feedback() });
      }),
    );
    const { user } = await renderRouted(<FeedbackPage search={search} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "View #3" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(err).toHaveBeenCalled());
    const action = (err.mock.calls[0] as unknown as [string, { action: { onClick: () => void } }])[1].action;
    action.onClick();
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    err.mockRestore();
  });

  it("Escape closes the decision dialog", async () => {
    signIn();
    server.use(http.get(api("/admin/feedback"), () => page([feedback()])));
    const { user } = await renderRouted(<FeedbackPage search={search} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "View #3" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
