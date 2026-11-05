import {
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { nextPageRequest, type PageRequest } from "@/shared/http";
import type { DraftPayload, PostFilters } from "../domain/post";
import { sortTags } from "../domain/taxonomy";
import {
  categoryRepository,
  labelRepository,
  postRepository,
  tagRepository,
} from "../infrastructure/contentRepository";

const PAGE = 20;

export const contentKeys = {
  all: ["content"] as const,
  posts: () => [...contentKeys.all, "posts"] as const,
  postList: (f: PostFilters) => [...contentKeys.posts(), "list", f] as const,
  post: (id: number) => [...contentKeys.posts(), "detail", id] as const,
  revisions: (id: number) => [...contentKeys.post(id), "revisions"] as const,
  revision: (id: number, v: number) => [...contentKeys.revisions(id), v] as const,
  categories: () => [...contentKeys.all, "categories"] as const,
  labels: () => [...contentKeys.all, "labels"] as const,
  tags: () => [...contentKeys.all, "tags"] as const,
};

export const categoriesQuery = () =>
  queryOptions({
    queryKey: contentKeys.categories(),
    queryFn: ({ signal }) => categoryRepository.list(signal),
    staleTime: 60_000,
  });
export const labelsQuery = () =>
  queryOptions({
    queryKey: contentKeys.labels(),
    queryFn: ({ signal }) => labelRepository.list(signal),
    staleTime: 60_000,
  });
export const tagsQuery = () =>
  queryOptions({
    queryKey: contentKeys.tags(),
    queryFn: async ({ signal }) => sortTags(await tagRepository.list(signal)),
    staleTime: 60_000,
  });

export const usePosts = (filters: PostFilters) =>
  useInfiniteQuery({
    queryKey: contentKeys.postList(filters),
    queryFn: ({ pageParam, signal }) => postRepository.list(filters, pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
    placeholderData: keepPreviousData,
  });

export const usePost = (id: number | undefined) =>
  useQuery({
    queryKey: contentKeys.post(id ?? 0),
    queryFn: ({ signal }) => postRepository.get(id as number, signal),
    enabled: id !== undefined,
  });

export function useSavePost(id: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: DraftPayload) => (id === undefined ? postRepository.create(d) : postRepository.update(id, d)),
    onSuccess: (p) => {
      qc.setQueryData(contentKeys.post(p.id), p);
      void qc.invalidateQueries({ queryKey: contentKeys.posts() });
      void qc.invalidateQueries({ queryKey: contentKeys.categories() });
      void qc.invalidateQueries({ queryKey: contentKeys.tags() });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postRepository.remove(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: contentKeys.post(id) });
      void qc.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
}

export const useRevisions = (id: number) =>
  useQuery({ queryKey: contentKeys.revisions(id), queryFn: ({ signal }) => postRepository.revisions(id, signal) });

export const useRevision = (id: number, version: number | null) =>
  useQuery({
    queryKey: contentKeys.revision(id, version ?? 0),
    queryFn: ({ signal }) => postRepository.revision(id, version as number, signal),
    enabled: version !== null,
  });

export function useRestoreRevision(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => postRepository.restore(id, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.post(id) }),
  });
}

export const useCategories = () => useQuery(categoriesQuery());
export const useLabels = () => useQuery(labelsQuery());
export const useTags = () => useQuery(tagsQuery());

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => categoryRepository.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.categories() }),
  });
}
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => categoryRepository.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.all }),
  });
}
export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (l: { name: string; color: string }) => labelRepository.create(l),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.labels() }),
  });
}
export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => labelRepository.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.all }),
  });
}

/** Command palette lookup: first 5 public posts matching `q` (runs only for 2+ characters). */
export const usePostQuickSearch = (q: string, enabled = true) =>
  useQuery({
    queryKey: [...contentKeys.posts(), "quick", q] as const,
    queryFn: async ({ signal }) => (await postRepository.list({ q }, { limit: 5 }, signal)).items.slice(0, 5),
    enabled: enabled && q.trim().length >= 2,
    staleTime: 30_000,
  });
