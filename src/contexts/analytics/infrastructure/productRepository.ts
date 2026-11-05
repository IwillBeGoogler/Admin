import { http } from "@/shared/api";
import { dataEnvelope } from "@/shared/http";
import { type ProductReport, productReportSchema } from "../domain/product";

export const productRepository = {
  async report(days: number, signal?: AbortSignal): Promise<ProductReport> {
    return (await http("/admin/analytics", { query: { days }, schema: dataEnvelope(productReportSchema), signal }))
      .data;
  },
};
