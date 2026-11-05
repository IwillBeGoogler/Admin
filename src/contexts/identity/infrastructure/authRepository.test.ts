import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { tokens } from "@/shared/api";
import { api, server } from "@/test/server";
import { authRepository } from "./authRepository";

const user = {
  id: 3,
  username: "admin",
  email: "a@b.c",
  email_verified: true,
  display_name: "",
  bio: "",
  avatar_url: "",
  roles: ["super_admin"],
  created_at: "2026-10-05T08:39:30Z",
};

describe("authRepository", () => {
  it("login posts {login,password} and returns a session", async () => {
    server.use(
      http.post(api("/auth/login"), async ({ request }) => {
        expect(await request.json()).toEqual({ login: "admin", password: "pw" });
        return HttpResponse.json({ data: { token: "t", expires_at: "2030-01-01T00:00:00Z", user } });
      }),
    );
    const r = await authRepository.login({ login: "admin", password: "pw" });
    expect(r.kind).toBe("session");
  });

  it("login returns an MFA challenge", async () => {
    server.use(
      http.post(api("/auth/login"), () => HttpResponse.json({ data: { mfa_required: true, mfa_token: "m1" } })),
    );
    expect(await authRepository.login({ login: "a", password: "b" })).toEqual({ kind: "mfa", mfaToken: "m1" });
  });

  it("loginMfa posts mfa_token and code", async () => {
    server.use(
      http.post(api("/auth/login/2fa"), async ({ request }) => {
        expect(await request.json()).toEqual({ mfa_token: "m1", code: "123456" });
        return HttpResponse.json({ data: { token: "t2", expires_at: "2030-01-01T00:00:00Z", user } });
      }),
    );
    expect((await authRepository.loginMfa("m1", "123456")).token).toBe("t2");
  });

  it("bad credentials surface the problem detail", async () => {
    server.use(
      http.post(api("/auth/login"), () =>
        HttpResponse.json({ status: 401, detail: "invalid credentials" }, { status: 401 }),
      ),
    );
    await expect(authRepository.login({ login: "a", password: "b" })).rejects.toThrow("invalid credentials");
  });

  it("currentAdmin merges /me with guard roles into permissions", async () => {
    tokens.set({ token: "t", expiresAt: "x" });
    server.use(
      http.get(api("/me"), () => HttpResponse.json({ data: user })),
      http.get(api("/guard/auth/me"), () =>
        HttpResponse.json({
          data: {
            roles: [{ name: "moderator", wildcard: false, permissions: [{ resource: "report", action: "moderate" }] }],
          },
        }),
      ),
    );
    const me = await authRepository.currentAdmin();
    expect(me.user.username).toBe("admin");
    expect(me.permissions.codes.has("report.moderate")).toBe(true);
    expect(me.roles[0]?.name).toBe("moderator");
    tokens.set(null);
  });

  it("logout swallows network errors", async () => {
    server.use(http.post(api("/auth/logout"), () => HttpResponse.error()));
    await expect(authRepository.logout()).resolves.toBeUndefined();
  });
});
