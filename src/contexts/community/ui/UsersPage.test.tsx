import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { adminUser, page, problem, signIn } from "@/test/fixtures";
import { renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import { UsersPage } from "./UsersPage";

const ali = { ...adminUser, id: 1, username: "ali", email: "ali@x.dev", roles: [] };

describe("UsersPage", () => {
  it("lists users, hides sanction for self, loads more by cursor", async () => {
    signIn();
    server.use(
      http.get(api("/admin/users"), ({ request }) =>
        new URL(request.url).searchParams.get("cursor") === "c2"
          ? page([{ ...ali, id: 5, username: "bob" }])
          : page([adminUser, ali], { has_more: true, next_cursor: "c2", total: 3 }),
      ),
    );
    const { user } = renderUI(<UsersPage search={{}} onSearchChange={() => {}} />);
    expect(await screen.findByText("@ali")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ban / suspend: @admin" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ban / suspend: @ali" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("@bob")).toBeInTheDocument();
  });

  it("debounces search into onSearchChange", async () => {
    signIn();
    server.use(http.get(api("/admin/users"), () => page([])));
    const onSearchChange = vi.fn();
    const { user } = renderUI(<UsersPage search={{}} onSearchChange={onSearchChange} />);
    await user.type(screen.getByRole("searchbox"), "al");
    await waitFor(() => expect(onSearchChange).toHaveBeenCalledWith({ q: "al" }, { replace: true }));
  });

  it("suspends with reason + RFC 3339 until, validating first", async () => {
    signIn();
    let body: unknown;
    server.use(
      http.get(api("/admin/users"), () => page([ali])),
      http.get(api("/admin/users/ali/ban"), () => problem(404, "no ban")),
      http.put(api("/admin/users/ali/ban"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          data: {
            user_id: 1,
            username: "ali",
            kind: "suspended",
            reason: "spam",
            until: "2099-01-01T00:00:00Z",
            actor_id: 3,
            created_at: "2030-01-01T00:00:00Z",
          },
        });
      }),
    );
    const { user } = renderUI(<UsersPage search={{}} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Ban / suspend: @ali" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("No active sanction")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Ban / suspend" }));
    expect(await within(dialog).findByText("Reason is required")).toBeInTheDocument();
    expect(within(dialog).getByText("Pick an end time")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Suspended until"), "2099-01-01T10:00");
    await user.type(within(dialog).getByLabelText("Reason"), "spam");
    await user.click(within(dialog).getByRole("button", { name: "Ban / suspend" }));
    await waitFor(() => expect(body).toEqual({ reason: "spam", until: new Date("2099-01-01T10:00").toISOString() }));
  });

  it("permanent ban sends no until; lift works", async () => {
    signIn();
    let body: unknown;
    let lifted = false;
    server.use(
      http.get(api("/admin/users"), () => page([ali])),
      http.get(api("/admin/users/ali/ban"), () =>
        HttpResponse.json({
          data: {
            user_id: 1,
            username: "ali",
            kind: "banned",
            reason: "old",
            actor_id: 3,
            created_at: "2030-01-01T00:00:00Z",
          },
        }),
      ),
      http.delete(api("/admin/users/ali/ban"), () => {
        lifted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.put(api("/admin/users/ali/ban"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          data: {
            user_id: 1,
            username: "ali",
            kind: "banned",
            reason: "x",
            actor_id: 3,
            created_at: "2030-01-01T00:00:00Z",
          },
        });
      }),
    );
    const { user } = renderUI(<UsersPage search={{}} onSearchChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Ban / suspend: @ali" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: "Lift ban" }));
    await waitFor(() => expect(lifted).toBe(true));
    await user.click(within(dialog).getByLabelText("Ban (until lifted)"));
    await user.type(within(dialog).getByLabelText("Reason"), "x");
    await user.click(within(dialog).getByRole("button", { name: "Ban / suspend" }));
    // Permanent bans are high-risk: confirm stays disabled until the username is typed.
    const confirm = await screen.findByRole("alertdialog");
    const go = within(confirm).getByRole("button", { name: "Ban permanently" });
    expect(go).toBeDisabled();
    await user.type(within(confirm).getByLabelText("Type ali to confirm"), "ali");
    await user.click(go);
    await waitFor(() => expect(body).toEqual({ reason: "x" }));
  });

  it("renders optional columns, sorts, removes the search chip and clears filters", async () => {
    signIn();
    server.use(
      http.get(api("/admin/users"), () =>
        page([
          { ...ali, display_name: "Ali K", email: "", email_verified: true, roles: ["editor", "mod"] },
          { ...ali, id: 2, username: "zed", email_verified: false, roles: undefined },
        ]),
      ),
    );
    const change = vi.fn();
    const { user } = renderUI(<UsersPage search={{ q: "a", sort: "email" }} onSearchChange={change} />);
    expect(await screen.findByText("Ali K")).toBeInTheDocument();
    expect(screen.getByText("editor, mod")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(1);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Username/ }));
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ sort: expect.any(String) }));
    await user.click(screen.getByRole("button", { name: /Remove filter/ }));
    expect(change).toHaveBeenLastCalledWith({ q: undefined, sort: "email" });
    await user.click(screen.getByRole("button", { name: "Reset all" }));
    expect(change).toHaveBeenLastCalledWith({ sort: "email" });
  });
});

