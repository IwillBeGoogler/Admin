import { describe, expect, it } from "vitest";
import { ADMIN_PERMISSIONS, can, canAny, isAdmin, permissionsFromRoles } from "./permissions";

const role = (permissions: { resource: string; action: string }[], wildcard = false) => ({
  name: "r",
  title: "",
  description: "",
  is_system: false,
  wildcard,
  permissions,
});

describe("permissions", () => {
  it("unions role permissions as resource.action codes", () => {
    const p = permissionsFromRoles([
      role([{ resource: "report", action: "moderate" }]),
      role([{ resource: "user", action: "ban" }]),
    ]);
    expect(can(p, "report.moderate")).toBe(true);
    expect(can(p, "user.ban")).toBe(true);
    expect(can(p, "stats.read")).toBe(false);
  });
  it("wildcard roles grant everything", () => {
    const p = permissionsFromRoles([role([], true)]);
    expect(p.all).toBe(true);
    expect(can(p, "anything.at_all")).toBe(true);
  });
  it("canAny and isAdmin", () => {
    const writer = permissionsFromRoles([role([{ resource: "post", action: "create" }])]);
    expect(isAdmin(writer)).toBe(false);
    const mod = permissionsFromRoles([role([{ resource: "comment", action: "moderate" }])]);
    expect(isAdmin(mod)).toBe(true);
    expect(canAny(mod, ["user.ban", "comment.moderate"])).toBe(true);
    expect(canAny(mod, [])).toBe(true);
    expect(ADMIN_PERMISSIONS).toContain("stats.read");
  });
  it("no roles means nothing", () => {
    expect(isAdmin(permissionsFromRoles([]))).toBe(false);
  });
});
