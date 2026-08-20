import {
  leagueImportConversion,
  refreshedSeasonFromImport,
  teamCountMismatchDetail,
} from "../../../leagueImportFromSync.js";
import { leagueSeasonSetupRevision } from "../../../leagueSetup.js";
import type { ImportedSeasonRefresher } from "../../../leagueSyncService.js";
import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";

/**
 * Carries a fresh snapshot through to the league the connection imported. The
 * league is only ever nudged, never rebuilt: syncing must not be a way to lose
 * a team or reopen a draft the league has already settled. Anything the owner
 * has to act on comes back as the sentence they will read on the connection.
 */
export const importedSeasonRefresher = (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): ImportedSeasonRefresher => async ({ connection, snapshot }) => {
  const seasonId = connection.leagueSeasonId;
  if (seasonId === undefined) return null;
  const existing = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });

  const mismatch = teamCountMismatchDetail(snapshot.teams.length, existing.teams.length);
  if (mismatch !== null) return mismatch;

  const conversion = leagueImportConversion({
    provider: connection.provider,
    providerLeagueId: connection.providerLeagueId,
    settings: snapshot.settings,
    teams: snapshot.teams,
  });
  if (conversion.status === "blocked") {
    return `This league synced, but Sunday Games could not read it: ${conversion.issues.join(" ")}`;
  }

  const refresh = refreshedSeasonFromImport(existing, conversion.input);
  if (refresh.status === "blocked") return refresh.detail;
  await app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season: refresh.season,
    memberships: [],
    membershipWriteMode: "preserve",
    expectedSetupRevision: leagueSeasonSetupRevision(existing),
    now: request.now,
  });

  return refresh.detail ?? null;
};
