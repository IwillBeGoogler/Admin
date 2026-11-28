import { z } from "zod";

/** A challenge certificate; `revoked_at` marks a withdrawn one. */
export const certificateSchema = z.object({
  id: z.string(),
  holder_name: z.string(),
  username: z.string(),
  title: z.string(),
  days: z.number(),
  days_done: z.number(),
  best_streak: z.number(),
  issued_at: z.string(),
  revoked_at: z.string().optional(),
  revoke_reason: z.string().default(""),
});
export type Certificate = z.infer<typeof certificateSchema>;

/** Mirrors the server's limit, counted in characters. */
export const MAX_REVOKE_REASON = 500;
