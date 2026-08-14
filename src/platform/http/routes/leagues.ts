import {
  confirmedLeagueCreationInputFromUnknown,
  createLeagueSeasonFromConfirmedSetup,
} from "../../leagueCreation.js";
import { requireRequestAccount } from "../auth/access.js";
import type { PlatformApp, PlatformHttpResponse } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { methodNotAllowed, notFound } from "../responses.js";

export const routeLeagues = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, leagueId, action] = request.segments;
  if (request.segments.length === 3 && action === "archive") {
    if (request.method !== "POST") return methodNotAllowed();
    await app.archiveLeague({
      actorSessionToken: request.sessionToken,
      leagueId: leagueId ?? "",
      now: request.now,
    });
    return { status: 200, body: { archived: true, leagueId: leagueId ?? "" } };
  }
  if (request.segments.length !== 1) return notFound();
  if (request.method !== "POST") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  const season = createLeagueSeasonFromConfirmedSetup(
    confirmedLeagueCreationInputFromUnknown(request.body.setup),
  );
  const registeredSeason = await app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season,
    memberships: [{ userId: account.id, leagueId: season.leagueId, role: "owner" }],
    now: request.now,
  });
  return { status: 201, body: { season: registeredSeason } };
};
