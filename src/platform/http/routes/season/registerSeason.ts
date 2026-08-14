import { LeagueCreationError } from "../../../leagueCreation.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import { isLeagueSeason, platformLeagueMembershipsFrom } from "../../request/domainInputs.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString, unknownRecord } from "../../request/values.js";
import { knownError } from "../../responses.js";

export const registerSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  expectedSeasonId?: string | undefined,
): Promise<PlatformHttpResponse> => {
  const seasonInput = unknownRecord(request.body.season);
  if (expectedSeasonId !== undefined && optionalString(seasonInput?.id) !== expectedSeasonId) {
    return knownError(400, "season_id_mismatch", "Season body must match the route season id.");
  }
  if (!isLeagueSeason(request.body.season)) {
    throw new LeagueCreationError("League season is invalid.");
  }
  const season = await app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season: request.body.season,
    memberships: platformLeagueMembershipsFrom(request.body.memberships),
    now: request.now,
  });
  return { status: 200, body: { season } };
};
