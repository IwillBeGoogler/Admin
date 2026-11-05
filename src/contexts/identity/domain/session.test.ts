import { describe, expect, it } from "vitest";
import { loginInputSchema, loginResultSchema, mfaInputSchema } from "./session";

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

describe("session contract", () => {
  it("parses a full session", () => {
    const r = loginResultSchema.parse({ token: "t", expires_at: "2026-10-12T00:00:00Z", user });
    expect(r.kind).toBe("session");
    if (r.kind === "session") expect(r.user.username).toBe("admin");
  });
  it("parses an MFA challenge", () => {
    const r = loginResultSchema.parse({ mfa_required: true, mfa_token: "m" });
    expect(r).toEqual({ kind: "mfa", mfaToken: "m" });
  });
  it("rejects garbage", () => {
    expect(loginResultSchema.safeParse({ foo: 1 }).success).toBe(false);
  });
  it("validates login and code inputs", () => {
    expect(loginInputSchema.safeParse({ login: " ", password: "x" }).success).toBe(false);
    expect(loginInputSchema.parse({ login: " admin ", password: "p" }).login).toBe("admin");
    expect(mfaInputSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(mfaInputSchema.safeParse({ code: "12" }).success).toBe(false);
    expect(mfaInputSchema.parse({ code: " abcd-efgh " }).code).toBe("abcd-efgh");
  });
});
