import { analyzeEndedLiveDraftRoomTeam } from "../../../postDraftLiveRoomAdapter.js";
import { PlatformAppError } from "../../../platformApp.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { knownError, methodNotAllowed } from "../../responses.js";

export const routeLiveRoomMyTeam = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  roomId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  if (services.postDraftProjectionProvider === undefined) {
    return knownError(503, "post_draft_analysis_unavailable", "My Team analysis is unavailable.");
  }
  const account = await requireRequestAccount(app, request);
  const room = await app.getLiveDraftRoom({ actorSessionToken: request.sessionToken, roomId, now: request.now });
  const membership = (await app.listLeagueMemberships(room.leagueId))
    .find(candidate => candidate.userId === account.id);
  if (membership?.ownerId === undefined || membership.teamId === undefined) {
    throw new PlatformAppError("private_team_required", "Claim your team before opening My Team.");
  }
  const evaluatedAt = request.now ?? new Date();
  const projectionSnapshot = await services.postDraftProjectionProvider(room.season, room.playerCatalog, evaluatedAt);
  const result = analyzeEndedLiveDraftRoomTeam({
    room,
    ownership: {
      userId: account.id,
      privateOwnerUserId: account.id,
      leagueId: room.leagueId,
      seasonId: room.seasonId,
      teamId: membership.teamId,
      ownerId: membership.ownerId,
    },
    projectionSnapshot,
    evaluatedAt,
    currentWeek: projectionSnapshot.metadata.week ?? 1,
  });
  return { status: 200, body: result };
};
