import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { adminUser, page, problem } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { banRepository, userRepository } from "./communityRepository";

describe("userRepository", () => {
  it("searches with q and follows the cursor", async () => {
    server.use(
      http.get(api("/admin/users"), ({ request }) => {
        const u = new URL(request.url);
        expect(u.searchParams.get("q")).toBe("ad");
        return u.searchParams.get("cursor") === "c1"
          ? page([{ ...adminUser, id: 9, username: "adam" }], { has_more: false })
          : page([adminUser], { has_more: true, next_cursor: "c1", total: 2 });
      }),
    );
    const first = await userRepository.list("ad", { limit: 1 });
    expect(first.meta.nextCursor).toBe("c1");
    const second = await userRepository.list("ad", { cursor: first.meta.nextCursor });
    expect(second.items[0]?.username).toBe("adam");
  });
});

describe("banRepository", () => {
  const ban = {
    user_id: 1,
    username: "ali",
    kind: "suspended",
    reason: "spam",
    until: "2030-02-01T00:00:00Z",
    actor_id: 3,
    created_at: "2030-01-01T00:00:00Z",
  };
  it("get returns null on 404", async () => {
    server.use(http.get(api("/admin/users/ali/ban"), () => problem(404, "no ban")));
    expect(await banRepository.get("ali")).toBeNull();
  });
  it("get rethrows other errors", async () => {
    server.use(http.get(api("/admin/users/ali/ban"), () => problem(403, "forbidden")));
    await expect(banRepository.get("ali")).rejects.toMatchObject({ status: 403 });
  });
  it("put sends reason + until; lift deletes; list pages", async () => {
    server.use(
      http.put(api("/admin/users/ali/ban"), async ({ request }) => {
        expect(await request.json()).toEqual({ reason: "spam", until: "2030-02-01T00:00:00.000Z" });
        return HttpResponse.json({ data: ban });
      }),
      http.delete(api("/admin/users/ali/ban"), () => new HttpResponse(null, { status: 204 })),
      http.get(api("/admin/bans"), () => page([ban])),
    );
    expect((await banRepository.put("ali", { reason: "spam", until: "2030-02-01T00:00:00.000Z" })).kind).toBe(
      "suspended",
    );
    await banRepository.lift("ali");
    expect((await banRepository.list({})).items).toHaveLength(1);
  });
  it("encodes usernames", async () => {
    server.use(http.delete(api("/admin/users/a%2Fb/ban"), () => new HttpResponse(null, { status: 204 })));
    await banRepository.lift("a/b");
  });
});
