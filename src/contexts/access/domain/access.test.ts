import { describe, expect, it } from "vitest";
import {
  auditEventSchema,
  auditSearchSchema,
  describeConditions,
  grantablePermissions,
  inputToPolicy,
  permissionSchema,
  policiesForRole,
  policyRoles,
  policySchema,
  policyToInput,
  roleInputSchema,
  sessionSchema,
  sortSessions,
} from "./access";

describe("access rules", () => {
  it("role names follow Guard: ^[a-z0-9_-]{2,64}$", () => {
    expect(roleInputSchema.safeParse({ name: "Editor", title: "", description: "", wildcard: false }).success).toBe(
      false,
    );
    expect(roleInputSchema.safeParse({ name: "e", title: "", description: "", wildcard: false }).success).toBe(false);
    expect(roleInputSchema.parse({ name: " editor_1 ", title: " Editor ", description: "", wildcard: false })).toEqual({
      name: "editor_1",
      title: "Editor",
      description: "",
      wildcard: false,
    });
  });
  it("permission code derived when missing", () => {
    expect(permissionSchema.parse({ resource: "post", action: "delete", description: "d" }).code).toBe("post.delete");
  });
  it("grantable = all minus already granted", () => {
    const all = [
      permissionSchema.parse({ resource: "a", action: "x" }),
      permissionSchema.parse({ resource: "b", action: "y" }),
    ];
    expect(grantablePermissions(all, [{ resource: "a", action: "x" }]).map((p) => p.code)).toEqual(["b.y"]);
  });
  it("current session first, then most recently seen", () => {
    const s = (id: string, last: string, current = false) =>
      sessionSchema.parse({
        id,
        ip: "",
        user_agent: "",
        created_at: last,
        last_seen_at: last,
        expires_at: last,
        current,
      });
    expect(
      sortSessions([
        s("a", "2030-01-01T00:00:00Z"),
        s("b", "2030-01-03T00:00:00Z"),
        s("c", "2029-01-01T00:00:00Z", true),
      ]).map((x) => x.id),
    ).toEqual(["c", "b", "a"]);
  });
  it("audit search: limit 1-500, default 100", () => {
    expect(auditSearchSchema.parse({})).toEqual({ limit: 100 });
    expect(auditSearchSchema.parse({ limit: 9999, actor: "3" })).toEqual({ limit: 100, actor: "3" });
    expect(
      auditEventSchema.parse({
        id: "1",
        occurred_at: "x",
        actor_id: "3",
        action: "auth.login",
        target: "3",
        success: true,
      }).metadata,
    ).toEqual({});
  });
});

describe("policy roles", () => {
  const input = {
    name: "mods edit",
    resource: "post",
    action: "update",
    effect: "allow" as const,
    priority: 50,
    enabled: true,
    roles: ["moderator", "editor"],
    match: "or" as const,
    negate: true,
    conditions: [{ field: "user.status", operator: "eq" as const, value: "active" }],
  };

  it("round-trips roles as the policy's own field", () => {
    const p = { id: "x", ...inputToPolicy(input) };
    expect(p.roles).toEqual(["moderator", "editor"]);
    expect(p.root?.conditions).toHaveLength(1);
    expect(policyToInput(p)).toEqual(input);
    expect(describeConditions(p)).toBe("NOT (user.status = active)");
  });

  it("roles only: no condition tree", () => {
    const p = { id: "x", ...inputToPolicy({ ...input, conditions: [] }) };
    expect(p.root).toBeNull();
    expect(policyRoles(p)).toEqual(["moderator", "editor"]);
  });

  it("lists policies for a role: its own and everyone's", () => {
    const mine = { id: "a", ...inputToPolicy(input) };
    const all = { id: "b", ...inputToPolicy({ ...input, roles: [] }) };
    const other = { id: "c", ...inputToPolicy({ ...input, roles: ["user"] }) };
    expect(policiesForRole([mine, all, other], "editor").map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("older Guard without roles parses as every user", () => {
    expect(policySchema.parse({ id: "1", name: "n", resource: "*", action: "*", effect: "allow" }).roles).toEqual([]);
  });
});
