import { z } from "zod";
import { list } from "@/shared/http/envelope";

export const permissionRefSchema = z.object({ resource: z.string(), action: z.string() });
export const roleSchema = z.object({
  name: z.string(),
  title: z.string().default(""),
  description: z.string().default(""),
  is_system: z.boolean().default(false),
  wildcard: z.boolean().default(false),
  permissions: list(permissionRefSchema),
});
export type Role = z.infer<typeof roleSchema>;

/** "resource.action", the form Guard and the API docs use. */
export type PermissionCode = `${string}.${string}`;

export interface PermissionSet {
  all: boolean;
  codes: ReadonlySet<string>;
}

export const permissionCode = (p: { resource: string; action: string }): PermissionCode => `${p.resource}.${p.action}`;

export const permissionsFromRoles = (roles: readonly Pick<Role, "wildcard" | "permissions">[]): PermissionSet => ({
  all: roles.some((r) => r.wildcard),
  codes: new Set(roles.flatMap((r) => (r.permissions ?? []).map(permissionCode))),
});

export const can = (p: PermissionSet, code: PermissionCode): boolean => p.all || p.codes.has(code);
export const canAny = (p: PermissionSet, codes: readonly PermissionCode[]): boolean =>
  codes.length === 0 || codes.some((c) => can(p, c));

/** Holding any of these makes an account an admin-panel user. */
export const ADMIN_PERMISSIONS = [
  "stats.read",
  "report.moderate",
  "comment.moderate",
  "user.read",
  "user.ban",
  "category.write",
  "label.write",
  "glossary.write",
  "role.read",
  "policy.read",
  "audit.read",
  "session.read",
  "diagrams.read",
  "diagrams.manage",
  "templates.manage",
] as const satisfies readonly PermissionCode[];

export const isAdmin = (p: PermissionSet) => canAny(p, ADMIN_PERMISSIONS);
