import { loadPlatformOnboarding } from "../../platformOnboarding.js";
import type { PlatformOnboardingRepository } from "../../platformOnboarding.js";
import { requireRequestAccount } from "../auth/access.js";
import type { PlatformApp, PlatformHttpResponse } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { knownError, methodNotAllowed, notFound } from "../responses.js";

export const routeOnboarding = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  repository: PlatformOnboardingRepository | undefined,
): Promise<PlatformHttpResponse> => {
  if (request.segments.length !== 1) return notFound();
  if (request.method !== "GET") return methodNotAllowed();
  if (repository === undefined) {
    return knownError(503, "onboarding_unavailable", "League onboarding is not configured.");
  }
  const account = await requireRequestAccount(app, request);
  return { status: 200, body: await loadPlatformOnboarding(repository, { account }) };
};
