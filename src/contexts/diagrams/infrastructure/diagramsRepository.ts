import { http } from "@/shared/api";
import { dataEnvelope, type Page, type PageRequest, pageEnvelope } from "@/shared/http";
import {
  type DiagramStats,
  diagramStatsSchema,
  type ProjectDetail,
  type ProjectSummary,
  type ProjectsSearch,
  projectDetailSchema,
  projectSummarySchema,
  type Template,
  type TemplateInput,
  templateSchema,
} from "../domain/diagram";

const base = "/admin/diagrams";

export const diagramRepository = {
  stats: async (signal?: AbortSignal): Promise<DiagramStats> =>
    (await http(`${base}/stats`, { schema: dataEnvelope(diagramStatsSchema), signal })).data,
  projects: (s: ProjectsSearch, p: PageRequest, signal?: AbortSignal): Promise<Page<ProjectSummary>> =>
    http(`${base}/projects`, {
      query: { q: s.q, owner: s.owner, cursor: p.cursor, limit: p.limit },
      schema: pageEnvelope(projectSummarySchema),
      signal,
    }),
  project: async (id: string, signal?: AbortSignal): Promise<ProjectDetail> =>
    (await http(`${base}/projects/${encodeURIComponent(id)}`, { schema: dataEnvelope(projectDetailSchema), signal }))
      .data,
  deleteProject: async (id: string): Promise<void> =>
    void (await http(`${base}/projects/${encodeURIComponent(id)}`, { method: "DELETE" })),
  revokeShare: async (shareId: string): Promise<void> =>
    void (await http(`${base}/shares/${encodeURIComponent(shareId)}/revoke`, { method: "POST" })),
};

export const templateRepository = {
  list: async (signal?: AbortSignal): Promise<Template[]> =>
    (await http(`${base}/templates`, { schema: pageEnvelope(templateSchema), signal })).items,
  create: async (body: TemplateInput & { position: number }): Promise<Template> =>
    (await http(`${base}/templates`, { method: "POST", body, schema: dataEnvelope(templateSchema) })).data,
  update: async (id: string, body: Partial<TemplateInput> & { position?: number }): Promise<Template> =>
    (
      await http(`${base}/templates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
        schema: dataEnvelope(templateSchema),
      })
    ).data,
  remove: async (id: string): Promise<void> =>
    void (await http(`${base}/templates/${encodeURIComponent(id)}`, { method: "DELETE" })),
  /** Gallery order in one atomic call: `ids` first, in this order. */
  reorder: async (ids: string[]): Promise<void> =>
    void (await http(`${base}/templates/reorder`, { method: "POST", body: { ids } })),
};
