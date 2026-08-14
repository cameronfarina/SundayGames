import { normalizeEmail } from "../../auth.js";
import type {
  ClientAddressRateLimiter,
  NormalizedEmailRateLimiter,
} from "../../authRateLimit.js";
import type { PlatformHttpErrorBody, PlatformHttpResponse } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";

export const authRateLimitResponse = (
  email: string,
  request: ParsedPlatformHttpRequest,
  emailLimiter: NormalizedEmailRateLimiter | undefined,
  clientLimiter: ClientAddressRateLimiter | undefined,
): PlatformHttpResponse<PlatformHttpErrorBody> | null => {
  const decisions = [
    emailLimiter?.consume(normalizeEmail(email), request.now),
    clientLimiter?.consume(request.clientAddress, request.now),
  ].filter(decision => decision !== undefined);
  const denied = decisions.find(decision => !decision.allowed);
  if (denied === undefined) return null;
  return {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil(denied.retryAfterMs / 1_000))) },
    body: { error: { code: "auth_rate_limited", message: "Too many attempts. Try again later." } },
  };
};

export const actionRateLimitResponse = (
  request: ParsedPlatformHttpRequest,
  limiter: ClientAddressRateLimiter | undefined,
  key: string,
  message: string,
): PlatformHttpResponse<PlatformHttpErrorBody> | null => {
  const decision = limiter?.consume(key, request.now);
  if (decision === undefined || decision.allowed) return null;
  return {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1_000))) },
    body: { error: { code: "rate_limited", message } },
  };
};

export const screenshotRateLimitResponse = (
  request: ParsedPlatformHttpRequest,
  limiter: ClientAddressRateLimiter | undefined,
  key: string,
): PlatformHttpResponse<PlatformHttpErrorBody> | null => actionRateLimitResponse(
  request,
  limiter,
  key,
  "Too many screenshot analyses. Try again later.",
);
