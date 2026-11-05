import { http } from "@/shared/api";
import { dataEnvelope } from "@/shared/http";
import { type Stats, statsSchema } from "../domain/stats";

export const statsRepository = {
  async get(signal?: AbortSignal): Promise<Stats> {
    return (await http("/admin/stats", { schema: dataEnvelope(statsSchema), signal })).data;
  },
};
