import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nextPageRequest, type PageRequest } from "@/shared/http";
import type { SanctionForm } from "../domain/sanction";
import { toSanctionPayload } from "../domain/sanction";
import { banRepository, userRepository } from "../infrastructure/communityRepository";

const PAGE = 20;
export const communityKeys = {
  all: ["community"] as const,
  users: (q?: string) => [...communityKeys.all, "users", q ?? ""] as const,
  bans: () => [...communityKeys.all, "bans"] as const,
  ban: (username: string) => [...communityKeys.bans(), "user", username] as const,
};

export const useUsers = (q: string | undefined) =>
  useInfiniteQuery({
    queryKey: communityKeys.users(q),
    queryFn: ({ pageParam, signal }) => userRepository.list(q, pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
    placeholderData: keepPreviousData,
  });

export const useBans = () =>
  useInfiniteQuery({
    queryKey: communityKeys.bans(),
    queryFn: ({ pageParam, signal }) => banRepository.list(pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
  });

export const useBan = (username: string) =>
  useQuery({ queryKey: communityKeys.ban(username), queryFn: ({ signal }) => banRepository.get(username, signal) });

export function useSanction(username: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: SanctionForm) => banRepository.put(username, toSanctionPayload(f)),
    onSuccess: (s) => {
      qc.setQueryData(communityKeys.ban(username), s);
      void qc.invalidateQueries({ queryKey: communityKeys.bans() });
    },
  });
}

export function useLiftSanction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => banRepository.lift(username),
    onSuccess: (_, username) => {
      qc.setQueryData(communityKeys.ban(username), null);
      void qc.invalidateQueries({ queryKey: communityKeys.bans() });
    },
  });
}

/** Command palette lookup: first 5 users matching `q` (runs only for 2+ characters). */
export const useUserQuickSearch = (q: string, enabled = true) =>
  useQuery({
    queryKey: [...communityKeys.users(q), "quick"] as const,
    queryFn: async ({ signal }) => (await userRepository.list(q, { limit: 5 }, signal)).items.slice(0, 5),
    enabled: enabled && q.trim().length >= 2,
    staleTime: 30_000,
  });
