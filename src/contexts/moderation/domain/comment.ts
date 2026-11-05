import { z } from "zod";

export const commentSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  parent_id: z.number().default(0),
  user_id: z.number().default(0),
  author: z.string().default(""),
  text: z.string(),
  created_at: z.string(),
  likes: z.number().default(0),
});
export type Comment = z.infer<typeof commentSchema>;

/** Short single-line preview for tables. */
export const excerpt = (s: string, max = 140) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

/** The comments API has no search; `q` filters the loaded rows by text or author. */
export const commentsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});
export type CommentsSearch = z.infer<typeof commentsSearchSchema>;

export const matchesComment = (c: Comment, q: string | undefined) => {
  const needle = q?.trim().toLowerCase();
  if (!needle) return true;
  return c.text.toLowerCase().includes(needle) || c.author.toLowerCase().includes(needle);
};
