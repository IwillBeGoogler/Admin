import { z } from "zod";

export const clientErrorStatuses = ["open", "resolved", "ignored"] as const;
export const clientErrorStatusSchema = z.enum(clientErrorStatuses);
export type ClientErrorStatus = z.infer<typeof clientErrorStatusSchema>;

/** One distinct JavaScript error from the web app, with how often it was seen. Holds no user data. */
export const clientErrorSchema = z.object({
  id: z.number(),
  message: z.string(),
  stack: z.string().default(""),
  page_url: z.string().default(""),
  user_agent: z.string().default(""),
  count: z.number(),
  status: clientErrorStatusSchema,
  first_seen: z.string(),
  last_seen: z.string(),
});
export type ClientError = z.infer<typeof clientErrorSchema>;

export const clientErrorsSearchSchema = z.object({
  status: z
    .enum([...clientErrorStatuses, "all"])
    .catch("open")
    .default("open"),
  sort: z.string().optional().catch(undefined),
});
export type ClientErrorsSearch = z.infer<typeof clientErrorsSearchSchema>;
