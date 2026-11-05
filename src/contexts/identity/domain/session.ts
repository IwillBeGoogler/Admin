import { z } from "zod";
import { list } from "@/shared/http/envelope";
import { roleSchema } from "./permissions";

export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().optional(),
  email_verified: z.boolean().optional().default(false),
  display_name: z.string().default(""),
  bio: z.string().default(""),
  avatar_url: z.string().default(""),
  roles: list(z.string()),
  deleted_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const sessionSchema = z.object({ token: z.string().min(1), expires_at: z.string(), user: userSchema });
export type Session = z.infer<typeof sessionSchema>;

/** POST /auth/login answers either a session or a two-factor challenge. */
export const loginResultSchema = z.union([
  sessionSchema.transform((s) => ({ kind: "session" as const, ...s })),
  z
    .object({ mfa_required: z.literal(true), mfa_token: z.string().min(1) })
    .transform((c) => ({ kind: "mfa" as const, mfaToken: c.mfa_token })),
]);
export type LoginResult = z.infer<typeof loginResultSchema>;

/** GET /guard/auth/me: the caller's Guard roles with their permissions. */
export const guardMeSchema = z.object({
  roles: list(roleSchema),
  session_expires_at: z.string().optional(),
});

export const loginInputSchema = z.object({
  login: z.string().trim().min(1, "auth.required"),
  password: z.string().min(1, "auth.required"),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/** TOTP code (6 digits) or a backup code. */
export const mfaInputSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{6,20}$/, "auth.required"),
});
export type MfaInput = z.infer<typeof mfaInputSchema>;
