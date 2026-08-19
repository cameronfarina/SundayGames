import { requireSeasonManager } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { knownError, methodNotAllowed } from "../../responses.js";

export const routeSeasonSnakeRounds = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  seasonId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  await requireSeasonManager(app, request, seasonId);
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });
  if (season.settings.draftFormat !== "snake") {
    return knownError(409, "draft_format_mismatch", "Only a snake league has draft rounds.");
  }

  const rounds = request.body.rounds;
  const rosterSize = season.settings.roster.rosterSize;
  if (typeof rounds !== "number" || !Number.isInteger(rounds) || rounds < 1 || rounds > rosterSize) {
    return knownError(
      400,
      "invalid_draft_rounds",
      `Draft rounds must be a whole number between 1 and the ${String(rosterSize)}-player roster size.`,
    );
  }

  const updated = await app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season: { ...season, settings: { ...season.settings, snake: { ...season.settings.snake, rounds } } },
    memberships: await app.listLeagueMemberships(season.leagueId),
    membershipWriteMode: "preserve",
    now: request.now,
  });
  return { status: 200, body: { season: updated } };
};
