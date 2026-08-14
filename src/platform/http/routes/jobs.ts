import type { PlatformApp, PlatformHttpResponse } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalNumber, optionalString, stringValue } from "../request/values.js";
import { methodNotAllowed, notFound } from "../responses.js";

export const routeJobs = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, jobId, action] = request.segments;
  if (request.segments.length === 1) {
    if (request.method !== "GET") return methodNotAllowed();
    const page = await app.listJobs({
      actorSessionToken: request.sessionToken,
      cursor: optionalString(request.query.cursor),
      limit: optionalNumber(request.query.limit),
      now: request.now,
    });
    return { status: 200, body: page };
  }
  if (request.segments.length === 3 && action === "cancel") {
    if (request.method !== "POST") return methodNotAllowed();
    const job = await app.cancelJob({ actorSessionToken: request.sessionToken, jobId: jobId ?? "", now: request.now });
    return { status: 200, body: { job } };
  }
  if (request.segments.length === 3 && action === "rerun") {
    if (request.method !== "POST") return methodNotAllowed();
    const job = await app.rerunJob({
      actorSessionToken: request.sessionToken,
      jobId: jobId ?? "",
      idempotencyKey: stringValue(request.body.idempotencyKey),
      now: request.now,
    });
    return { status: 202, body: { job } };
  }
  if (request.segments.length !== 2) return notFound();
  if (request.method !== "GET") return methodNotAllowed();
  const job = await app.getJob({ actorSessionToken: request.sessionToken, jobId: jobId ?? "", now: request.now });
  return { status: 200, body: { job } };
};
