import { z } from "zod";
import { list } from "@/shared/http/envelope";

export const glossaryLangs = ["", "uz", "ru", "en"] as const;

export const glossaryTermSchema = z.object({
  id: z.number(),
  term: z.string(),
  aliases: list(z.string()),
  definition: z.string(),
  lang: z.string().default(""),
});
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;

/** What the API takes; the form edits aliases as one comma separated string. */
export interface GlossaryPayload {
  term: string;
  aliases: string[];
  definition: string;
  lang: string;
}

const chars = (s: string) => [...s].length;

export const glossaryFormSchema = z.object({
  term: z
    .string()
    .trim()
    .min(1, "auth.required")
    .refine((s) => chars(s) <= 80, "glossary.termTooLong"),
  aliases: z.string(),
  definition: z
    .string()
    .trim()
    .min(1, "auth.required")
    .refine((s) => chars(s) <= 600, "glossary.definitionTooLong"),
  lang: z.enum(glossaryLangs),
});
export type GlossaryForm = z.infer<typeof glossaryFormSchema>;

/** "a, B ,b" -> ["a","B"]: trimmed, no blanks, no case-insensitive repeats of each other or of `term` (the server drops those too). */
export const parseAliases = (s: string, term = ""): string[] => {
  const seen = new Set([term.trim().toLowerCase()]);
  return s
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a && !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()));
};

export const toPayload = (f: GlossaryForm): GlossaryPayload => ({
  term: f.term.trim(),
  aliases: parseAliases(f.aliases, f.term),
  definition: f.definition.trim(),
  lang: f.lang,
});

export const toForm = (t: GlossaryTerm): GlossaryForm => ({
  term: t.term,
  aliases: t.aliases.join(", "),
  definition: t.definition,
  lang: (glossaryLangs as readonly string[]).includes(t.lang) ? (t.lang as GlossaryForm["lang"]) : "",
});

/** One term written for a single article; aliases edited as a comma separated string. */
export interface ArticleTermForm {
  term: string;
  aliases: string;
  definition: string;
}

export const articleTermSchema = z.object({
  term: z.string(),
  aliases: z.string(),
  definition: z.string(),
});

export const ARTICLE_LIMITS = { term: 80, definition: 600, aliases: 10, entries: 50 } as const;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Mirrors glossary.NormalizeEntries on the server. Returns an i18n key for the first problem, if any.
 * `others` are the article's other terms (the one being edited excluded).
 */
export function articleTermIssue(e: ArticleTermForm, others: readonly ArticleTermForm[]): string | undefined {
  const term = e.term.trim();
  const definition = e.definition.trim();
  const aliases = parseAliases(e.aliases, term);
  if (!term || !definition) return "auth.required";
  if (chars(term) > ARTICLE_LIMITS.term || aliases.some((a) => chars(a) > ARTICLE_LIMITS.term))
    return "glossary.termTooLong";
  if (chars(definition) > ARTICLE_LIMITS.definition) return "glossary.definitionTooLong";
  if (aliases.length > ARTICLE_LIMITS.aliases) return "glossary.tooManyAliases";
  if (others.length >= ARTICLE_LIMITS.entries) return "glossary.tooManyTerms";
  const used = new Set(others.flatMap((o) => [norm(o.term), ...parseAliases(o.aliases, o.term).map(norm)]));
  const mine = [norm(term), ...aliases.map(norm)];
  if (new Set(mine).size !== mine.length || mine.some((k) => used.has(k))) return "glossary.duplicate";
  return undefined;
}

/** First problem across a whole article list. */
export function articleTermsIssue(entries: readonly ArticleTermForm[]): string | undefined {
  if (entries.length > ARTICLE_LIMITS.entries) return "glossary.tooManyTerms";
  for (let i = 0; i < entries.length; i++) {
    const issue = articleTermIssue(entries[i] as ArticleTermForm, entries.slice(0, i));
    if (issue) return issue;
  }
  return undefined;
}

export interface ArticleTermPayload {
  term: string;
  aliases: string[];
  definition: string;
}

export const toArticleTermPayload = (e: ArticleTermForm): ArticleTermPayload => ({
  term: e.term.trim(),
  aliases: parseAliases(e.aliases, e.term),
  definition: e.definition.trim(),
});
