import { z } from "zod";

/** GET /admin/stats: site totals. */
export const statsSchema = z.object({
  posts: z.number().default(0),
  comments: z.number().default(0),
  likes: z.number().default(0),
  categories: z.number().default(0),
  users: z.number().default(0),
});
export type Stats = z.infer<typeof statsSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const ratios = (s: Stats) => ({
  likesPerPost: s.posts ? round2(s.likes / s.posts) : 0,
  commentsPerPost: s.posts ? round2(s.comments / s.posts) : 0,
});

export interface Counted {
  name: string;
  count: number;
}

/** Largest `n` non-empty rows; the remainder summed under `otherLabel`. */
export const topN = (rows: Counted[], n: number, otherLabel: string): Counted[] => {
  const sorted = rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const head = sorted.slice(0, n);
  const rest = sorted.slice(n).reduce((s, r) => s + r.count, 0);
  return rest > 0 ? [...head, { name: otherLabel, count: rest }] : head;
};

export const shareOf = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
