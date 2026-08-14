import { queryOptions, useQuery } from "@tanstack/react-query";
import type { QueryFunctionContext } from "@tanstack/react-query";
import type { PlatformFetch } from "../http/requestPlatformJson";
import { seasonQueryKeys } from "../queries/seasonQueryKeys";
import { getOnboarding } from "./onboardingApi";

const ONBOARDING_STALE_TIME_MS = 60_000;

export const onboardingQueryKey = seasonQueryKeys.onboarding;

const onboardingQueryFunction = (fetcher?: PlatformFetch) => async (
  { signal }: QueryFunctionContext<ReturnType<typeof onboardingQueryKey>>,
) => await getOnboarding({
  ...(fetcher === undefined ? {} : { fetcher }),
  signal,
});

export const onboardingQueryOptions = (fetcher?: PlatformFetch) => queryOptions({
  queryFn: onboardingQueryFunction(fetcher),
  queryKey: onboardingQueryKey(),
  staleTime: ONBOARDING_STALE_TIME_MS,
});

export const useOnboardingQuery = (fetcher?: PlatformFetch) => (
  useQuery(onboardingQueryOptions(fetcher))
);
