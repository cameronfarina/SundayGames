import type { PlatformApp, PlatformHttpResponse } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalString } from "../request/values.js";
import { methodNotAllowed, notFound } from "../responses.js";

export const routePricingSnapshots = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, modelRunId] = request.segments;
  if (request.segments.length !== 2) return notFound();
  if (request.method !== "GET") return methodNotAllowed();
  const pricingSnapshot = await app.getPricingSnapshot({
    actorSessionToken: request.sessionToken,
    modelRunId: modelRunId ?? "",
    scenarioId: optionalString(request.query.scenarioId),
    now: request.now,
  });
  return { status: 200, body: { pricingSnapshot } };
};
