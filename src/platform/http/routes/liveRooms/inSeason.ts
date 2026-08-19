import {
  buildFantasyProsInSeasonView,
  emptyFantasyProsInSeasonDataset,
  fantasyProsRosterView,
  loadFantasyProsInSeasonDataset,
} from "../../../fantasyProsInSeason.js";
import { PlatformAppError } from "../../../platformApp.js";
import { starterSlotsFor } from "../../../postDraftLiveRoomAdapter.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { knownError, methodNotAllowed } from "../../responses.js";

export const routeLiveRoomInSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  roomId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  const room = await app.getLiveDraftRoom({
    actorSessionToken: request.sessionToken,
    roomId,
    now: request.now,
  });
  if (room.status !== "ended") {
    return knownError(409, "room_not_ended", "In-season tools open once the draft ends.");
  }
  const membership = (await app.listLeagueMemberships(room.leagueId))
    .find(candidate => candidate.userId === account.id);
  if (membership?.ownerId === undefined || membership.teamId === undefined) {
    throw new PlatformAppError("private_team_required", "Claim your team before opening My Team.");
  }
  const rosterView = fantasyProsRosterView(room, membership.teamId, membership.ownerId);
  if (rosterView === undefined) {
    return knownError(409, "owned_team_mismatch", "Your claimed team is not in this draft room.");
  }

  // Without the repository the page still renders the roster, just with no
  // FantasyPros numbers beside it.
  const repository = services.fantasyProsRepository;
  const dataset = repository === undefined
    ? emptyFantasyProsInSeasonDataset()
    : await loadFantasyProsInSeasonDataset(repository);

  return {
    status: 200,
    body: buildFantasyProsInSeasonView({
      configured: services.fantasyProsConfigured ?? false,
      teamId: membership.teamId,
      ownerId: membership.ownerId,
      rosterView,
      starterSlots: starterSlotsFor(room.season),
      dataset,
    }),
  };
};
