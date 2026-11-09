import { http } from "@/shared/api";
import { dataEnvelope } from "@/shared/http";
import { type SiteStats, siteStatsSchema } from "../domain/siteStats";

export const siteStatsRepository = {
  async get(limit: number, signal?: AbortSignal): Promise<SiteStats> {
    return (await http("/admin/stats/site", { query: { limit }, schema: dataEnvelope(siteStatsSchema), signal })).data;
  },
};
