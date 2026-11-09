import { z } from "zod";

const totalsSchema = z.object({
  post_views: z.number().default(0),
  diagram_views: z.number().default(0),
  visitors: z.number().default(0),
  posts: z.number().default(0),
  diagrams: z.number().default(0),
  users: z.number().default(0),
});

const topPostSchema = z.object({
  id: z.number(),
  slug: z.string().default(""),
  title: z.string().default(""),
  author: z.string().default(""),
  views: z.number().default(0),
});

const topDiagramSchema = z.object({
  slug: z.string().default(""),
  title: z.string().default(""),
  author: z.string().default(""),
  views: z.number().default(0),
});

const dayStatSchema = z.object({
  day: z.string(),
  post_views: z.number().default(0),
  diagram_views: z.number().default(0),
  page_views: z.number().default(0),
});

/** GET /admin/stats/site: view totals, top lists and the last 30 days. */
export const siteStatsSchema = z.object({
  totals: totalsSchema,
  top_posts: z.array(topPostSchema).default([]),
  top_diagrams: z.array(topDiagramSchema).default([]),
  days: z.array(dayStatSchema).default([]),
});
export type SiteStats = z.infer<typeof siteStatsSchema>;
export type SiteDayStat = z.infer<typeof dayStatSchema>;

/** True when nothing was viewed in the whole period or ever. */
export const noViews = (s: SiteStats) =>
  s.totals.post_views === 0 &&
  s.totals.diagram_views === 0 &&
  s.days.every((d) => d.post_views + d.diagram_views + d.page_views === 0);
