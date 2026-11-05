import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { clientError, page, signIn } from "@/test/fixtures";
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
});
