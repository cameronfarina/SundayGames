import { QueryClient } from "@tanstack/react-query";
import { PlatformApiError } from "../../shared/api/http/PlatformApiError";

const shouldRetryQuery = (failureCount: number, error: Error): boolean => {
  if (failureCount >= 1) return false;
  if (error instanceof PlatformApiError) return error.status >= 500;

  return true;
};

export const createAppQueryClient = (): QueryClient => new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: shouldRetryQuery,
      staleTime: 30_000,
    },
  },
});
