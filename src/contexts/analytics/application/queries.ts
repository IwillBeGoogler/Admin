import { queryOptions } from "@tanstack/react-query";
import { productRepository } from "../infrastructure/productRepository";
import { statsRepository } from "../infrastructure/statsRepository";

export const analyticsKeys = {
  all: ["analytics"] as const,
  stats: () => [...analyticsKeys.all, "stats"] as const,
  product: (days: number) => [...analyticsKeys.all, "product", days] as const,
};

export const statsQuery = () =>
  queryOptions({
    queryKey: analyticsKeys.stats(),
    queryFn: ({ signal }) => statsRepository.get(signal),
    staleTime: 30_000,
  });

import { useQuery } from "@tanstack/react-query";

export const useStats = () => useQuery({ ...statsQuery(), refetchInterval: 60_000 });

export const productQuery = (days: number) =>
  queryOptions({
    queryKey: analyticsKeys.product(days),
    queryFn: ({ signal }) => productRepository.report(days, signal),
    staleTime: 60_000,
  });

export const useProductReport = (days: number) => useQuery(productQuery(days));
