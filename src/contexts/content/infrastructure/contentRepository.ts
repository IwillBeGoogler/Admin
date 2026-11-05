import type { z } from "zod";
import { type ApiSchemas, http } from "@/shared/api";
import { dataEnvelope, list, type Page, type PageRequest, pageEnvelope } from "@/shared/http";
import { type DraftPayload, type Label, labelSchema, type Post, type PostFilters, postSchema } from "../domain/post";
import { type Revision, type RevisionDetail, revisionDetailSchema, revisionSchema } from "../domain/revision";
import { type Category, categorySchema, type Tag, tagSchema } from "../domain/taxonomy";

type S = ApiSchemas["schemas"];
const postPage = pageEnvelope(postSchema);
const many = <T extends z.ZodType>(s: T) => dataEnvelope(list(s));

export const postRepository = {
  /** Public feed, or every author's drafts/scheduled posts (needs post.read_draft). */
  list(filters: PostFilters, page: PageRequest, signal?: AbortSignal): Promise<Page<Post>> {
    const paging = { page: page.page, limit: page.limit ?? 20, cursor: page.cursor };
    if (filters.source === "draft" || filters.source === "scheduled")
      return http("/admin/posts", {
        query: {
          status: filters.source,
          q: filters.q,
          category: filters.category,
          label: filters.label,
          tag: filters.tag,
          ...paging,
        },
        schema: postPage,
        signal,
      });
    return http("/posts", {
      query: { q: filters.q, category: filters.category, label: filters.label, tag: filters.tag, ...paging },
      schema: postPage,
      signal,
    });
  },
  get: async (id: number, signal?: AbortSignal): Promise<Post> =>
    (await http(`/posts/${id}`, { schema: dataEnvelope(postSchema), signal })).data,
  create: async (d: DraftPayload): Promise<Post> =>
    (await http("/posts", { method: "POST", body: d, schema: dataEnvelope(postSchema) })).data,
  update: async (id: number, d: DraftPayload): Promise<Post> =>
    (await http(`/posts/${id}`, { method: "PUT", body: d, schema: dataEnvelope(postSchema) })).data,
  remove: async (id: number): Promise<void> => void (await http(`/posts/${id}`, { method: "DELETE" })),

  revisions: async (id: number, signal?: AbortSignal): Promise<Revision[]> =>
    (await http(`/posts/${id}/revisions`, { schema: many(revisionSchema), signal })).data,
  revision: async (id: number, version: number, signal?: AbortSignal): Promise<RevisionDetail> =>
    (await http(`/posts/${id}/revisions/${version}`, { schema: dataEnvelope(revisionDetailSchema), signal })).data,
  restore: async (id: number, version: number): Promise<void> =>
    void (await http(`/posts/${id}/revisions/${version}/restore`, { method: "POST" })),
};

export const categoryRepository = {
  list: async (signal?: AbortSignal): Promise<Category[]> =>
    (await http("/categories", { schema: many(categorySchema), signal })).data,
  create: async (name: string): Promise<Category> => {
    const body: S["categoryInput"] = { name };
    return (await http("/categories", { method: "POST", body, schema: dataEnvelope(categorySchema) })).data;
  },
  remove: async (id: number): Promise<void> => void (await http(`/categories/${id}`, { method: "DELETE" })),
};

export const labelRepository = {
  list: async (signal?: AbortSignal): Promise<Label[]> =>
    (await http("/labels", { schema: many(labelSchema), signal })).data,
  create: async (input: { name: string; color: string }): Promise<Label> => {
    const body: S["labelInput"] = input;
    return (await http("/labels", { method: "POST", body, schema: dataEnvelope(labelSchema) })).data;
  },
  remove: async (id: number): Promise<void> => void (await http(`/labels/${id}`, { method: "DELETE" })),
};

export const tagRepository = {
  list: async (signal?: AbortSignal): Promise<Tag[]> => (await http("/tags", { schema: many(tagSchema), signal })).data,
};
