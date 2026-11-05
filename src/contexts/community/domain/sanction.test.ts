import { describe, expect, it } from "vitest";
import {
  canSanction,
  isActive,
  isSuspension,
  sanctionFormSchema,
  sanctionSchema,
  toSanctionPayload,
  usersSearchSchema,
} from "./sanction";

const now = new Date("2030-01-01T00:00:00Z");
const ban = {
  user_id: 1,
  username: "ali",
  kind: "banned",
  reason: "spam",
  actor_id: 3,
  created_at: "2029-12-01T00:00:00Z",
};

describe("sanction rules", () => {
  it("kind follows until", () => {
    expect(isSuspension(sanctionSchema.parse(ban))).toBe(false);
    expect(isSuspension(sanctionSchema.parse({ ...ban, kind: "suspended", until: "2030-02-01T00:00:00Z" }))).toBe(true);
  });
  it("a suspension past its end is no longer active", () => {
    expect(isActive(sanctionSchema.parse(ban), now)).toBe(true);
    expect(isActive(sanctionSchema.parse({ ...ban, kind: "suspended", until: "2029-12-31T00:00:00Z" }), now)).toBe(
      false,
    );
  });
  it("cannot sanction yourself", () => {
    expect(canSanction(3, { id: 3 })).toBe(false);
    expect(canSanction(3, { id: 4 })).toBe(true);
    expect(canSanction(undefined, { id: 4 })).toBe(false);
  });
  it("form: reason required, <= 500 bytes", () => {
    const s = sanctionFormSchema(now);
    expect(s.safeParse({ kind: "banned", reason: "  ", until: "" }).success).toBe(false);
    expect(s.safeParse({ kind: "banned", reason: "x".repeat(501), until: "" }).success).toBe(false);
    expect(s.safeParse({ kind: "banned", reason: "spam", until: "" }).success).toBe(true);
  });
  it("form: suspension needs a future end", () => {
    const s = sanctionFormSchema(now);
    expect(s.safeParse({ kind: "suspended", reason: "r", until: "" }).success).toBe(false);
    expect(s.safeParse({ kind: "suspended", reason: "r", until: "2029-06-01T00:00" }).success).toBe(false);
    expect(s.safeParse({ kind: "suspended", reason: "r", until: "2030-06-01T00:00" }).success).toBe(true);
  });
  it("payload: until only for suspensions, as RFC 3339", () => {
    expect(toSanctionPayload({ kind: "banned", reason: " spam ", until: "2030-06-01T00:00" })).toEqual({
      reason: "spam",
    });
    const p = toSanctionPayload({ kind: "suspended", reason: "r", until: "2030-06-01T00:00" });
    expect(p.until).toBe(new Date("2030-06-01T00:00").toISOString());
  });
  it("users search keeps q", () => {
    expect(usersSearchSchema.parse({ q: "ali" })).toEqual({ q: "ali" });
    expect(usersSearchSchema.parse({ q: 5 })).toEqual({ q: undefined });
  });
});
