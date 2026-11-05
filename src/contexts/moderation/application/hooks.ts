import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analyticsKeys } from "@/contexts/analytics";
import { contentKeys } from "@/contexts/content";
import { nextPageRequest, type PageRequest } from "@/shared/http";
import type { ClientError, ClientErrorStatus, ClientErrorsSearch } from "../domain/clientError";
import type { Feedback, FeedbackSearch, FeedbackStatus } from "../domain/feedback";
import { type Decision, decisionPayload, type Report, type ReportsSearch } from "../domain/report";
import {
  clientErrorRepository,
  commentRepository,
  feedbackRepository,
  reportRepository,
} from "../infrastructure/moderationRepository";

const PAGE = 20;
export const moderationKeys = {
  all: ["moderation"] as const,
  reports: (s?: ReportsSearch) =>
    s ? ([...moderationKeys.all, "reports", s] as const) : ([...moderationKeys.all, "reports"] as const),
  feedback: (s?: FeedbackSearch) =>
    s ? ([...moderationKeys.all, "feedback", s] as const) : ([...moderationKeys.all, "feedback"] as const),
  clientErrors: (s?: ClientErrorsSearch) =>
    s ? ([...moderationKeys.all, "client-errors", s] as const) : ([...moderationKeys.all, "client-errors"] as const),
  comments: () => [...moderationKeys.all, "comments"] as const,
};

export const useReports = (s: ReportsSearch) =>
  useInfiniteQuery({
    queryKey: moderationKeys.reports(s),
    queryFn: ({ pageParam, signal }) => reportRepository.list(s, pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
    placeholderData: keepPreviousData,
  });

/**
 * Open-report count for the nav pill and the "Open" tab: `meta.total` of page 1,
 * sharing the cache entry of the Reports page's "open" list.
 */
export const useOpenReportCount = (enabled = true) =>
  useInfiniteQuery({
    queryKey: moderationKeys.reports({ status: "open" }),
    queryFn: ({ pageParam, signal }) => reportRepository.list({ status: "open" }, pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
    select: (d) => d.pages[0]?.meta.total ?? 0,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled,
  });

/** Deciding one report closes every open report on that target, so refetch all lists. */
export function useDecideReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ report, status, removeContent }: { report: Report; status: Decision; removeContent: boolean }) =>
      reportRepository.decide(report.id, decisionPayload(report, status, removeContent)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: moderationKeys.reports() });
      void qc.invalidateQueries({ queryKey: contentKeys.all });
      void qc.invalidateQueries({ queryKey: analyticsKeys.all });
    },
  });
}

export const useFeedback = (s: FeedbackSearch) =>
  useInfiniteQuery({
    queryKey: moderationKeys.feedback(s),
    queryFn: ({ pageParam, signal }) => feedbackRepository.list(s, pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
    placeholderData: keepPreviousData,
  });

export function useDecideFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ feedback, status }: { feedback: Feedback; status: FeedbackStatus }) =>
      feedbackRepository.decide(feedback.id, status),
    onSettled: () => void qc.invalidateQueries({ queryKey: moderationKeys.feedback() }),
  });
}

export const useClientErrors = (s: ClientErrorsSearch) =>
  useInfiniteQuery({
    queryKey: moderationKeys.clientErrors(s),
    queryFn: ({ pageParam, signal }) => clientErrorRepository.list(s, pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
    placeholderData: keepPreviousData,
  });

export function useDecideClientError() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ error, status }: { error: ClientError; status: ClientErrorStatus }) =>
      clientErrorRepository.decide(error.id, status),
    onSettled: () => void qc.invalidateQueries({ queryKey: moderationKeys.clientErrors() }),
  });
}

export const useAdminComments = () =>
  useInfiniteQuery({
    queryKey: moderationKeys.comments(),
    queryFn: ({ pageParam, signal }) => commentRepository.list(pageParam, signal),
    initialPageParam: { limit: PAGE } as PageRequest,
    getNextPageParam: (last) => nextPageRequest(last.meta, PAGE),
  });

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => commentRepository.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moderationKeys.comments() });
      void qc.invalidateQueries({ queryKey: analyticsKeys.all });
    },
  });
}
