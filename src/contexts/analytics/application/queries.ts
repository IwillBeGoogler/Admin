import { queryOptions } from "@tanstack/react-query";
import { productRepository } from "../infrastructure/productRepository";
import { siteStatsRepository } from "../infrastructure/siteStatsRepository";
import { statsRepository } from "../infrastructure/statsRepository";

export const analyticsKeys = {
  all: ["analytics"] as const,
  stats: () => [...analyticsKeys.all, "stats"] as const,
  site: (limit: number) => [...analyticsKeys.all, "site", limit] as const,
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

export const siteStatsQuery = (limit: number) =>
  queryOptions({
    queryKey: analyticsKeys.site(limit),
    queryFn: ({ signal }) => siteStatsRepository.get(limit, signal),
    staleTime: 60_000,
  });

export const useSiteStats = (limit = 10) => useQuery(siteStatsQuery(limit));
