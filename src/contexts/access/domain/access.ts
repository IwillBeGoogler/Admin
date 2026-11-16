import { z } from "zod";
import { permissionCode } from "@/contexts/identity";

export const permissionSchema = z
  .object({
    resource: z.string(),
    action: z.string(),
    description: z.string().default(""),
    code: z.string().optional(),
  })
  .transform((p) => ({ ...p, code: p.code ?? permissionCode(p) }));
export type Permission = z.infer<typeof permissionSchema>;

export const grantablePermissions = (all: Permission[], granted: { resource: string; action: string }[]) => {
  const have = new Set<string>(granted.map(permissionCode));
  return all.filter((p) => !have.has(p.code));
};

/** Guard: ^[a-z0-9_-]{2,64}$. */
export const roleInputSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{2,64}$/, "roles.badName"),
  title: z.string().trim(),
  description: z.string().trim(),
  wildcard: z.boolean(),
});
export type RoleInput = z.infer<typeof roleInputSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  current: z.boolean().default(false),
  ip: z.string().default(""),
  user_agent: z.string().default(""),
  created_at: z.string(),
  last_seen_at: z.string(),
  expires_at: z.string(),
});
export type Session = z.infer<typeof sessionSchema>;

export const sortSessions = (s: Session[]) =>
  [...s].sort((a, b) => Number(b.current) - Number(a.current) || b.last_seen_at.localeCompare(a.last_seen_at));

export const auditEventSchema = z.object({
  id: z.string(),
  occurred_at: z.string(),
  actor_id: z.string().default(""),
  action: z.string(),
  target: z.string().default(""),
  success: z.boolean().default(true),
  ip: z.string().default(""),
  user_agent: z.string().default(""),
  metadata: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((m) => m ?? {}),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const auditSearchSchema = z.object({
  actor: z.string().optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(500).catch(100).default(100),
  sort: z.string().optional().catch(undefined),
});
export type AuditSearch = z.infer<typeof auditSearchSchema>;

export type DeviceKind = "mobile" | "tablet" | "desktop" | "cli" | "unknown";
/** Device type from a user agent; drives the session icon. */
export const deviceKind = (ua: string): DeviceKind => {
  if (!ua) return "unknown";
  if (/curl\/|Wget|HTTPie|PostmanRuntime|Go-http-client|python-requests|okhttp|bot|spider/i.test(ua)) return "cli";
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return "mobile";
  if (/Windows|Macintosh|Mac OS X|Linux|CrOS|X11/.test(ua)) return "desktop";
  return "unknown";
};

export interface SessionStats {
  total: number;
  /** Seen within the last ACTIVE_WINDOW_MS. */
  active: number;
  uniqueIps: number;
  byDevice: [DeviceKind, number][];
  /** Started within the last 24 hours. */
  started24h: number;
  /** Expiring within the next 24 hours. */
  expiringSoon: number;
  /** Mean time since start, ms; 0 with no sessions. */
  avgAgeMs: number;
  byBrowser: [string, number][];
  byOs: [string, number][];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Browser family from a user agent; "Other" when unknown. */
export const browserName = (ua: string): string => {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Firefox\/|FxiOS/.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS/.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  if (/curl\/|Wget|HTTPie|PostmanRuntime|Go-http-client|python-requests|okhttp/i.test(ua)) return "CLI";
  return "Other";
};

/** OS family from a user agent; "Other" when unknown. */
export const osName = (ua: string): string => {
  if (/Windows/.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux|X11/.test(ua)) return "Linux";
  return "Other";
};

const ranked = <K extends string>(m: Map<K, number>): [K, number][] =>
  [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

/** Totals over a list of sessions; devices sorted by count, then name. */
export const sessionStats = (sessions: Session[], now: number = Date.now()): SessionStats => {
  const devices = new Map<DeviceKind, number>();
  const ips = new Set<string>();
  const browsers = new Map<string, number>();
  const systems = new Map<string, number>();
  let active = 0;
  let started24h = 0;
  let expiringSoon = 0;
  let ageSum = 0;
  let ageN = 0;
  for (const s of sessions) {
    const b = browserName(s.user_agent);
    browsers.set(b, (browsers.get(b) ?? 0) + 1);
    const o = osName(s.user_agent);
    systems.set(o, (systems.get(o) ?? 0) + 1);
    const born = Date.parse(s.created_at);
    if (Number.isFinite(born)) {
      ageSum += Math.max(0, now - born);
      ageN++;
      if (now - born <= DAY_MS) started24h++;
    }
    const exp = Date.parse(s.expires_at);
    if (Number.isFinite(exp) && exp >= now && exp - now <= DAY_MS) expiringSoon++;
    const k = deviceKind(s.user_agent);
    devices.set(k, (devices.get(k) ?? 0) + 1);
    if (s.ip) ips.add(s.ip);
    const seen = Date.parse(s.last_seen_at);
    if (Number.isFinite(seen) && now - seen <= ACTIVE_WINDOW_MS) active++;
  }
  return {
    total: sessions.length,
    active,
    uniqueIps: ips.size,
    byDevice: ranked(devices),
    started24h,
    expiringSoon,
    avgAgeMs: ageN ? ageSum / ageN : 0,
    byBrowser: ranked(browsers),
    byOs: ranked(systems),
  };
};

// ABAC policies (Guard): evaluated before role permissions, by priority; deny wins.
export const policyOperators = ["eq", "ne", "gt", "lt", "gte", "lte", "in", "not_in", "contains"] as const;
export const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum(policyOperators),
  value: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
});
export type Condition = z.infer<typeof conditionSchema>;
export interface ConditionGroup {
  operator: "and" | "or";
  negate: boolean;
  conditions: Condition[];
  groups: ConditionGroup[];
}
export const conditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({
    operator: z.enum(["and", "or"]),
    negate: z.boolean().default(false),
    conditions: z
      .array(conditionSchema)
      .nullish()
      .transform((c) => c ?? []),
    groups: z
      .array(conditionGroupSchema)
      .nullish()
      .transform((g) => g ?? []),
  }),
) as z.ZodType<ConditionGroup>;
export const policySchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.string(),
  action: z.string(),
  effect: z.enum(["allow", "deny"]),
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
  /** Guard v0.4+: empty = every user; otherwise holders of any of these roles. */
  roles: z
    .array(z.string())
    .nullish()
    .transform((r) => r ?? []),
  root: conditionGroupSchema.nullish().transform((r) => r ?? null),
});
export type Policy = z.infer<typeof policySchema>;

