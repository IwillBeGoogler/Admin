import { type User, userSchema } from "@/contexts/identity";
import { type ApiSchemas, http } from "@/shared/api";
import { dataEnvelope, isApiError, type Page, type PageRequest, pageEnvelope } from "@/shared/http";
import { type Sanction, sanctionSchema } from "../domain/sanction";

const enc = encodeURIComponent;

export const userRepository = {
  list: (q: string | undefined, p: PageRequest, signal?: AbortSignal): Promise<Page<User>> =>
    http("/admin/users", {
      query: { q, page: p.page, limit: p.limit, cursor: p.cursor },
      schema: pageEnvelope(userSchema),
      signal,
    }),
};

export const banRepository = {
  list: (p: PageRequest, signal?: AbortSignal): Promise<Page<Sanction>> =>
    http("/admin/bans", {
      query: { page: p.page, limit: p.limit, cursor: p.cursor },
      schema: pageEnvelope(sanctionSchema),
      signal,
    }),
  /** Current sanction, or null when the user has none (404). */
  async get(username: string, signal?: AbortSignal): Promise<Sanction | null> {
    try {
      return (await http(`/admin/users/${enc(username)}/ban`, { schema: dataEnvelope(sanctionSchema), signal })).data;
    } catch (e) {
      if (isApiError(e) && e.isNotFound) return null;
      throw e;
    }
  },
  async put(username: string, body: ApiSchemas["schemas"]["sanctionInput"]): Promise<Sanction> {
    return (
      await http(`/admin/users/${enc(username)}/ban`, { method: "PUT", body, schema: dataEnvelope(sanctionSchema) })
    ).data;
  },
  lift: async (username: string): Promise<void> =>
    void (await http(`/admin/users/${enc(username)}/ban`, { method: "DELETE" })),
};
