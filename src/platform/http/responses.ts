import type { PlatformHttpErrorBody, PlatformHttpResponse } from "./contracts.js";

export const healthyResponseBody = { service: "mockd-platform", status: "ok" };
export const unavailableResponseBody = { service: "mockd-platform", status: "unavailable" };

export const invalidCredentialsBody: PlatformHttpErrorBody = {
  error: { code: "invalid_credentials", message: "Email or password is incorrect." },
};

export const authRequiredBody: PlatformHttpErrorBody = {
  error: { code: "auth_required", message: "Sign in before using this workspace." },
};

export const knownError = (
  status: number,
  code: string,
  message: string,
): PlatformHttpResponse<PlatformHttpErrorBody> => ({
  status,
  body: { error: { code, message } },
});

export const notFound = (): PlatformHttpResponse<PlatformHttpErrorBody> =>
  knownError(404, "route_not_found", "Route was not found.");

export const methodNotAllowed = (): PlatformHttpResponse<PlatformHttpErrorBody> =>
  knownError(405, "method_not_allowed", "Method is not allowed for this route.");

export const isPlatformHttpResponse = (
  value: object,
): value is PlatformHttpResponse => "status" in value;
