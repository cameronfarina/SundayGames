import { clearMockdSessionCookie, mockdSessionCookie } from "../../platformCookies.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { stringValue } from "../request/values.js";
import { authRequiredBody, invalidCredentialsBody, methodNotAllowed } from "../responses.js";
import { requireRequestAccount } from "./access.js";
import { publicSessionFor } from "./publicSession.js";
import { loginRateLimitKey, loginRateLimitResponse } from "./rateLimits.js";
import {
  accountOnboardingSnapshot,
  compatibleAccountOnboardingSnapshot,
} from "../../accountOnboarding.js";

const onboardingFor = async (
  services: PlatformHttpServices,
  accountId: string,
) => services.accountOnboardingRepository === undefined
  ? undefined
  : compatibleAccountOnboardingSnapshot(
    await accountOnboardingSnapshot(services.accountOnboardingRepository, accountId),
  );

/** Null means the path belongs to another auth route, not that the request failed. */
export const routeSessions = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  secureSessionCookie: boolean,
): Promise<PlatformHttpResponse | null> => {
  const [root, action] = request.segments;
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
    const onboarding = await onboardingFor(services, login.account.id);
    return {
      status: 200,
      headers: { "Set-Cookie": mockdSessionCookie(login.sessionToken, { expires: login.session.expiresAt, secure: secureSessionCookie }) },
      body: {
        account: login.account,
        session: publicSessionFor(login.session),
        ...(onboarding === undefined ? {} : { onboarding }),
      },
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
  /* The landing page asks this before it renders. A signed-out visitor is the
     normal case there, so answering 401 would print a failed request in every
     visitor's console for something that did not fail. */
  if (root === "session-state" && request.segments.length === 1) {
    if (request.method !== "GET") return methodNotAllowed();
    const account = await app.findAccountBySessionToken(request.sessionToken, request.now);
    return { status: 200, body: { signedIn: account !== null } };
  }
  if (root === "session" && request.segments.length === 1) {
    if (request.method === "GET") {
      const account = await app.findAccountBySessionToken(request.sessionToken, request.now);
      if (account === null) return { status: 401, body: authRequiredBody };
      const onboarding = await onboardingFor(services, account.id);
      return {
        status: 200,
        body: { account, ...(onboarding === undefined ? {} : { onboarding }) },
      };
    }
    if (request.method === "DELETE") {
      await app.logout({ actorSessionToken: request.sessionToken, now: request.now });
      return { status: 200, headers: { "Set-Cookie": clearMockdSessionCookie({ secure: secureSessionCookie }) }, body: { ok: true } };
    }
  }
  return null;
};
