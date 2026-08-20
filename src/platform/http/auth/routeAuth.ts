import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalString, stringValue } from "../request/values.js";
import { methodNotAllowed, notFound } from "../responses.js";
import { accountCreationDenied } from "./policy.js";
import { authActionRateLimitResponse, authRateLimitResponse } from "./rateLimits.js";
import { routeSessions } from "./routeSessions.js";

export const authRoots = new Set([
  "accounts",
  "email-verifications",
  "password-resets",
  "session",
  "session-state",
  "sessions",
]);

export const routeAuth = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  secureSessionCookie: boolean,
): Promise<PlatformHttpResponse> => {
  const [root, action] = request.segments;
  if (root === "accounts" && request.segments.length === 1) {
    if (request.method === "GET") {
      return { status: 200, body: { passwordRequired: services.emailVerificationRequired !== true } };
    }
    if (request.method !== "POST") return methodNotAllowed();
    const denied = await accountCreationDenied(request, services);
    if (denied !== null) return denied;
    const limited = await authRateLimitResponse(
      stringValue(request.body.email), request, services.accountRateLimiter, services.authClientRateLimiter,
    );
    if (limited !== null) return limited;
    const password = optionalString(request.body.password);
    const account = await app.createAccount({
      email: stringValue(request.body.email),
      ...(password === undefined ? {} : { password }),
      verificationReturnTo: optionalString(request.body.returnTo),
      now: request.now,
    });
    return services.emailVerificationRequired === true
      ? { status: 202, body: { accepted: true, message: "If this email can be registered, a verification link is on its way." } }
      : { status: 201, body: { account } };
  }
  if (root === "email-verifications" && request.segments.length === 1) {
    if (request.method !== "POST") return methodNotAllowed();
    const limited = await authRateLimitResponse(
      stringValue(request.body.email), request, services.verificationRateLimiter, services.authClientRateLimiter,
    );
    if (limited !== null) return limited;
    await app.requestEmailVerification({
      email: stringValue(request.body.email),
      verificationReturnTo: optionalString(request.body.returnTo),
      now: request.now,
    });
    return { status: 202, body: { accepted: true, message: "If this email is awaiting verification, a new link is on its way." } };
  }
  if (root === "email-verifications" && action === "consume") {
    if (request.method !== "POST") return methodNotAllowed();
    await app.verifyEmail({
      token: stringValue(request.body.token),
      newPassword: stringValue(request.body.newPassword),
      newPasswordConfirmation: stringValue(request.body.newPasswordConfirmation),
      now: request.now,
    });
    return { status: 200, body: { verified: true } };
  }
  if (root === "password-resets" && request.segments.length === 1) {
    if (request.method !== "POST") return methodNotAllowed();
    const limited = await authRateLimitResponse(
      stringValue(request.body.email), request, services.passwordResetRateLimiter, services.authClientRateLimiter,
    );
    if (limited !== null) return limited;
    await app.requestPasswordReset({ email: stringValue(request.body.email), now: request.now });
    return { status: 202, body: { accepted: true, message: "If an account exists for this email, a password reset link is on its way." } };
  }
  if (root === "password-resets" && action === "consume") {
    if (request.method !== "POST") return methodNotAllowed();
    const limited = await authActionRateLimitResponse(
      request, services.passwordResetConsumeRateLimiter, request.clientAddress,
      "Too many password reset attempts. Try again later.",
    );
    if (limited !== null) return limited;
    await app.resetPasswordWithToken({
      token: stringValue(request.body.token),
      newPassword: stringValue(request.body.newPassword),
      newPasswordConfirmation: stringValue(request.body.newPasswordConfirmation),
      now: request.now,
    });
    return { status: 200, body: { reset: true } };
  }
  const session = await routeSessions(app, request, services, secureSessionCookie);
  if (session !== null) return session;
  return notFound();
};
