import { z } from "zod";
import { list } from "@/shared/http/envelope";

const dayCount = z.object({ day: z.string(), count: z.number() });
const keyCount = z.object({ key: z.string(), count: z.number() });

/** GET /admin/analytics: DAU, funnel, retention and read time. */
export const productReportSchema = z.object({
  days: z.number(),
  dau: list(dayCount),
  wau: z.number().default(0),
  mau: z.number().default(0),
  signups: list(dayCount),
  avg_read_seconds: z.number().default(0),
  total_read_hours: z.number().default(0),
  funnel: list(z.object({ step: z.string(), count: z.number() })),
  retention: z
    .object({ cohort: z.number(), d1: z.number(), d7: z.number(), d30: z.number() })
    .default({ cohort: 0, d1: 0, d7: 0, d30: 0 }),
  top_paths: list(keyCount),
  languages: list(keyCount),
  referrers: list(keyCount),
  heatmap: list(z.object({ dow: z.number(), hour: z.number(), count: z.number() })),
  cohorts: list(z.object({ week: z.string(), size: z.number(), retained: list(z.number()) })),
});
export type ProductReport = z.infer<typeof productReportSchema>;

export const FUNNEL_STEPS = ["visit", "signup_open", "signup", "first_publish"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

/** Each funnel step with its conversion from the previous step (percent, 0 for the first). */
export const funnelRates = (funnel: ProductReport["funnel"]) =>
  FUNNEL_STEPS.map((step, i) => {
    const count = funnel.find((f) => f.step === step)?.count ?? 0;
    const prev = i === 0 ? 0 : (funnel.find((f) => f.step === FUNNEL_STEPS[i - 1])?.count ?? 0);
    return { step, count, rate: i === 0 || !prev ? 0 : Math.round((count / prev) * 100) };
  });

/** DAU/MAU stickiness, percent. */
export const stickiness = (r: ProductReport) => {
  const today = r.dau.at(-1)?.count ?? 0;
  return r.mau ? Math.round((today / r.mau) * 100) : 0;
};

export const pct = (share: number) => `${Math.round(share * 100)}%`;

/** "2m 05s" style read time. */
export const readTime = (seconds: number) => {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
};

/** Page views for one weekday (0 = Monday) as 24 hourly counts, from the backend's Sunday-first cells. */
export const heatRow = (cells: ProductReport["heatmap"], weekday: number) =>
  Array.from(
    { length: 24 },
    (_, hour) => cells.find((c) => (c.dow + 6) % 7 === weekday && c.hour === hour)?.count ?? 0,
  );
