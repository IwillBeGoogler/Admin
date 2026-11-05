import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nextPageRequest, type PageRequest } from "@/shared/http";
import { byPosition, type ProjectsSearch, type TemplateInput } from "../domain/diagram";
import { diagramRepository, templateRepository } from "../infrastructure/diagramsRepository";

const PAGE = 20;
export const diagramKeys = {
  all: ["diagrams"] as const,
  stats: () => [...diagramKeys.all, "stats"] as const,
  projects: (s?: ProjectsSearch) =>
    s
      ? ([...diagramKeys.all, "projects", s.q ?? "", s.owner ?? ""] as const)
      : ([...diagramKeys.all, "projects"] as const),
  project: (id: string) => [...diagramKeys.all, "project", id] as const,
  templates: () => [...diagramKeys.all, "templates"] as const,
};

export const useDiagramStats = () =>
  useQuery({ queryKey: diagramKeys.stats(), queryFn: ({ signal }) => diagramRepository.stats(signal) });

export const useDiagramProjects = (s: ProjectsSearch) =>
  useInfiniteQuery({
    queryKey: diagramKeys.projects(s),
    queryFn: ({ pageParam, signal }) => diagramRepository.projects(s, pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
    placeholderData: keepPreviousData,
  });

export const useDiagramProject = (id: string) =>
  useQuery({ queryKey: diagramKeys.project(id), queryFn: ({ signal }) => diagramRepository.project(id, signal) });

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => diagramRepository.deleteProject(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: diagramKeys.projects() });
      void qc.invalidateQueries({ queryKey: diagramKeys.stats() });
      void qc.invalidateQueries({ queryKey: diagramKeys.templates() }); // templates of its files go with it
    },
  });
}

export function useRevokeShare(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => diagramRepository.revokeShare(shareId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: diagramKeys.project(projectId) });
      void qc.invalidateQueries({ queryKey: diagramKeys.projects() });
    },
  });
}

export const useTemplates = () =>
  useQuery({
    queryKey: diagramKeys.templates(),
    queryFn: ({ signal }) => templateRepository.list(signal),
    select: (all) => [...all].sort(byPosition),
  });

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: TemplateInput & { position: number }) => templateRepository.create(b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: diagramKeys.templates() }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<TemplateInput> & { position?: number }) =>
      templateRepository.update(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: diagramKeys.templates() }),
  });
}

export function useReorderTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => templateRepository.reorder(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: diagramKeys.templates() }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templateRepository.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: diagramKeys.templates() }),
  });
}
