import type { PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import {
  healthyResponseBody,
  methodNotAllowed,
  unavailableResponseBody,
} from "../responses.js";

export const routeHealthProbe = (
  request: ParsedPlatformHttpRequest,
): PlatformHttpResponse => request.method === "GET"
  ? { status: 200, body: healthyResponseBody }
  : methodNotAllowed();

export const routeReadinessProbe = async (
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  let ready = true;
  try {
    ready = await services.readinessProbe?.() ?? true;
  } catch {
    ready = false;
  }
  return ready
    ? { status: 200, body: healthyResponseBody }
    : { status: 503, body: unavailableResponseBody };
};