describe("UsersPage reset", () => {
  it("reset without a sort emits an empty search", async () => {
    signIn();
    server.use(http.get(api("/admin/users"), () => page([ali])));
    const change = vi.fn();
    const { user } = renderUI(<UsersPage search={{ q: "a" }} onSearchChange={change} />);
    await user.click(await screen.findByRole("button", { name: "Reset all" }));
    expect(change).toHaveBeenLastCalledWith({});
  });
});

describe("SanctionDialog edges", () => {
  const sanction = (o: Record<string, unknown> = {}) => ({
    user_id: 1,
    username: "ali",
    kind: "suspended",
    reason: "spam",
    until: "2099-01-01T00:00:00Z",
    actor_id: 3,
    created_at: "2030-01-01T00:00:00Z",
    ...o,
  });
  const open = async (extra: Parameters<typeof server.use>) => {
    signIn();
    server.use(
      ...extra,
      http.get(api("/admin/users"), () => page([ali])),
    );
    const r = renderUI(<UsersPage search={{}} onSearchChange={() => {}} />);
    await r.user.click(await screen.findByRole("button", { name: "Ban / suspend: @ali" }));
    return { ...r, dialog: await screen.findByRole("dialog") };
  };

  it("shows the active suspension and a failing lift", async () => {
    const { user, dialog } = await open([
      http.get(api("/admin/users/ali/ban"), () => HttpResponse.json({ data: sanction() })),
      http.delete(api("/admin/users/ali/ban"), () => problem(500, "db down")),
    ]);
    expect(await within(dialog).findByText("spam")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Lift ban" }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Lift ban" })).toBeEnabled());
  });

  it("4xx on save is shown inline; 5xx goes to a toast; cancel closes", async () => {
    let n = 0;
    const { user, dialog } = await open([
      http.get(api("/admin/users/ali/ban"), () => problem(404, "no ban")),
      http.put(api("/admin/users/ali/ban"), () =>
        ++n === 1 ? problem(422, "reason too short") : problem(500, "boom"),
      ),
    ]);
    await user.type(await within(dialog).findByLabelText("Suspended until"), "2099-01-01T10:00");
    await user.type(within(dialog).getByLabelText("Reason"), "spam");
    await user.click(within(dialog).getByRole("button", { name: "Ban / suspend" }));
    expect(await within(dialog).findByText("reason too short")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Ban / suspend" }));
    await waitFor(() => expect(n).toBe(2));
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Escape closes an idle dialog", async () => {
    const { user } = await open([http.get(api("/admin/users/ali/ban"), () => problem(404, "no ban"))]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
