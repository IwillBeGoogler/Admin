import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { page, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { CertificatesPage } from "./CertificatesPage";

const certificate = {
  id: "abcdefghijklmnop",
  holder_name: "Ali Valiyev",
  username: "ali",
  title: "30 days of Go",
  days: 30,
  days_done: 28,
  best_streak: 12,
  issued_at: "2026-03-29T00:00:00Z",
};

describe("CertificatesPage", () => {
  it("lists certificates and revokes one with a reason", async () => {
    signIn();
    let body: unknown;
    server.use(
      http.get(api("/admin/certificates"), () => page([certificate])),
      http.post(api("/admin/certificates/abcdefghijklmnop/revoke"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...certificate, revoked_at: "2026-04-01T00:00:00Z" } });
      }),
    );
    const { user } = await renderRouted(<CertificatesPage />);
    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    expect(screen.getByText("28/30 · best streak 12")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke: abcdefghijklmnop" }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Revoke" });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Reason (shown publicly)"), " copied posts ");
    await user.click(submit);
    await waitFor(() => expect(body).toEqual({ reason: "copied posts" }));
  });
});
