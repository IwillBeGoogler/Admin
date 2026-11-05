import { z } from "zod";

const dayCount = z.object({ day: z.string(), count: z.number() });
const keyCount = z.object({ key: z.string(), count: z.number() });

/** GET /admin/analytics: DAU, funnel, retention and read time. */
export const productReportSchema = z.object({
  days: z.number(),
  dau: z.array(dayCount).default([]),
  wau: z.number().default(0),
  mau: z.number().default(0),
  signups: z.array(dayCount).default([]),
  avg_read_seconds: z.number().default(0),
  total_read_hours: z.number().default(0),
  funnel: z.array(z.object({ step: z.string(), count: z.number() })).default([]),
  retention: z
    .object({ cohort: z.number(), d1: z.number(), d7: z.number(), d30: z.number() })
    .default({ cohort: 0, d1: 0, d7: 0, d30: 0 }),
  top_paths: z.array(keyCount).default([]),
  languages: z.array(keyCount).default([]),
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
