import type { ConfirmedLeagueCreationInput } from "../../../leagueCreation.js";
import { createLeagueSeasonFromConfirmedSetup } from "../../../leagueCreation.js";
import type { LeagueImportConversion } from "../../../leagueImportFromSync.js";
import type { LeagueSeason } from "../../../leagueSeason.js";
import { leagueSeasonSetupRevision } from "../../../leagueSetup.js";
import { seasonFromLeagueImport } from "../../../leagueImportFromSync.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import {
  importNeedsReview,
  leagueSetupLocked,
  type LeagueImportMode,
} from "./importModes.js";

/**
 * An imported league is created the same way the wizard creates one, so it is
 * an ordinary league from the first moment. Only the per-hour creation window
 * is waived: importing an account means creating every league at once, which is
 * exactly what that window stops for hand-made leagues. The account's
 * active-league quota still applies.
 */
export const createdImportSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  accountId: string,
  leagueConnectionId: string,
  input: ConfirmedLeagueCreationInput,
): Promise<LeagueSeason> => {
  const season = createLeagueSeasonFromConfirmedSetup(input);

  return await app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season,
    memberships: [{ userId: accountId, leagueId: season.leagueId, role: "owner" }],
    enforceCreationRateLimit: false,
    leagueConnectionId,
    now: request.now,
  });
};

/**
 * Replacing a league the owner already manages keeps the season, the league,
 * and every team id it holds. Memberships are preserved rather than replaced,
 * so anyone who has claimed a team keeps it, and the revision read a moment ago
 * has to still be current or the write is refused as a conflict.
 */
export const overwrittenImportSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  existing: LeagueSeason,
  leagueConnectionId: string,
  input: ConfirmedLeagueCreationInput,
): Promise<LeagueSeason> => await app.registerLeagueSeason({
  actorSessionToken: request.sessionToken,
  season: seasonFromLeagueImport(existing, input),
  memberships: [],
  membershipWriteMode: "preserve",
  expectedSetupRevision: leagueSeasonSetupRevision(existing),
  leagueConnectionId,
  now: request.now,
});

export const writeImportSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  accountId: string,
  leagueConnectionId: string,
  mode: LeagueImportMode,
  conversion: LeagueImportConversion,
): Promise<LeagueSeason | PlatformHttpResponse> => {
  if (conversion.status === "blocked") {
    return importNeedsReview(conversion.issues, conversion.draftSetup);
  }
  if (mode.mode === "create") {
    return await createdImportSeason(
      app,
      request,
      accountId,
      leagueConnectionId,
      conversion.input,
    );
  }

  const existing = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId: mode.seasonId,
    now: request.now,
  });
  if (await app.hasLiveDraftRoomForSeason(existing.id)) return leagueSetupLocked();
  return await overwrittenImportSeason(
    app,
    request,
    existing,
    leagueConnectionId,
    conversion.input,
  );
};
