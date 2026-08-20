import { createLiveDraftRoomEventStream } from "../../../liveDraftRoomEventStream.js";
import type { LiveDraftRoomEventStreamSubscription } from "../../../liveDraftRoomEventStream.js";
import { LiveDraftRoomWaitLimitError } from "../../../liveDraftRoomRealtime.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import { methodNotAllowed } from "../../responses.js";
import { knownError } from "../../responses.js";
import { liveDraftRoomReadModelForRequest } from "./readModel.js";

export const routeLiveRoomEventStream = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  roomId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  const openSubscription = services.openLiveDraftRoomRevisionSubscription;
  if (openSubscription === undefined) {
    return knownError(503, "live_draft_stream_unavailable", "Live draft updates are unavailable.");
  }
  const account = await requireRequestAccount(app, request);
  const initialRoom = await liveDraftRoomReadModelForRequest(app, request, roomId);
  let subscription: LiveDraftRoomEventStreamSubscription;
  try {
    subscription = await openSubscription({ accountId: account.id, roomId });
  } catch (error) {
    if (!(error instanceof LiveDraftRoomWaitLimitError)) throw error;
    return {
      status: 429,
      headers: { "Retry-After": String(error.retryAfterSeconds) },
      body: {
        error: {
          code: "live_draft_event_stream_limit",
          message: "Too many live draft connections. Try again shortly.",
        },
      },
    };
  }
  try {
    const body = createLiveDraftRoomEventStream({
      initialRoom,
      subscription,
      signal: request.signal,
      loadRevision: async () => await app.getLiveDraftRoomRevision({
        actorSessionToken: request.sessionToken,
        roomId,
        now: request.now,
      }),
      loadUpdate: async afterRevision => await app.getLiveDraftRoomStreamUpdate({
        actorSessionToken: request.sessionToken,
        roomId,
        afterRevision,
        selectedTeamId: optionalString(request.query.selectedTeamId),
        viewedTeamId: optionalString(request.query.viewedTeamId),
        now: request.now,
      }),
    });
    return {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
      body,
    };
  } catch (error) {
    await subscription.close();
    throw error;
  }
};
