import { http } from "@/shared/api";
import { dataEnvelope, type Page, type PageRequest, pageEnvelope } from "@/shared/http";
import {
  type ClientError,
  type ClientErrorStatus,
  type ClientErrorsSearch,
  clientErrorSchema,
} from "../domain/clientError";
import { type Comment, commentSchema } from "../domain/comment";
import { type Feedback, type FeedbackSearch, type FeedbackStatus, feedbackSchema } from "../domain/feedback";
import { type Decision, type Report, type ReportsSearch, reportSchema } from "../domain/report";

export const reportRepository = {
  list: (s: ReportsSearch, p: PageRequest, signal?: AbortSignal): Promise<Page<Report>> =>
    http("/admin/reports", {
      query: { status: s.status === "all" ? undefined : s.status, page: p.page, limit: p.limit, cursor: p.cursor },
      schema: pageEnvelope(reportSchema),
      signal,
    }),
  decide: async (id: number, body: { status: Decision; remove_content: boolean }): Promise<Report> =>
    (await http(`/admin/reports/${id}`, { method: "PUT", body, schema: dataEnvelope(reportSchema) })).data,
};

export const feedbackRepository = {
  list: (s: FeedbackSearch, p: PageRequest, signal?: AbortSignal): Promise<Page<Feedback>> =>
    http("/admin/feedback", {
      query: {
        status: s.status === "all" ? undefined : s.status,
        kind: s.kind === "all" ? undefined : s.kind,
        page: p.page,
        limit: p.limit,
        cursor: p.cursor,
      },
      schema: pageEnvelope(feedbackSchema),
      signal,
    }),
  decide: async (id: number, status: FeedbackStatus): Promise<Feedback> =>
    (await http(`/admin/feedback/${id}`, { method: "PUT", body: { status }, schema: dataEnvelope(feedbackSchema) }))
      .data,
};

export const clientErrorRepository = {
  list: (s: ClientErrorsSearch, p: PageRequest, signal?: AbortSignal): Promise<Page<ClientError>> =>
    http("/admin/client-errors", {
      query: { status: s.status === "all" ? undefined : s.status, page: p.page, limit: p.limit, cursor: p.cursor },
      schema: pageEnvelope(clientErrorSchema),
      signal,
    }),
  decide: async (id: number, status: ClientErrorStatus): Promise<ClientError> =>
    (
      await http(`/admin/client-errors/${id}`, {
        method: "PUT",
        body: { status },
        schema: dataEnvelope(clientErrorSchema),
      })
    ).data,
};

export const commentRepository = {
  list: (p: PageRequest, signal?: AbortSignal): Promise<Page<Comment>> =>
    http("/admin/comments", {
      query: { page: p.page, limit: p.limit, cursor: p.cursor },
      schema: pageEnvelope(commentSchema),
      signal,
    }),
  remove: async (id: number): Promise<void> => void (await http(`/comments/${id}`, { method: "DELETE" })),
};
