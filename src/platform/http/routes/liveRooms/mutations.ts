import { requireRequestAccount } from "../../auth/access.js";
import { actionRateLimitResponse } from "../../auth/rateLimits.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import { liveDraftSaleInputFor } from "../../request/domainInputs.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalBoolean, optionalNumber, optionalString, stringValue } from "../../request/values.js";
import { methodNotAllowed, notFound } from "../../responses.js";
import { liveDraftRoomReadModelForRequest } from "./readModel.js";

const mutationActions = new Set([
  "start", "pause", "resume", "reopen", "sales", "sale", "undo",
  "corrections", "correction", "end",
]);

export const isLiveRoomMutationAction = (action: string): boolean => mutationActions.has(action);

const mutationIdentity = (request: ParsedPlatformHttpRequest, roomId: string) => ({
  actorSessionToken: request.sessionToken,
  roomId,
  expectedRevision: optionalNumber(request.body.expectedRevision),
  idempotencyKey: optionalString(request.body.idempotencyKey),
  now: request.now,
});

export const routeLiveRoomMutation = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  roomId: string,
  action: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  if (!isLiveRoomMutationAction(action)) return notFound();
  const account = await requireRequestAccount(app, request);
  const limited = actionRateLimitResponse(
    request,
    services.liveDraftMutationRateLimiter,
    `${account.id}:${roomId}`,
    "Too many live draft changes. Try again shortly.",
  );
  if (limited !== null) return limited;
  const identity = mutationIdentity(request, roomId);
  if (action === "start") await app.startLiveDraftRoom(identity);
  else if (action === "pause") await app.pauseLiveDraftRoom(identity);
  else if (action === "resume") await app.resumeLiveDraftRoom(identity);
  else if (action === "reopen") await app.reopenLiveDraftRoom(identity);
  else if (action === "sales" || action === "sale") {
    await app.logLiveDraftSale({ ...identity, sale: liveDraftSaleInputFor(request.body) });
  } else if (action === "undo") await app.undoLastLiveDraftSale(identity);
  else if (action === "corrections" || action === "correction") {
    await app.correctLiveDraftSale({
      ...identity,
      saleEventId: stringValue(request.body.saleEventId),
      replacementSale: liveDraftSaleInputFor({ sale: request.body.replacementSale }),
    });
  } else if (action === "end") {
    await app.endLiveDraftRoom({ ...identity, allowIncomplete: optionalBoolean(request.body.allowIncomplete) });
  } else return notFound();
  return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId) } };
};
