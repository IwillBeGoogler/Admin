import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { page, problem, signIn } from "@/test/fixtures";
import { renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import { BansPage } from "./BansPage";

const ban = (o: Record<string, unknown> = {}) => ({
  user_id: 9,
  username: "ali",
  kind: "banned",
  reason: "spam",
  actor_id: 3,
  created_at: "2030-01-01T00:00:00Z",
  ...o,
});
const susp = ban({ user_id: 10, username: "bob", kind: "suspended", until: "2099-01-01T00:00:00Z" });

describe("BansPage", () => {
  it("lists sanctions, shows forever vs until, filters by kind client-side", async () => {
    signIn();
    server.use(http.get(api("/admin/bans"), () => page([ban(), susp])));
    renderUI(<BansPage search={{ kind: "suspended" }} />);
    expect(await screen.findByText("@bob")).toBeInTheDocument();
    expect(screen.queryByText("@ali")).toBeNull();
  });

  it("shows both rows unfiltered with 'forever' for permanent bans", async () => {
    signIn();
    server.use(http.get(api("/admin/bans"), () => page([ban(), susp, ban({ user_id: 11, username: "" })])));
    renderUI(<BansPage />);
    expect(await screen.findByText("@ali")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("@11")).toBeInTheDocument();
    expect(screen.getAllByText("Until lifted").length).toBeGreaterThan(0);
  });

  it("kind select, chip removal, reset and sort call onSearchChange", async () => {
    signIn();
    server.use(http.get(api("/admin/bans"), () => page([ban(), susp])));
    const change = vi.fn();
    const { user } = renderUI(<BansPage search={{ kind: "banned", sort: "username" }} onSearchChange={change} />);
    await screen.findByText("@ali");
    await user.selectOptions(document.getElementById("bans-kind") as HTMLSelectElement, "suspended");
    expect(change).toHaveBeenLastCalledWith({ kind: "suspended", sort: "username" });
    await user.selectOptions(document.getElementById("bans-kind") as HTMLSelectElement, "");
    expect(change).toHaveBeenLastCalledWith({ kind: undefined, sort: "username" });
    await user.click(screen.getByRole("button", { name: /Remove filter/ }));
    expect(change).toHaveBeenLastCalledWith({ kind: undefined, sort: "username" });
    await user.click(screen.getByRole("button", { name: "Reset all" }));
    expect(change).toHaveBeenLastCalledWith({ sort: "username" });
    await user.click(screen.getByRole("button", { name: /^User/ }));
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ sort: expect.any(String) }));
  });

  it("reset without sort emits an empty search", async () => {
    signIn();
    server.use(http.get(api("/admin/bans"), () => page([ban()])));
    const change = vi.fn();
    const { user } = renderUI(<BansPage search={{ kind: "banned" }} onSearchChange={change} />);
    await screen.findByText("@ali");
    await user.click(screen.getByRole("button", { name: "Reset all" }));
    expect(change).toHaveBeenLastCalledWith({});
  });

  it("lifting a sanction confirms, calls DELETE and toasts", async () => {
    signIn();
    let lifted = "";
    server.use(
      http.get(api("/admin/bans"), () => page([ban()])),
      http.delete(api("/admin/users/ali/ban"), () => {
        lifted = "ali";
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderUI(<BansPage />);
    await user.click(await screen.findByRole("button", { name: /Unban|Lift/ }));
    const dlg = await screen.findByRole("alertdialog");
    await user.click(
      within(dlg)
        .getAllByRole("button")
        .find((b) => b.textContent !== "Cancel") as HTMLElement,
    );
    await waitFor(() => expect(lifted).toBe("ali"));
  });

  it("failed lift keeps the dialog open", async () => {
    signIn();
    server.use(
      http.get(api("/admin/bans"), () => page([ban()])),
      http.delete(api("/admin/users/ali/ban"), () => problem(500, "db down")),
    );
    const { user } = renderUI(<BansPage />);
    await user.click(await screen.findByRole("button", { name: /Unban|Lift/ }));
    const dlg = await screen.findByRole("alertdialog");
    await user.click(
      within(dlg)
        .getAllByRole("button")
        .find((b) => b.textContent !== "Cancel") as HTMLElement,
    );
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("cancel closes the dialog", async () => {
    signIn();
    server.use(http.get(api("/admin/bans"), () => page([ban()])));
    const { user } = renderUI(<BansPage />);
    await user.click(await screen.findByRole("button", { name: /Unban|Lift/ }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
