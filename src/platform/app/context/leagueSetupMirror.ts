import type { LeagueSeason } from "../../leagueSeason.js";
import type { PlatformLeagueMembership } from "../../leagueSetup.js";
import type { PlatformAppDependencies } from "./types.js";

export interface LeagueSetupMirror {
  memberships(
    leagueId: string,
    memberships: readonly PlatformLeagueMembership[],
  ): void;
  season(season: LeagueSeason): Promise<LeagueSeason>;
}

export const createLeagueSetupMirror = (
  dependencies: PlatformAppDependencies,
): LeagueSetupMirror => ({
  memberships: (leagueId, memberships): void => {
    if (dependencies.usesExternalLeagueSetup) {
      dependencies.store.replaceMembershipsForLeague(leagueId, memberships);
    }
  },
  season: async season => {
    if (dependencies.usesExternalLeagueSetup) {
      dependencies.store.registerLeagueSeason({
        season,
        memberships: await dependencies.leagueSetup.membershipsForLeague(season.leagueId),
        createdByUserId: "external",
        enforceCreationLimits: false,
      });
    }
    return season;
  },
});
