import type { PlatformFetch } from "../http/requestPlatformJson";
import { requestPlatformJson } from "../http/requestPlatformJson";
import { onboardingSchema } from "./onboardingSchema";

interface OnboardingRequest {
  readonly fetcher?: PlatformFetch;
  readonly signal?: AbortSignal;
}

export const getOnboarding = async (request: OnboardingRequest = {}) => await requestPlatformJson({
  ...(request.fetcher === undefined ? {} : { fetcher: request.fetcher }),
  init: request.signal === undefined ? {} : { signal: request.signal },
  path: "/onboarding",
  responseSchema: onboardingSchema,
});
