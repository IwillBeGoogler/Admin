import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { feedback, page, signIn } from "@/test/fixtures";
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
});
