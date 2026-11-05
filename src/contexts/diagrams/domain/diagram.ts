import { z } from "zod";
import { list } from "@/shared/http/envelope";

/** File kinds the editor produces: system design, ER diagram, UML, free board. */
export const fileKinds = ["sdd", "erd", "uml", "board"] as const;
export type FileKind = (typeof fileKinds)[number];

/** Ids may be numeric (users) or strings (diagram entities); keep them as strings. */
const id = z.union([z.string(), z.number()]).transform(String);

export const ownerSchema = z.object({ id, username: z.string() });

/** GET /admin/diagrams/stats */
export const diagramStatsSchema = z.object({
  projects: z.number().default(0),
  files: z.number().default(0),
  files_by_kind: z
    .object({
      sdd: z.number().default(0),
      erd: z.number().default(0),
      uml: z.number().default(0),
      board: z.number().default(0),
    })
    .default({ sdd: 0, erd: 0, uml: 0, board: 0 }),
  active_editors_7d: z.number().default(0),
  storage_bytes: z.number().default(0),
});
export type DiagramStats = z.infer<typeof diagramStatsSchema>;

export const projectSummarySchema = z.object({
  id,
  name: z.string(),
  owner: ownerSchema,
  files: z.number().default(0),
  updated_at: z.string(),
  thumbnail_url: z.string().nullish(),
  shared: z.boolean().default(false),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const fileSchema = z.object({
  id,
  name: z.string(),
  kind: z.enum(fileKinds).or(z.string()),
  version: z.number().default(1),
  updated_at: z.string(),
  thumbnail_url: z.string().nullish(),
});
export type DiagramFile = z.infer<typeof fileSchema>;

export const memberSchema = z.object({
  user_id: id,
  username: z.string(),
  role: z.string(),
  joined_at: z.string().nullish(),
});
export type Member = z.infer<typeof memberSchema>;

export const shareSchema = z.object({
  id,
  role: z.string(),
  created_by: z.string().default(""),
  created_at: z.string(),
  expires_at: z.string().nullish(),
  revoked_at: z.string().nullish(),
});
export type Share = z.infer<typeof shareSchema>;

export const projectDetailSchema = projectSummarySchema.omit({ files: true }).extend({
  created_at: z.string().nullish(),
  files: list(fileSchema),
  members: list(memberSchema),
  shares: list(shareSchema),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

export const isShareActive = (s: Share, now: Date = new Date()) =>
  !s.revoked_at && (!s.expires_at || new Date(s.expires_at) > now);

/** Template gallery sections: system design, database, object-oriented design. */
export const templateKinds = ["system", "db", "ood"] as const;
export type TemplateKind = (typeof templateKinds)[number];

export const templateSchema = z.object({
  id,
  title: z.string(),
  kind: z.enum(templateKinds),
  description: z.string().default(""),
  file_id: z.string(),
  published: z.boolean().default(false),
  position: z.number().default(0),
});
export type Template = z.infer<typeof templateSchema>;

/** Messages are i18n keys, as in the other admin forms. */
export const templateInputSchema = z.object({
  title: z.string().trim().min(1, "auth.required").max(120, "diagrams.tooLong"),
  kind: z.enum(templateKinds),
  description: z.string().trim().max(500, "diagrams.tooLong"),
  file_id: z.string().trim().min(1, "auth.required"),
  published: z.boolean(),
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

/** Templates in gallery order: position, then title. */
export const byPosition = (a: Template, b: Template) => a.position - b.position || a.title.localeCompare(b.title);

/** Next free position for a new template (appended last). */
export const nextPosition = (all: readonly Template[]) => all.reduce((m, t) => Math.max(m, t.position), 0) + 1;

export const projectsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  owner: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});
export type ProjectsSearch = z.infer<typeof projectsSearchSchema>;

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;
/** 1536 -> "1.5 KB" (binary steps, one decimal under 10). */
export const formatBytes = (n: number, locale: string): string => {
  let v = Math.max(0, n);
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 });
  return `${fmt.format(v)} ${UNITS[i]}`;
};
