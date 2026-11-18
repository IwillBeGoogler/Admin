import { z } from "zod";
import { list } from "@/shared/http/envelope";

const day = z.object({ day: z.string(), count: z.number().default(0) });
const named = z.object({ key: z.string(), count: z.number().default(0) });
const num = z.number().default(0);

const postRow = z.object({
  id: z.number(),
  slug: z.string().default(""),
  title: z.string().default(""),
  author: z.string().default(""),
  likes: num,
  comments: num,
});

/** GET /admin/insights: posts, users, diagrams and moderation for the last N days. */
export const insightsSchema = z.object({
  days: num,
  posts: z.object({
    total: num,
    published: num,
    drafts: num,
    likes: num,
    comments: num,
    created: list(day),
    published_per_day: list(day),
    comments_per_day: list(day),
    by_category: list(named),
    top_liked: list(postRow),
    top_commented: list(postRow),
  }),
  users: z.object({
    total: num,
    new: num,
    verified: num,
    sanctioned: num,
    signups: list(day),
    top_authors: list(named),
  }),
  diagrams: z.object({
    projects: num,
    files: num,
    public: num,
    templates: num,
    created: list(day),
    by_kind: list(named),
    by_visibility: list(named),
    top_owners: list(named),
  }),
  moderation: z.object({
    open_reports: num,
    open_feedback: num,
    open_errors: num,
    avg_resolve_hours: num,
    opened: list(day),
    resolved: list(day),
    by_reason: list(named),
    feedback_by_kind: list(named),
  }),
});
export type Insights = z.infer<typeof insightsSchema>;
export type InsightDay = z.infer<typeof day>;
export type InsightNamed = z.infer<typeof named>;

export const INSIGHT_TABS = ["posts", "users", "diagrams", "moderation", "activity"] as const;
export type InsightTab = (typeof INSIGHT_TABS)[number];
export const INSIGHT_DAYS = [7, 30, 90] as const;

export const insightsSearchSchema = z.object({
  tab: z.enum(INSIGHT_TABS).catch("posts").default("posts"),
  days: z.coerce
    .number()
    .refine((n): n is (typeof INSIGHT_DAYS)[number] => (INSIGHT_DAYS as readonly number[]).includes(n))
    .catch(30)
    .default(30),
});
export type InsightsSearch = z.infer<typeof insightsSearchSchema>;

/** One chart row: a day plus one number per series key. */
export type SeriesRow = { day: string } & { [key: string]: string | number };

/** Merge daily series that share the same days into chart rows. */
export const mergeDays = (series: Record<string, InsightDay[]>): SeriesRow[] => {
  const keys = Object.keys(series);
  const days = [...new Set(keys.flatMap((k) => (series[k] ?? []).map((d) => d.day)))].sort();
  return days.map((day) => {
    const row: SeriesRow = { day };
    for (const k of keys) row[k] = series[k]?.find((p) => p.day === day)?.count ?? 0;
    return row;
  });
};

export const sumDays = (s: InsightDay[]) => s.reduce((n, d) => n + d.count, 0);

/** Audit events (GET /guard/audit) folded into daily counts and per-action buckets, last `days` days. */
export const activityFromAudit = (
  events: readonly { occurred_at: string; action: string; success: boolean; actor_id: string }[],
  days: number,
  now: Date = new Date(),
) => {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const byDay = new Map<string, { ok: number; failed: number }>();
  for (let i = 0; i < days; i++) {
    byDay.set(new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10), { ok: 0, failed: 0 });
  }
  const actions = new Map<string, number>();
  const actors = new Map<string, number>();
  let total = 0;
  let failed = 0;
  for (const e of events) {
    const d = byDay.get(e.occurred_at.slice(0, 10));
    if (!d) continue;
    total++;
    if (e.success) d.ok++;
    else {
      d.failed++;
      failed++;
    }
    actions.set(e.action, (actions.get(e.action) ?? 0) + 1);
    if (e.actor_id) actors.set(e.actor_id, (actors.get(e.actor_id) ?? 0) + 1);
  }
  const top = (m: Map<string, number>): InsightNamed[] =>
    [...m]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, 10);
  return {
    total,
    failed,
    logins: [...actions].filter(([a]) => /login|session/i.test(a)).reduce((n, [, c]) => n + c, 0),
    perDay: [...byDay].map(([day, v]) => ({ day, ok: v.ok, failed: v.failed })),
    actions: top(actions),
    actors: top(actors),
  };
};

/** Running total over a daily series, ending at `end` (e.g. today's total users). */
export const cumulative = (days: InsightDay[], end: number): InsightDay[] => {
  let run = end - sumDays(days);
  return days.map((d) => {
    run += d.count;
    return { day: d.day, count: run };
  });
};

/** Last 7 days against the 7 before, percent change; null when there is no earlier week to compare. */
export const weekOverWeek = (days: InsightDay[]): number | null => {
  if (days.length < 14) return null;
  const cur = sumDays(days.slice(-7));
  const prev = sumDays(days.slice(-14, -7));
  return prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
};

/** Counts sorted high to low with the running share of the total, percent. */
export const pareto = (rows: InsightNamed[]) => {
  const sorted = rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const total = sorted.reduce((n, r) => n + r.count, 0);
  let run = 0;
  return sorted.map((r) => {
    run += r.count;
    return { name: r.key, count: r.count, cum: Math.round((run / total) * 100) };
  });
};

/** Weeks (rows, Monday first) by weekday (columns, Monday first) of a daily series. */
export const calendarHeat = (days: InsightDay[]) => {
  const weeks: { label: string; values: number[] }[] = [];
  for (const d of days) {
    const date = new Date(`${d.day}T00:00:00Z`);
    const dow = (date.getUTCDay() + 6) % 7;
    const monday = new Date(date.getTime() - dow * 86_400_000).toISOString().slice(5, 10);
    let w = weeks.find((x) => x.label === monday);
    if (!w) {
      w = { label: monday, values: Array(7).fill(0) };
      weeks.push(w);
    }
    w.values = w.values.map((v, i) => (i === dow ? v + d.count : v));
  }
  return weeks;
};

/** Likes against comments for every post that shows up in either top list. */
export const engagementPoints = (p: Insights["posts"]) => {
  const seen = new Map<number, { title: string; likes: number; comments: number }>();
  for (const x of [...p.top_liked, ...p.top_commented]) {
    seen.set(x.id, { title: x.title, likes: x.likes, comments: x.comments });
  }
  return [...seen.values()];
};

/** Part of a whole as a percent, 0 when the whole is empty. */
export const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** i18n keys of the weekdays, Monday first. */
export const WEEKDAY_KEYS = [
  "insights.weekdays.mon",
  "insights.weekdays.tue",
  "insights.weekdays.wed",
  "insights.weekdays.thu",
  "insights.weekdays.fri",
  "insights.weekdays.sat",
  "insights.weekdays.sun",
] as const;
