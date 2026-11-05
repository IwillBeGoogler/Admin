import { z } from "zod";
import { reportStatusSchema } from "./report";

export const feedbackKinds = ["bug", "idea", "other"] as const;
export const feedbackKindSchema = z.enum(feedbackKinds);
export type FeedbackKind = z.infer<typeof feedbackKindSchema>;

/** Same three states as a report; unlike a report, a decided entry can be reopened. */
export const feedbackStatusSchema = reportStatusSchema;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export const feedbackSchema = z.object({
  id: z.number(),
  /** 0 and "" for anonymous senders. */
  user_id: z.number().default(0),
  username: z.string().default(""),
  kind: feedbackKindSchema.or(z.string()),
  message: z.string(),
  contact_email: z.string().default(""),
  page_url: z.string().default(""),
  user_agent: z.string().default(""),
  app_version: z.string().default(""),
  error_message: z.string().default(""),
  error_stack: z.string().default(""),
  status: feedbackStatusSchema,
  resolved_by: z.number().default(0),
  resolved_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type Feedback = z.infer<typeof feedbackSchema>;

export const feedbackSearchSchema = z.object({
  status: z
    .enum([...feedbackStatusSchema.options, "all"])
    .catch("open")
    .default("open"),
  kind: z
    .enum([...feedbackKinds, "all"])
    .catch("all")
    .default("all"),
  sort: z.string().optional().catch(undefined),
});
export type FeedbackSearch = z.infer<typeof feedbackSearchSchema>;
