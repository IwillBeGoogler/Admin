import { type Role, roleSchema } from "@/contexts/identity";
import { http } from "@/shared/api";
import { dataEnvelope, list } from "@/shared/http";
import {
  type AuditEvent,
  type AuditSearch,
  auditEventSchema,
  type Permission,
  type Policy,
  permissionSchema,
  policySchema,
  type RoleInput,
  type Session,
  sessionSchema,
} from "../domain/access";

const enc = encodeURIComponent;
const many = <T extends Parameters<typeof list>[0]>(s: T) => dataEnvelope(list(s));

export const roleRepository = {
  list: async (signal?: AbortSignal): Promise<Role[]> =>
    (await http("/guard/roles", { schema: many(roleSchema), signal })).data,
  create: async (r: RoleInput): Promise<Role> =>
    (await http("/guard/roles", { method: "POST", body: r, schema: dataEnvelope(roleSchema) })).data,
  remove: async (name: string): Promise<void> => void (await http(`/guard/roles/${enc(name)}`, { method: "DELETE" })),
  grant: async (name: string, code: string): Promise<void> =>
    void (await http(`/guard/roles/${enc(name)}/permissions`, { method: "POST", body: { code } })),
  revoke: async (name: string, code: string): Promise<void> =>
    void (await http(`/guard/roles/${enc(name)}/permissions/${enc(code)}`, { method: "DELETE" })),
};

export const permissionRepository = {
  list: async (signal?: AbortSignal): Promise<Permission[]> =>
    (await http("/guard/permissions", { schema: many(permissionSchema), signal })).data,
};

export const policyRepository = {
  list: async (signal?: AbortSignal): Promise<Policy[]> =>
    (await http("/guard/policies", { schema: many(policySchema), signal })).data,
  create: async (p: Omit<Policy, "id">): Promise<Policy> =>
    (await http("/guard/policies", { method: "POST", body: p, schema: dataEnvelope(policySchema) })).data,
  update: async (id: string, p: Omit<Policy, "id">): Promise<Policy> =>
    (await http(`/guard/policies/${enc(id)}`, { method: "PUT", body: p, schema: dataEnvelope(policySchema) })).data,
  remove: async (id: string): Promise<void> => void (await http(`/guard/policies/${enc(id)}`, { method: "DELETE" })),
  /** Bound to the role plus global ones, in evaluation order. */
  forRole: async (role: string, signal?: AbortSignal): Promise<Policy[]> =>
    (await http(`/guard/roles/${enc(role)}/policies`, { schema: many(policySchema), signal })).data,
};

export const sessionRepository = {
  mine: async (signal?: AbortSignal): Promise<Session[]> =>
    (await http("/me/sessions", { schema: many(sessionSchema), signal })).data,
  revokeMine: async (id: string): Promise<void> => void (await http(`/me/sessions/${enc(id)}`, { method: "DELETE" })),
  ofUser: async (userId: number, signal?: AbortSignal): Promise<Session[]> =>
    (await http(`/guard/users/${userId}/sessions`, { schema: many(sessionSchema), signal })).data,
  revokeAllOfUser: async (userId: number): Promise<void> =>
    void (await http(`/guard/users/${userId}/sessions`, { method: "DELETE" })),
};

export const auditRepository = {
  list: async (s: AuditSearch, signal?: AbortSignal): Promise<AuditEvent[]> =>
    (
      await http("/guard/audit", {
        query: { actor_id: s.actor, limit: s.limit },
        schema: many(auditEventSchema),
        signal,
      })
    ).data,
};
