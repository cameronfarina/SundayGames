import type { AccountRecord } from "../../auth.js";
import type { LeagueSeason } from "../../leagueSeason.js";
import type { LeagueSetupRepository } from "../../leagueSetup.js";
import { PlatformAppError } from "../errors.js";
import type { LeagueSetupMirror } from "./leagueSetupMirror.js";
import type { MembershipAccess } from "./membershipAccess.js";

export interface SeasonAccess {
  requireSeason(seasonId: string): Promise<LeagueSeason>;
  requireSeasonForLeagueYear(leagueId: string, seasonYear: number): Promise<LeagueSeason>;
  requireSeasonRead(account: AccountRecord, seasonId: string): Promise<LeagueSeason>;
}

const requireFound = async (
  season: LeagueSeason | null,
  mirror: LeagueSetupMirror,
): Promise<LeagueSeason> => {
  if (season === null) throw new PlatformAppError("season_not_found", "League season was not found.");
  return mirror.season(season);
};

export const createSeasonAccess = (
  leagueSetup: LeagueSetupRepository,
  mirror: LeagueSetupMirror,
): Omit<SeasonAccess, "requireSeasonRead"> => ({
  requireSeason: async seasonId => requireFound(await leagueSetup.findLeagueSeason(seasonId), mirror),
  requireSeasonForLeagueYear: async (leagueId, seasonYear) => requireFound(
    await leagueSetup.findLeagueSeasonForLeagueYear(leagueId, seasonYear),
    mirror,
  ),
});

export const addSeasonReadAccess = (
  seasons: Omit<SeasonAccess, "requireSeasonRead">,
  memberships: MembershipAccess,
): SeasonAccess => ({
  ...seasons,
  requireSeasonRead: async (account, seasonId) => {
    const season = await seasons.requireSeason(seasonId);
    await memberships.requireSharedRead(account, season.leagueId);
    return season;
  },
});
