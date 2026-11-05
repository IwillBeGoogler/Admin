import { z } from "zod";

export const categorySchema = z.object({ id: z.number(), name: z.string(), count: z.number().default(0) });
export type Category = z.infer<typeof categorySchema>;

export const tagSchema = z.object({ name: z.string(), count: z.number().default(0) });
export type Tag = z.infer<typeof tagSchema>;

const bytes = (s: string) => new TextEncoder().encode(s).length;

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "auth.required")
    .refine((s) => bytes(s) <= 50, "categories.tooLong"),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const normalizeColor = (c: string) => {
  const v = c.trim();
  const hex = v.startsWith("#") ? v : `#${v}`;
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : v;
};

export const labelInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "auth.required")
    .refine((s) => bytes(s) <= 30, "labels.tooLong"),
  color: z
    .string()
    .transform(normalizeColor)
    .pipe(z.string().regex(/^#[0-9a-f]{6}$/, "labels.badColor")),
});
export type LabelInput = z.input<typeof labelInputSchema>;

export const sortTags = (tags: Tag[]) => [...tags].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
