import { clearMockdSessionCookie, mockdSessionCookie } from "../../platformCookies.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalString, stringValue } from "../request/values.js";
import { authRequiredBody, invalidCredentialsBody, methodNotAllowed, notFound } from "../responses.js";
import { accountCreationDenied } from "./policy.js";
import { publicSessionFor } from "./publicSession.js";
import { authActionRateLimitResponse, authRateLimitResponse } from "./rateLimits.js";
import { loginRateLimitKey, loginRateLimitResponse } from "./rateLimits.js";
import { requireRequestAccount } from "./access.js";

export const authRoots = new Set([
  "accounts",
  "email-verifications",
  "password-resets",
  "session",
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
  if (root === "sessions" && request.segments.length === 1) {
    if (request.method !== "POST") return methodNotAllowed();
    const email = stringValue(request.body.email);
    const limited = await loginRateLimitResponse(
      request, email, services.loginRateLimiter, services.authClientRateLimiter,
    );
    if (limited !== null) return limited;
    const login = await app.login({ email, password: stringValue(request.body.password), now: request.now });
    if (login === null) return { status: 401, body: invalidCredentialsBody };
    await services.loginRateLimiter?.reset(loginRateLimitKey(request, email));
    return {
      status: 200,
      headers: { "Set-Cookie": mockdSessionCookie(login.sessionToken, { expires: login.session.expiresAt, secure: secureSessionCookie }) },
      body: { account: login.account, session: publicSessionFor(login.session) },
    };
  }
  if (root === "session" && action === "password" && request.segments.length === 2) {
    if (request.method !== "PUT") return methodNotAllowed();
    const account = await requireRequestAccount(app, request);
    const limited = await loginRateLimitResponse(
      request, account.email, services.loginRateLimiter, services.authClientRateLimiter,
    );
    if (limited !== null) return limited;
    await app.changePassword({
      actorSessionToken: request.sessionToken,
      currentPassword: stringValue(request.body.currentPassword),
      newPassword: stringValue(request.body.newPassword),
      newPasswordConfirmation: stringValue(request.body.newPasswordConfirmation),
      now: request.now,
    });
    await services.loginRateLimiter?.reset(loginRateLimitKey(request, account.email));
    return { status: 200, headers: { "Set-Cookie": clearMockdSessionCookie({ secure: secureSessionCookie }) }, body: { ok: true } };
  }
  if (root === "session" && action === "profile" && request.segments.length === 2) {
    if (request.method !== "PUT") return methodNotAllowed();
    const account = await app.updateDisplayName({
      actorSessionToken: request.sessionToken,
      displayName: stringValue(request.body.displayName),
      now: request.now,
    });
    return { status: 200, body: { account } };
  }
  if (root === "session" && request.segments.length === 1) {
    if (request.method === "GET") {
      const account = await app.findAccountBySessionToken(request.sessionToken, request.now);
      return account === null ? { status: 401, body: authRequiredBody } : { status: 200, body: { account } };
    }
    if (request.method === "DELETE") {
      await app.logout({ actorSessionToken: request.sessionToken, now: request.now });
      return { status: 200, headers: { "Set-Cookie": clearMockdSessionCookie({ secure: secureSessionCookie }) }, body: { ok: true } };
    }
  }
  return notFound();
};
