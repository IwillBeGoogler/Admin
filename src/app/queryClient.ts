import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/http";

/** 4xx are answers, not glitches: never retry them. Network/5xx retry twice. */
export const shouldRetry = (count: number, error: unknown) => {
  if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 429) return false;
  return count < 2;
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: shouldRetry, refetchOnWindowFocus: true },
      mutations: { retry: false, networkMode: "always" },
    },
  });
