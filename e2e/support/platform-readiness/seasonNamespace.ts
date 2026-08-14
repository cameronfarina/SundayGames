import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import { cleanIdFragment, leagueName, smokeRunId } from "./environment.js";

export const namespacedSeasonForSmoke = (season: LeagueSeason): LeagueSeason => {
  if (smokeRunId === undefined) return season;

  const leagueId = `${season.leagueId}-${smokeRunId}`;
  const seasonId = `${leagueId}-season-${season.seasonYear}`;

  return {
    ...season,
    id: seasonId,
    leagueId,
    league: {
      ...season.league,
      id: leagueId,
      externalLeagueId: `${season.league.externalLeagueId}-${smokeRunId}`,
      name: leagueName,
    },
    teams: season.teams.map((team, index) => {
      const ownerSlug = cleanIdFragment(team.ownerDisplayName);

      return {
        ...team,
        id: `${seasonId}-team-${String(index + 1).padStart(2, "0")}-${ownerSlug}`,
        leagueSeasonId: seasonId,
        ownerId: `${team.ownerId}-${smokeRunId}`,
      };
    }),
  };
};
