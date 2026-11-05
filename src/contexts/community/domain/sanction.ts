import { z } from "zod";
import { localInputToRFC3339 } from "@/shared/lib/format";

export const sanctionKinds = ["banned", "suspended"] as const;
export type SanctionKind = (typeof sanctionKinds)[number];

export const sanctionSchema = z.object({
  user_id: z.number(),
  username: z.string().default(""),
  kind: z.enum(sanctionKinds),
  reason: z.string().default(""),
  until: z.string().nullable().optional(),
  actor_id: z.number().default(0),
  created_at: z.string(),
});
export type Sanction = z.infer<typeof sanctionSchema>;

export const isSuspension = (s: Sanction) => s.kind === "suspended" && !!s.until;
export const isActive = (s: Sanction, now: Date) => !isSuspension(s) || new Date(s.until as string) > now;
export const canSanction = (actorId: number | undefined, target: { id: number }) =>
  actorId !== undefined && actorId !== target.id;

const bytes = (s: string) => new TextEncoder().encode(s).length;

export const sanctionFormBase = z.object({ kind: z.enum(sanctionKinds), reason: z.string(), until: z.string() });
export type SanctionForm = z.infer<typeof sanctionFormBase>;

/** Mirrors sanction.New on the server; messages are i18n keys. */
export const sanctionFormSchema = (now: Date) =>
  sanctionFormBase.superRefine((v, ctx) => {
    const reason = v.reason.trim();
    if (!reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "users.reasonRequired" });
    else if (bytes(reason) > 500) ctx.addIssue({ code: "custom", path: ["reason"], message: "users.reasonTooLong" });
    if (v.kind === "suspended") {
      const at = localInputToRFC3339(v.until);
      if (!at) ctx.addIssue({ code: "custom", path: ["until"], message: "users.untilRequired" });
      else if (new Date(at) <= now) ctx.addIssue({ code: "custom", path: ["until"], message: "users.untilFuture" });
    }
  });

/** PUT /admin/users/{username}/ban body (sanctionInput). */
export const toSanctionPayload = (f: SanctionForm): { reason: string; until?: string } => {
  const reason = f.reason.trim();
  const until = f.kind === "suspended" ? localInputToRFC3339(f.until) : undefined;
  return until ? { reason, until } : { reason };
};

export const usersSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});

export const bansSearchSchema = z.object({
  kind: z.enum(sanctionKinds).optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});
export type BansSearch = z.infer<typeof bansSearchSchema>;
export type UsersSearch = z.infer<typeof usersSearchSchema>;
