import {
  buildFantasyProsInSeasonView,
  emptyFantasyProsInSeasonDataset,
  emptyFantasyProsPlayerNewsIndex,
  fantasyProsRosterView,
  loadFantasyProsInSeasonDataset,
  loadFantasyProsPlayerNewsIndex,
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
  // FantasyPros numbers beside it. A news blurb hangs off a FantasyPros player
  // id, so with FantasyPros dark there is nothing for one to attach to and the
  // news read is skipped rather than joined against an empty roster.
  const repository = services.fantasyProsRepository;
  const newsRepository = repository === undefined ? undefined : services.playerNewsRepository;
  const [dataset, news] = await Promise.all([
    repository === undefined
      ? emptyFantasyProsInSeasonDataset()
      : loadFantasyProsInSeasonDataset(repository),
    newsRepository === undefined
      ? emptyFantasyProsPlayerNewsIndex()
      : loadFantasyProsPlayerNewsIndex(newsRepository, request.now),
  ]);

  return {
    status: 200,
    body: buildFantasyProsInSeasonView({
      configured: services.fantasyProsConfigured ?? false,
      teamId: membership.teamId,
      ownerId: membership.ownerId,
      rosterView,
      starterSlots: starterSlotsFor(room.season),
      dataset,
      news,
    }),
  };
};
