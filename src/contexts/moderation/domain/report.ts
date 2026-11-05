import { z } from "zod";

export const reportStatuses = ["open", "resolved", "dismissed"] as const;
export const reportStatusSchema = z.enum(reportStatuses);
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type Decision = Exclude<ReportStatus, "open">;

export const reportReasons = ["spam", "abuse", "harassment", "off_topic", "other"] as const;
export const targetTypes = ["post", "comment", "user", "diagram"] as const;

export const reportSchema = z.object({
  id: z.number(),
  reporter_id: z.number().default(0),
  reporter: z.string().default(""),
  target_type: z.enum(targetTypes),
  /** 0 for diagram targets, which are addressed by target_file_id. */
  target_id: z.number().default(0),
  /** Set when target_type is "diagram". */
  target_file_id: z.string().optional(),
  /** Owning project of a reported diagram file, when known (links to its admin page). */
  target_project_id: z.string().optional(),
  reason: z.enum(reportReasons).or(z.string()),
  note: z.string().default(""),
  status: reportStatusSchema,
  resolved_by: z.number().default(0),
  resolved_at: z.string().nullable().optional(),
  created_at: z.string(),
  /** Open reports on the same target. */
  reports: z.number().default(0),
});
export type Report = z.infer<typeof reportSchema>;

export const canDecide = (r: Report) => r.status === "open";
export const canRemoveContent = (r: Report, d: Decision) => d === "resolved" && r.target_type !== "user";

export const decisionPayload = (r: Report, status: Decision, removeContent: boolean) => ({
  status,
  remove_content: removeContent && canRemoveContent(r, status),
});

export const reportsSearchSchema = z.object({
  status: z
    .enum([...reportStatuses, "all"])
    .catch("open")
    .default("open"),
  sort: z.string().optional().catch(undefined),
});
export type ReportsSearch = z.infer<typeof reportsSearchSchema>;