const target = z
  .string()
  .trim()
  .regex(/^(\*|[a-z0-9_-]+)$/, "policies.badTarget");
/** Form shape: a flat condition list in the root group; nested groups are kept as they are. */
export const policyInputSchema = z.object({
  name: z.string().trim().min(1, "policies.nameRequired"),
  resource: target,
  action: target,
  effect: z.enum(["allow", "deny"]),
  priority: z.number({ error: "policies.priorityRequired" }).int(),
  enabled: z.boolean(),
  /** Empty = every user; otherwise the caller must hold one of these roles. */
  roles: z.array(z.string()),
  match: z.enum(["and", "or"]),
  negate: z.boolean(),
  conditions: z.array(
    z.object({
      field: z.string().trim().min(1, "policies.fieldRequired"),
      operator: z.enum(policyOperators),
      // an empty value makes `not_in []` match everyone: refuse it
      value: z.string().refine((v) => v.split(",").some((s) => s.trim() !== ""), "policies.valueRequired"),
    }),
  ),
});
export type PolicyInput = z.infer<typeof policyInputSchema>;

/** Comma-separated in the form, a list in Guard. */
const splitValue = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const policyRoles = (p: Pick<Policy, "roles">) => p.roles;

export const policyToInput = (p: Policy | null): PolicyInput => ({
  name: p?.name ?? "",
  resource: p?.resource ?? "",
  action: p?.action ?? "",
  effect: p?.effect ?? "allow",
  priority: p?.priority ?? 100,
  enabled: p?.enabled ?? true,
  roles: p?.roles ?? [],
  match: p?.root?.operator ?? "and",
  negate: p?.root?.negate ?? false,
  conditions: (p?.root?.conditions ?? []).map((c) => ({ ...c, value: c.value.join(", ") })),
});

/** Nested groups the form does not edit; kept as they are. */
export const nestedGroups = (p: Policy | null) => p?.root?.groups ?? [];

export const inputToPolicy = (v: PolicyInput, nested: ConditionGroup[] = []): Omit<Policy, "id"> => {
  const conditions = v.conditions.map((c) => ({ field: c.field, operator: c.operator, value: splitValue(c.value) }));
  return {
    name: v.name,
    resource: v.resource,
    action: v.action,
    effect: v.effect,
    priority: v.priority,
    enabled: v.enabled,
    roles: v.roles,
    root:
      conditions.length || nested.length ? { operator: v.match, negate: v.negate, conditions, groups: nested } : null,
  };
};

/** Policies that apply to holders of `role`: scoped to it, or to every user. */
export const policiesForRole = (all: Policy[], role: string) =>
  all.filter((p) => p.roles.length === 0 || p.roles.includes(role));

/** Guard's evaluation order: the lowest priority number is strongest. */
export const sortPolicies = (p: Policy[]) =>
  [...p].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

/** Ready-made access rules: deny app.access, which closes the whole API. */
export const policyTemplates = {
  workingHours: (): Partial<PolicyInput> => ({
    name: "Closed outside working hours",
    resource: "app",
    action: "access",
    effect: "deny",
    priority: 1,
    match: "or",
    negate: false,
    conditions: [
      { field: "env.time", operator: "gte", value: "18:00" },
      { field: "env.time", operator: "lt", value: "09:00" },
    ],
  }),
  ipAllowlist: (): Partial<PolicyInput> => ({
    name: "Only from the office network",
    resource: "app",
    action: "access",
    effect: "deny",
    priority: 1,
    enabled: false, // never live until an IP list is filled in
    match: "and",
    negate: false,
    conditions: [{ field: "env.ip", operator: "not_in", value: "" }],
  }),
} as const;

/** One-line summary of a condition tree, e.g. `resource.owner_id eq $user.id`. */
/** Short form of each operator for one-line summaries. */
const opSymbol: Record<Condition["operator"], string> = {
  eq: "=",
  ne: "≠",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  in: "in",
  not_in: "not in",
  contains: "contains",
};

export const describeGroup = (g: ConditionGroup | null): string => {
  if (!g) return "";
  const parts = [
    ...g.conditions.map((c) => `${c.field} ${opSymbol[c.operator]} ${c.value.join(", ")}`),
    ...g.groups.map((s) => `(${describeGroup(s)})`),
  ];
  const s = parts.join(` ${g.operator.toUpperCase()} `);
  return g.negate ? `NOT (${s})` : s;
};

export const describeConditions = (p: Pick<Policy, "root">) => describeGroup(p.root);

/** Written by the API from its environment on every start; read-only here. */
export const isManaged = (p: Pick<Policy, "name">) => p.name.startsWith("config: ");
