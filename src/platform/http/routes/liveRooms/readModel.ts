import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";

export const liveDraftRoomReadModelForRequest = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  roomId: string,
) => await app.getLiveDraftRoomState({
  actorSessionToken: request.sessionToken,
  roomId,
  selectedTeamId: optionalString(request.query.selectedTeamId),
  viewedTeamId: optionalString(request.query.viewedTeamId),
  now: request.now,
});
