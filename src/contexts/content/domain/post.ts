import { z } from "zod";
import { list } from "@/shared/http/envelope";
import { localInputToRFC3339, rfc3339ToLocalInput, toTags } from "@/shared/lib/format";

export const postStatuses = ["draft", "published", "scheduled", "unlisted"] as const;
export const postStatusSchema = z.enum(postStatuses);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const labelSchema = z.object({ id: z.number(), name: z.string(), color: z.string() });
export type Label = z.infer<typeof labelSchema>;

export const postSchema = z.object({
  id: z.number(),
  title: z.string(),
  subtitle: z.string().default(""),
  slug: z.string(),
  status: postStatusSchema.or(z.string()),
  body: z.string().default(""),
  body_html: z.string().optional(),
  reading_time: z.number().default(0),
  publish_at: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  author: z.string().default(""),
  category_id: z.number().default(0),
  publication_id: z.number().default(0),
  user_id: z.number(),
  cover_url: z.string().default(""),
  canonical_url: z.string().default(""),
  tags: list(z.string()),
  labels: list(labelSchema),
  likes: z.number().default(0),
  claps: z.number().default(0),
  comments_count: z.number().default(0),
  views: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Post = z.infer<typeof postSchema>;

/** Server limits are in bytes (Go len). */
const bytes = (s: string) => new TextEncoder().encode(s).length;
const LIMITS = { title: 200, subtitle: 300, body: 100_000, tags: 10, labels: 5 } as const;
const isHttp = (u: string) => /^https?:\/\//i.test(u);

export const postFormBase = z.object({
  title: z.string().trim(),
  subtitle: z.string().trim(),
  body: z.string(),
  status: postStatusSchema,
  publishAt: z.string(),
  categoryId: z.number().int().min(0),
  coverUrl: z.string().trim(),
  canonicalUrl: z.string().trim(),
  tags: z.string(),
  labelIds: z.array(z.number().int()),
});
export type PostForm = z.infer<typeof postFormBase>;

/** Same rules as post.Draft.Normalize on the server; messages are i18n keys. */
export const postFormSchema = (now: Date) =>
  postFormBase.superRefine((v, ctx) => {
    const issue = (path: keyof PostForm, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!v.title) issue("title", "posts.titleRequired");
    else if (bytes(v.title) > LIMITS.title) issue("title", "posts.titleTooLong");
    if (bytes(v.subtitle) > LIMITS.subtitle) issue("subtitle", "posts.subtitleTooLong");
    if (bytes(v.body) > LIMITS.body) issue("body", "posts.bodyTooLong");
    if (v.status === "scheduled") {
      const at = localInputToRFC3339(v.publishAt);
      if (!at) issue("publishAt", "posts.publishAtRequired");
      else if (new Date(at) <= now) issue("publishAt", "posts.publishAtFuture");
    }
    if (v.coverUrl && !v.coverUrl.startsWith("/api/uploads/") && !isHttp(v.coverUrl)) issue("coverUrl", "posts.badUrl");
    if (v.canonicalUrl && (!isHttp(v.canonicalUrl) || v.canonicalUrl.length > 2000))
      issue("canonicalUrl", "posts.badUrl");
    if (toTags(v.tags).length > LIMITS.tags) issue("tags", "posts.tooManyTags");
    if (new Set(v.labelIds).size > LIMITS.labels) issue("labelIds", "posts.tooManyLabels");
  });

export const emptyPostForm = (): PostForm => ({
  title: "",
  subtitle: "",
  body: "",
  status: "draft",
  publishAt: "",
  categoryId: 0,
  coverUrl: "",
  canonicalUrl: "",
  tags: "",
  labelIds: [],
});

export const postToForm = (p: Post): PostForm => ({
  title: p.title,
  subtitle: p.subtitle,
  body: p.body,
  status: postStatusSchema.catch("published").parse(p.status),
  publishAt: rfc3339ToLocalInput(p.publish_at),
  categoryId: p.category_id,
  coverUrl: p.cover_url,
  canonicalUrl: p.canonical_url,
  tags: (p.tags ?? []).join(", "),
  labelIds: (p.labels ?? []).map((l) => l.id),
});

/** Body for POST /posts and PUT /posts/{id} (post.Draft JSON). */
export interface DraftPayload {
  title: string;
  subtitle: string;
  body: string;
  status: PostStatus;
  publish_at: string | null;
  category_id: number;
  cover_url: string;
  canonical_url: string;
  tags: string[];
  label_ids: number[];
}

export const toDraftPayload = (f: PostForm): DraftPayload => ({
  title: f.title.trim(),
  subtitle: f.subtitle.trim(),
  body: f.body,
  status: f.status,
  publish_at: f.status === "scheduled" ? (localInputToRFC3339(f.publishAt) ?? null) : null,
  category_id: f.categoryId,
  cover_url: f.coverUrl.trim(),
  canonical_url: f.canonicalUrl.trim(),
  tags: toTags(f.tags),
  label_ids: [...new Set(f.labelIds)].sort((a, b) => a - b),
});

/** Which list the posts table shows: the public feed or the admin's own drafts. */
export const postSources = ["public", "draft", "scheduled"] as const;
export type PostSource = (typeof postSources)[number];

export const postFiltersSchema = z.object({
  q: z.string().optional().catch(undefined),
  category: z.coerce.number().int().positive().optional().catch(undefined),
  label: z.coerce.number().int().positive().optional().catch(undefined),
  tag: z.string().optional().catch(undefined),
  source: z.enum(postSources).optional().catch(undefined),
  /** Client-side sort within loaded rows: "field" or "-field". */
  sort: z.string().optional().catch(undefined),
});
export type PostFilters = z.infer<typeof postFiltersSchema>;
