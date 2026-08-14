import type { PlatformHttpResponse } from "../platformHttp.js";

export const authRequiredResponse = (): PlatformHttpResponse => ({
  status: 401,
  body: { error: { code: "auth_required", message: "Sign in before using this workspace." } },
});

export const seasonNotFoundResponse = (): PlatformHttpResponse => ({
  status: 404,
  body: { error: { code: "season_not_found", message: "League season was not found." } },
});

export const sharedMutationDeniedResponse = (): PlatformHttpResponse => ({
  status: 403,
  body: {
    error: {
      code: "shared_mutation_denied",
      message: "Only league owners and admins can manage league setup.",
    },
  },
});

export const rateLimitedResponse = (
  retryAfterMs: number,
  code = "rate_limited",
  message = "Too many screenshot analyses. Try again later.",
): PlatformHttpResponse => ({
  status: 429,
  headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1_000))) },
  body: { error: { code, message } },
});
