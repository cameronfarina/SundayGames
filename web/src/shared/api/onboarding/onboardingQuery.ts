import { queryOptions, useQuery } from "@tanstack/react-query";
import type { QueryFunctionContext } from "@tanstack/react-query";
import type { PlatformFetch } from "../http/requestPlatformJson";
import { getOnboarding } from "./onboardingApi";

const ONBOARDING_STALE_TIME_MS = 60_000;
type OnboardingQueryKey = readonly ["onboarding"];

export const onboardingQueryKey = (): OnboardingQueryKey => ["onboarding"];

const onboardingQueryFunction = (fetcher?: PlatformFetch) => async (
  { signal }: QueryFunctionContext<OnboardingQueryKey>,
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
