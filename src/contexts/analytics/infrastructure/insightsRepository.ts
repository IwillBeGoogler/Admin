import { http } from "@/shared/api";
import { dataEnvelope } from "@/shared/http";
import { type Insights, insightsSchema } from "../domain/insights";

export const insightsRepository = {
  async get(days: number, signal?: AbortSignal): Promise<Insights> {
    return (await http("/admin/insights", { query: { days }, schema: dataEnvelope(insightsSchema), signal })).data;
  },
};
