import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { identityKeys } from "@/contexts/identity";
import type { AuditSearch, Policy, RoleInput } from "../domain/access";
import { sortPolicies, sortSessions } from "../domain/access";
import {
  auditRepository,
  permissionRepository,
  policyRepository,
  roleRepository,
  sessionRepository,
} from "../infrastructure/accessRepository";

export const accessKeys = {
  all: ["access"] as const,
  roles: () => [...accessKeys.all, "roles"] as const,
  permissions: () => [...accessKeys.all, "permissions"] as const,
  policies: () => [...accessKeys.all, "policies"] as const,
  rolePolicies: (role: string) => [...accessKeys.policies(), "role", role] as const,
  mySessions: () => [...accessKeys.all, "sessions", "me"] as const,
  userSessions: (id: number) => [...accessKeys.all, "sessions", "user", id] as const,
  audit: (s: AuditSearch) => [...accessKeys.all, "audit", s] as const,
};

export const useRoles = () =>
  useQuery({ queryKey: accessKeys.roles(), queryFn: ({ signal }) => roleRepository.list(signal) });
export const usePermissionList = () =>
  useQuery({
    queryKey: accessKeys.permissions(),
    queryFn: ({ signal }) => permissionRepository.list(signal),
    staleTime: 5 * 60_000,
  });

function useRoleMutation<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accessKeys.roles() });
      // deleting a role drops its policy bindings and disables policies bound only to it
      void qc.invalidateQueries({ queryKey: accessKeys.policies() });
      // the admin's own permissions may have changed
      void qc.invalidateQueries({ queryKey: identityKeys.me() });
    },
  });
}
export const useCreateRole = () => useRoleMutation((r: RoleInput) => roleRepository.create(r));
export const useDeleteRole = () => useRoleMutation((name: string) => roleRepository.remove(name));
export const useGrantPermission = () =>
  useRoleMutation(({ role, code }: { role: string; code: string }) => roleRepository.grant(role, code));
export const useRevokePermission = () =>
  useRoleMutation(({ role, code }: { role: string; code: string }) => roleRepository.revoke(role, code));

export const usePolicies = () =>
  useQuery({
    queryKey: accessKeys.policies(),
    queryFn: async ({ signal }) => sortPolicies(await policyRepository.list(signal)),
  });
export const useRolePolicies = (role: string) =>
  useQuery({
    queryKey: accessKeys.rolePolicies(role),
    queryFn: ({ signal }) => policyRepository.forRole(role, signal),
  });
function usePolicyMutation<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accessKeys.policies() });
      // a policy may change what the admin can do
      void qc.invalidateQueries({ queryKey: identityKeys.me() });
    },
  });
}
type PolicyBody = Omit<Policy, "id">;
export const useSavePolicy = () =>
  usePolicyMutation(({ id, body }: { id: string | null; body: PolicyBody }) =>
    id ? policyRepository.update(id, body) : policyRepository.create(body),
  );
export const useDeletePolicy = () => usePolicyMutation((id: string) => policyRepository.remove(id));

export const useMySessions = () =>
  useQuery({
    queryKey: accessKeys.mySessions(),
    queryFn: async ({ signal }) => sortSessions(await sessionRepository.mine(signal)),
  });
export const useUserSessions = (id: number | null) =>
  useQuery({
    queryKey: accessKeys.userSessions(id ?? 0),
    queryFn: async ({ signal }) => sortSessions(await sessionRepository.ofUser(id as number, signal)),
    enabled: id !== null,
  });

export function useRevokeMySession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionRepository.revokeMine(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessKeys.mySessions() }),
  });
}
export function useRevokeUserSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sessionRepository.revokeAllOfUser(id),
    onSuccess: (_, id) => qc.invalidateQueries({ queryKey: accessKeys.userSessions(id) }),
  });
}

export const useAudit = (s: AuditSearch) =>
  useQuery({ queryKey: accessKeys.audit(s), queryFn: ({ signal }) => auditRepository.list(s, signal) });
