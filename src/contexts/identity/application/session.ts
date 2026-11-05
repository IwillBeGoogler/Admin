import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { tokens } from "@/shared/api";
import { canAny, can as canDo, type PermissionCode } from "../domain/permissions";
import type { LoginInput, Session } from "../domain/session";
import { authRepository } from "../infrastructure/authRepository";

export const identityKeys = { all: ["identity"] as const, me: () => [...identityKeys.all, "me"] as const };

export const currentAdminQuery = () =>
  queryOptions({
    queryKey: identityKeys.me(),
    queryFn: ({ signal }) => authRepository.currentAdmin(signal),
    staleTime: 5 * 60_000,
  });

export const useAuthToken = () => useSyncExternalStore(tokens.subscribe, tokens.get, tokens.get);
export const isSignedIn = () => tokens.get() !== null;

const storeSession = (s: Session) => tokens.set({ token: s.token, expiresAt: s.expires_at });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authRepository.login(input),
    onSuccess: (r) => {
      if (r.kind === "session") {
        storeSession(r);
        void qc.invalidateQueries({ queryKey: identityKeys.all });
      }
    },
  });
}

export function useLoginMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mfaToken, code }: { mfaToken: string; code: string }) => authRepository.loginMfa(mfaToken, code),
    onSuccess: (s) => {
      storeSession(s);
      void qc.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authRepository.logout(),
    onSettled: () => {
      tokens.set(null);
      qc.clear();
    },
  });
}

export const useCurrentAdmin = () => useQuery({ ...currentAdminQuery(), enabled: useAuthToken() !== null });

/** Permission checks for the signed-in admin; false while loading. */
export function usePermissions() {
  const { data } = useCurrentAdmin();
  return {
    can: (code: PermissionCode) => (data ? canDo(data.permissions, code) : false),
    canAny: (codes: readonly PermissionCode[]) => (data ? canAny(data.permissions, codes) : false),
    userId: data?.user.id,
  };
}
